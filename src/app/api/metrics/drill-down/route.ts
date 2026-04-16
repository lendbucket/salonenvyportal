import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SquareClient, SquareEnvironment } from "square"
import { LOCATION_IDS, TEAM_MEMBER_NAMES, TEAM_MEMBER_LOCATIONS, getDateRange } from "@/lib/square-metrics"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

function getLocationIds(location: string): string[] {
  if (location === "CC") return ["LTJSA6QR1HGW6"]
  if (location === "SA") return ["LXJYXDXWR0XZF"]
  return [...LOCATION_IDS]
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const type = req.nextUrl.searchParams.get("type") || "net_sales"
  const period = req.nextUrl.searchParams.get("period") || "today"
  const location = req.nextUrl.searchParams.get("location") || "Both"

  const { startAt, endAt } = getDateRange(period)
  const locationIds = getLocationIds(location === "Corpus Christi" ? "CC" : location === "San Antonio" ? "SA" : location)
  const square = getSquare()

  try {
    if (type === "cancellations") {
      return await handleCancellations(square, startAt, endAt, locationIds)
    }
    return await handleTransactions(square, startAt, endAt, locationIds, type)
  } catch (err: unknown) {
    console.error("[drill-down] Error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load" }, { status: 500 })
  }
}

async function handleTransactions(
  square: SquareClient,
  startAt: string,
  endAt: string,
  locationIds: string[],
  type: string
) {
  // Fetch completed orders
  const ordersRes = await square.orders.search({
    locationIds,
    query: {
      filter: {
        dateTimeFilter: { closedAt: { startAt, endAt } },
        stateFilter: { states: ["COMPLETED"] },
      },
      sort: { sortField: "CLOSED_AT", sortOrder: "DESC" },
    },
    limit: 500,
  })

  // Fetch bookings for stylist attribution
  let bookingsPage = await square.bookings.list({ startAtMin: startAt, startAtMax: endAt, limit: 200 })
  const bookings: { teamMemberId: string; startAt: Date; locationId: string }[] = []
  for (const b of bookingsPage.data) {
    const tmId = b.appointmentSegments?.[0]?.teamMemberId
    if (tmId && b.startAt) bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt), locationId: b.locationId || "" })
  }
  while (bookingsPage.hasNextPage()) {
    bookingsPage = await bookingsPage.getNextPage()
    for (const b of bookingsPage.data) {
      const tmId = b.appointmentSegments?.[0]?.teamMemberId
      if (tmId && b.startAt) bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt), locationId: b.locationId || "" })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions: any[] = []
  let totalRevenue = 0, totalTips = 0, totalTax = 0, totalFees = 0, totalDiscounts = 0
  let cashCount = 0, cardCount = 0
  const usedBookings = new Set<number>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const o of (ordersRes.orders || []) as any[]) {
    const totalAmt = Number(o.totalMoney?.amount || 0) / 100
    const taxAmt = Number(o.totalTaxMoney?.amount || 0) / 100
    const tipAmt = Number(o.totalTipMoney?.amount || 0) / 100
    const discountAmt = Number(o.totalDiscountMoney?.amount || 0) / 100
    const subtotal = totalAmt - taxAmt - tipAmt
    if (subtotal <= 0) continue

    // Payment method from tenders
    const tender = o.tenders?.[0]
    let paymentMethod = "OTHER"
    let last4: string | null = null
    let brand: string | null = null
    if (tender?.type === "CARD" && tender.cardDetails) {
      brand = tender.cardDetails.card?.brand || null
      last4 = tender.cardDetails.card?.last4 || null
      paymentMethod = brand || "CARD"
      cardCount++
    } else if (tender?.type === "CASH") {
      paymentMethod = "CASH"
      cashCount++
    } else {
      cardCount++
    }

    // Processing fee estimate
    const fee = paymentMethod === "CASH" ? 0 : Math.round((subtotal * 0.026 + 0.10) * 100) / 100

    // Stylist attribution via booking match
    const orderTime = new Date(o.closedAt || o.createdAt || "")
    let stylistName = "Unassigned"
    let stylistLoc = o.locationId === "LTJSA6QR1HGW6" ? "CC" : "SA"

    let bestIdx = -1
    let bestDiff = Infinity
    for (let i = 0; i < bookings.length; i++) {
      if (usedBookings.has(i)) continue
      const diffMs = orderTime.getTime() - bookings[i].startAt.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours >= -0.5 && diffHours <= 5 && Math.abs(diffMs) < bestDiff) {
        bestIdx = i
        bestDiff = Math.abs(diffMs)
      }
    }
    if (bestIdx >= 0) {
      usedBookings.add(bestIdx)
      const tmId = bookings[bestIdx].teamMemberId
      stylistName = TEAM_MEMBER_NAMES[tmId] || tmId
      stylistLoc = TEAM_MEMBER_LOCATIONS[tmId] === "Corpus Christi" ? "CC" : "SA"
    }

    // Line items (services)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const services = (o.lineItems || []).map((li: any) => ({
      name: li.name || "Service",
      price: Number(li.totalMoney?.amount || 0) / 100,
    }))

    // Customer info
    let clientName = "Walk-in"
    let clientInitials = "W"
    const customerId = o.customerId || null
    if (customerId) {
      // Try to get from local order data first
      const firstLine = o.lineItems?.[0]
      if (firstLine?.note) clientName = firstLine.note
    }
    // We'll try to batch-resolve customer names below if needed
    if (clientName === "Walk-in" && customerId) {
      try {
        const cRes = await square.customers.get({ customerId })
        const c = cRes.customer
        if (c) {
          clientName = [c.givenName, c.familyName].filter(Boolean).join(" ") || "Walk-in"
        }
      } catch {
        // Customer lookup failed, keep Walk-in
      }
    }
    clientInitials = clientName === "Walk-in" ? "W" : clientName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

    totalRevenue += subtotal
    totalTips += tipAmt
    totalTax += taxAmt
    totalFees += fee
    totalDiscounts += discountAmt

    transactions.push({
      id: o.id,
      time: orderTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }),
      timeRaw: orderTime.toISOString(),
      client: { id: customerId, name: clientName, initials: clientInitials },
      stylist: { name: stylistName, location: stylistLoc },
      services,
      payment: { method: paymentMethod, last4, brand },
      amounts: {
        subtotal: Math.round(subtotal * 100) / 100,
        tip: Math.round(tipAmt * 100) / 100,
        tax: Math.round(taxAmt * 100) / 100,
        discount: Math.round(discountAmt * 100) / 100,
        processingFee: fee,
        total: Math.round(totalAmt * 100) / 100,
      },
    })
  }

  return NextResponse.json({
    type,
    transactions,
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalProcessingFees: Math.round(totalFees * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      netAfterFees: Math.round((totalRevenue - totalFees) * 100) / 100,
      cashTransactions: cashCount,
      cardTransactions: cardCount,
      transactionCount: transactions.length,
    },
  })
}

