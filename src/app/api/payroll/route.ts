import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SquareClient, SquareEnvironment } from "square"

const LOCATION_IDS = ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"] as const

const TEAM_MEMBERS: Record<string, { name: string; location: "Corpus Christi" | "San Antonio" }> = {
  "TMbc13IBzS8Z43AO": { name: "Clarissa Reyna", location: "Corpus Christi" },
  "TMaExUyYaWYlvSqh": { name: "Alexis Rodriguez", location: "Corpus Christi" },
  "TMCzd3unwciKEVX7": { name: "Kaylie Espinoza", location: "Corpus Christi" },
  "TMn7kInT8g7Vrgxi": { name: "Ashlynn Ochoa", location: "Corpus Christi" },
  "TMMdDDwU8WXpCZ9m": { name: "Jessy Blamey", location: "Corpus Christi" },
  "TM_xI40vPph2_Cos": { name: "Mia Gonzales", location: "Corpus Christi" },
  "TMMJKxeQuMlMW1Dw": { name: "Melissa Cruz", location: "San Antonio" },
  "TM5CjcvcHRXZQ4hP": { name: "Madelynn Martinez", location: "San Antonio" },
  "TMcc0QbHuUZfgcIB": { name: "Jaylee Jaeger", location: "San Antonio" },
  "TMfFCmgJ5RV-WCBq": { name: "Aubree Saldana", location: "San Antonio" },
  "TMk1YstlrnPrKw8p": { name: "Kiyara Smith", location: "San Antonio" },
}

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

interface BookingEntry {
  teamMemberId: string
  startAt: Date
  locationId: string
}

interface OrderEntry {
  total: number
  tip: number
  createdAt: Date
  locationId: string
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user as Record<string, unknown>
  if (user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const startParam = searchParams.get("start")
  const endParam = searchParams.get("end")

  if (!startParam || !endParam) {
    return NextResponse.json({ error: "start and end query params required (YYYY-MM-DD)" }, { status: 400 })
  }

  const startAt = new Date(`${startParam}T00:00:00-06:00`).toISOString()
  const endAt = new Date(`${endParam}T23:59:59-06:00`).toISOString()

  const square = getSquare()

  try {
    // Step 1: Fetch bookings in 28-day chunks
    const bookings: BookingEntry[] = []
    const startDate = new Date(startAt)
    const endDate = new Date(endAt)

    let chunkStart = new Date(startDate)
    while (chunkStart < endDate) {
      const chunkEnd = new Date(chunkStart)
      chunkEnd.setDate(chunkEnd.getDate() + 28)
      if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime())

      let page = await square.bookings.list({
        startAtMin: chunkStart.toISOString(),
        startAtMax: chunkEnd.toISOString(),
        limit: 200,
      })

      for (const b of page.data) {
        const tmId = b.appointmentSegments?.[0]?.teamMemberId
        if (tmId && TEAM_MEMBERS[tmId] && b.startAt && b.status === "ACCEPTED") {
          bookings.push({
            teamMemberId: tmId,
            startAt: new Date(b.startAt),
            locationId: b.locationId || "",
          })
        }
      }

      while (page.hasNextPage()) {
        page = await page.getNextPage()
        for (const b of page.data) {
          const tmId = b.appointmentSegments?.[0]?.teamMemberId
          if (tmId && TEAM_MEMBERS[tmId] && b.startAt && b.status === "ACCEPTED") {
            bookings.push({
              teamMemberId: tmId,
              startAt: new Date(b.startAt),
              locationId: b.locationId || "",
            })
          }
        }
      }

      chunkStart = new Date(chunkEnd)
    }

    // Step 2: Fetch completed orders
    const orders: OrderEntry[] = []

    const ordersRes = await square.orders.search({
      locationIds: [...LOCATION_IDS],
      query: {
        filter: {
          dateTimeFilter: { createdAt: { startAt, endAt } },
          stateFilter: { states: ["COMPLETED"] },
        },
      },
      limit: 500,
    })

    for (const o of (ordersRes.orders || [])) {
      const totalAmt = Number(o.totalMoney?.amount || 0)
      const taxAmt = Number(o.totalTaxMoney?.amount || 0)
      const tipAmt = Number(o.totalTipMoney?.amount || 0)
      const subtotal = (totalAmt - taxAmt - tipAmt) / 100
      const tip = tipAmt / 100
      if (subtotal > 0 && o.createdAt) {
        orders.push({
          total: subtotal,
          tip,
          createdAt: new Date(o.createdAt),
          locationId: o.locationId || "",
        })
      }
    }

    // Step 3: Match orders to bookings by time proximity (within 4 hours)
    const stylistData: Record<string, { services: number; subtotal: number; tips: number }> = {}
    for (const id of Object.keys(TEAM_MEMBERS)) {
      stylistData[id] = { services: 0, subtotal: 0, tips: 0 }
    }

    // Count services from bookings
    for (const b of bookings) {
      stylistData[b.teamMemberId].services += 1
    }

    // Match orders to bookings for revenue attribution
    const usedBookings = new Set<number>()
    for (const order of orders) {
      let bestMatch: { index: number; diff: number } | null = null
      for (let i = 0; i < bookings.length; i++) {
        if (usedBookings.has(i)) continue
        const diffMs = order.createdAt.getTime() - bookings[i].startAt.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (diffHours >= -0.5 && diffHours <= 4) {
          if (!bestMatch || Math.abs(diffMs) < Math.abs(bestMatch.diff)) {
            bestMatch = { index: i, diff: diffMs }
          }
        }
      }
      if (bestMatch) {
        usedBookings.add(bestMatch.index)
        const tmId = bookings[bestMatch.index].teamMemberId
        stylistData[tmId].subtotal += order.total
        stylistData[tmId].tips += order.tip
      }
    }

    // Step 4: Build payroll response
    const payroll = Object.entries(TEAM_MEMBERS).map(([id, info]) => ({
      teamMemberId: id,
      name: info.name,
      location: info.location,
      services: stylistData[id].services,
      subtotal: Math.round(stylistData[id].subtotal * 100) / 100,
      commission: Math.round(stylistData[id].subtotal * 0.40 * 100) / 100,
      tips: Math.round(stylistData[id].tips * 100) / 100,
      totalPay: Math.round((stylistData[id].subtotal * 0.40 + stylistData[id].tips) * 100) / 100,
      periodStart: startParam,
      periodEnd: endParam,
    }))

    return NextResponse.json({ payroll })
  } catch (error) {
    console.error("Payroll API error:", error)
    return NextResponse.json({ error: "Failed to compute payroll" }, { status: 500 })
  }
}
