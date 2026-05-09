import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const LOCATION_MAP: Record<string, string> = {
  LTJSA6QR1HGW6: "CC",
  LXJYXDXWR0XZF: "SA",
}

function getRiskLevel(score: number): string {
  if (score <= 25) return "low"
  if (score <= 50) return "medium"
  if (score <= 75) return "high"
  return "critical"
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)))
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const square = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })

  try {
    // Step 1: Fetch all customers (paginate)
    const allCustomers: Array<{
      id: string
      givenName?: string
      familyName?: string
      phoneNumber?: string
      emailAddress?: string
    }> = []

    let page = await square.customers.list({ limit: 100 })
    for (const c of page.data) {
      if (c.id) allCustomers.push({
        id: c.id,
        givenName: c.givenName ?? undefined,
        familyName: c.familyName ?? undefined,
        phoneNumber: c.phoneNumber ?? undefined,
        emailAddress: c.emailAddress ?? undefined,
      })
    }
    while (page.hasNextPage()) {
      page = await page.getNextPage()
      for (const c of page.data) {
        if (c.id) allCustomers.push({
          id: c.id,
          givenName: c.givenName ?? undefined,
          familyName: c.familyName ?? undefined,
          phoneNumber: c.phoneNumber ?? undefined,
          emailAddress: c.emailAddress ?? undefined,
        })
      }
    }

    console.log(`[Churn] Found ${allCustomers.length} customers`)

    let processed = 0
    let upserted = 0
    const errors: string[] = []

    // Step 2: Process each customer
    for (const customer of allCustomers) {
      try {
        // Fetch orders for this customer across both locations
        const orderResponse = await square.orders.search({
          locationIds: Object.keys(LOCATION_MAP),
          query: {
            filter: {
              customerFilter: {
                customerIds: [customer.id],
              },
              stateFilter: {
                states: ["COMPLETED"],
              },
            },
            sort: {
              sortField: "CLOSED_AT",
              sortOrder: "DESC",
            },
          },
        })

        const orders = orderResponse.orders || []
        if (orders.length === 0) continue

        processed++

        // Calculate metrics per location
        const ordersByLocation: Record<string, typeof orders> = {}
        for (const order of orders) {
          const locId = order.locationId || "unknown"
          if (!ordersByLocation[locId]) ordersByLocation[locId] = []
          ordersByLocation[locId].push(order)
        }

        for (const [locationId, locOrders] of Object.entries(ordersByLocation)) {
          if (!LOCATION_MAP[locationId]) continue

          const now = new Date()
          const orderDates = locOrders
            .map(o => o.closedAt ? new Date(o.closedAt) : null)
            .filter((d): d is Date => d !== null)
            .sort((a, b) => b.getTime() - a.getTime())

          if (orderDates.length === 0) continue

          const lastVisitDate = orderDates[0]
          const daysSinceLastVisit = daysBetween(now, lastVisitDate)
          const totalVisits = orderDates.length

          // Calculate total spend
          let totalSpend = 0
          for (const order of locOrders) {
            if (order.totalMoney?.amount) {
              totalSpend += Number(order.totalMoney.amount) / 100
            }
          }

          // Calculate average days between visits
          let avgDaysBetweenVisits = 0
          if (orderDates.length > 1) {
            let totalGap = 0
            for (let i = 0; i < orderDates.length - 1; i++) {
              totalGap += daysBetween(orderDates[i], orderDates[i + 1])
            }
            avgDaysBetweenVisits = totalGap / (orderDates.length - 1)
          }

          // Calculate risk score
          const effectiveAvg = Math.max(avgDaysBetweenVisits, 30)
          let riskScore = (daysSinceLastVisit / effectiveAvg) * 50
          if (totalVisits <= 2) riskScore += 20
          if (totalSpend > 500) riskScore -= 10
          riskScore = Math.min(100, Math.max(0, riskScore))

          const riskLevel = getRiskLevel(riskScore)
          const clientName = [customer.givenName, customer.familyName].filter(Boolean).join(" ") || "Unknown"

          // Predicted churn date: if trending, estimate when they'll fully churn
          const predictedChurnDate = avgDaysBetweenVisits > 0
            ? new Date(lastVisitDate.getTime() + avgDaysBetweenVisits * 2 * 24 * 60 * 60 * 1000)
            : null

          await prisma.churnPrediction.upsert({
            where: {
              locationId_clientSquareId: {
                locationId,
                clientSquareId: customer.id,
              },
            },
            update: {
              clientName,
              clientPhone: customer.phoneNumber || null,
              clientEmail: customer.emailAddress || null,
              riskScore: Math.round(riskScore * 100) / 100,
              riskLevel,
              lastVisitDate,
              avgDaysBetweenVisits: Math.round(avgDaysBetweenVisits * 100) / 100,
              daysSinceLastVisit,
              totalVisits,
              totalSpend: Math.round(totalSpend * 100) / 100,
              predictedChurnDate,
              calculatedAt: now,
            },
            create: {
              locationId,
              clientSquareId: customer.id,
              clientName,
              clientPhone: customer.phoneNumber || null,
              clientEmail: customer.emailAddress || null,
              riskScore: Math.round(riskScore * 100) / 100,
              riskLevel,
              lastVisitDate,
              avgDaysBetweenVisits: Math.round(avgDaysBetweenVisits * 100) / 100,
              daysSinceLastVisit,
              totalVisits,
              totalSpend: Math.round(totalSpend * 100) / 100,
              predictedChurnDate,
              outreachSent: false,
              wonBack: false,
              calculatedAt: now,
            },
          })
          upserted++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Customer ${customer.id}: ${msg}`)
        if (errors.length > 50) break
      }
    }

    console.log(`[Churn] Processed ${processed} customers, upserted ${upserted} predictions, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      totalCustomers: allCustomers.length,
      processed,
      upserted,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Churn] Fatal error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