async function handleCancellations(
  square: SquareClient,
  startAt: string,
  endAt: string,
  locationIds: string[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancellations: any[] = []

  for (const locId of locationIds) {
    let page = await square.bookings.list({
      startAtMin: startAt,
      startAtMax: endAt,
      locationId: locId,
      limit: 200,
    })

    for (const b of page.data) {
      if (b.status !== "CANCELLED_BY_CUSTOMER" && b.status !== "CANCELLED_BY_SELLER") continue
      const tmId = b.appointmentSegments?.[0]?.teamMemberId || ""
      cancellations.push({
        id: b.id,
        clientName: b.customerNote || "Client",
        appointmentTime: b.startAt ? new Date(b.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "",
        appointmentTimeRaw: b.startAt,
        stylist: { name: TEAM_MEMBER_NAMES[tmId] || "Unknown", location: locId === "LTJSA6QR1HGW6" ? "CC" : "SA" },
        service: b.appointmentSegments?.[0]?.serviceVariationId || "Service",
        cancelledBy: b.status === "CANCELLED_BY_CUSTOMER" ? "client" : "salon",
        cancelledAt: b.updatedAt || b.createdAt,
        locationId: locId,
      })
    }

    while (page.hasNextPage()) {
      page = await page.getNextPage()
      for (const b of page.data) {
        if (b.status !== "CANCELLED_BY_CUSTOMER" && b.status !== "CANCELLED_BY_SELLER") continue
        const tmId = b.appointmentSegments?.[0]?.teamMemberId || ""
        cancellations.push({
          id: b.id,
          clientName: b.customerNote || "Client",
          appointmentTime: b.startAt ? new Date(b.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "",
          appointmentTimeRaw: b.startAt,
          stylist: { name: TEAM_MEMBER_NAMES[tmId] || "Unknown", location: locId === "LTJSA6QR1HGW6" ? "CC" : "SA" },
          service: b.appointmentSegments?.[0]?.serviceVariationId || "Service",
          cancelledBy: b.status === "CANCELLED_BY_CUSTOMER" ? "client" : "salon",
          cancelledAt: b.updatedAt || b.createdAt,
          locationId: locId,
        })
      }
    }
  }

  cancellations.sort((a, b) => new Date(b.appointmentTimeRaw || 0).getTime() - new Date(a.appointmentTimeRaw || 0).getTime())

  return NextResponse.json({ type: "cancellations", cancellations })
}
