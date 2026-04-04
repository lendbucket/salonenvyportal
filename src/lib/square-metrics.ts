import { SquareClient, SquareEnvironment } from "square"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

export const TEAM_MEMBER_LOCATIONS: Record<string, "Corpus Christi" | "San Antonio"> = {
  "TMbc13IBzS8Z43AO": "Corpus Christi",
  "TMaExUyYaWYlvSqh": "Corpus Christi",
  "TMCzd3unwciKEVX7": "Corpus Christi",
  "TMn7kInT8g7Vrgxi": "Corpus Christi",
  "TMMdDDwU8WXpCZ9m": "Corpus Christi",
  "TM_xI40vPph2_Cos": "Corpus Christi",
  "TMMJKxeQuMlMW1Dw": "San Antonio",
  "TM5CjcvcHRXZQ4hP": "San Antonio",
  "TMcc0QbHuUZfgcIB": "San Antonio",
  "TMfFCmgJ5RV-WCBq": "San Antonio",
  "TMk1YstlrnPrKw8p": "San Antonio",
}

export const TEAM_MEMBER_NAMES: Record<string, string> = {
  "TMbc13IBzS8Z43AO": "Clarissa Reyna",
  "TMaExUyYaWYlvSqh": "Alexis Rodriguez",
  "TMCzd3unwciKEVX7": "Kaylie Espinoza",
  "TMn7kInT8g7Vrgxi": "Ashlynn Ochoa",
  "TMMdDDwU8WXpCZ9m": "Jessy Blamey",
  "TM_xI40vPph2_Cos": "Mia Gonzales",
  "TMMJKxeQuMlMW1Dw": "Melissa Cruz",
  "TM5CjcvcHRXZQ4hP": "Madelynn Martinez",
  "TMcc0QbHuUZfgcIB": "Jaylee Jaeger",
  "TMfFCmgJ5RV-WCBq": "Aubree Saldana",
  "TMk1YstlrnPrKw8p": "Kiyara Smith",
}

export interface StylistMetrics {
  teamMemberId: string
  name: string
  homeLocation: string
  revenue: number
  serviceCount: number
  avgTicket: number
}

export interface LocationMetrics {
  location: string
  revenue: number
  serviceCount: number
  avgTicket: number
  stylistBreakdown: StylistMetrics[]
  periodStart: string
  periodEnd: string
}

function getDateRange(periodType: "week" | "month" | "year") {
  const now = new Date()
  let startDate: Date
  if (periodType === "week") {
    startDate = new Date(now)
    startDate.setDate(now.getDate() - now.getDay())
    startDate.setHours(0, 0, 0, 0)
  } else if (periodType === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    startDate = new Date(now.getFullYear(), 0, 1)
  }
  return { startAt: startDate.toISOString(), endAt: now.toISOString() }
}

interface BookingEntry {
  teamMemberId: string
  startAt: Date
  locationId: string
}

interface OrderEntry {
  total: number
  createdAt: Date
  locationId: string
}

export async function getMetricsByPeriod(
  periodType: "week" | "month" | "year",
  location?: "Corpus Christi" | "San Antonio"
): Promise<LocationMetrics[]> {
  const square = getSquare()
  const { startAt, endAt } = getDateRange(periodType)

  const stylistMetrics: Record<string, StylistMetrics> = {}
  for (const [id, loc] of Object.entries(TEAM_MEMBER_LOCATIONS)) {
    stylistMetrics[id] = {
      teamMemberId: id,
      name: TEAM_MEMBER_NAMES[id],
      homeLocation: loc,
      revenue: 0,
      serviceCount: 0,
      avgTicket: 0,
    }
  }

  try {
    // Step 1: Get ALL bookings in period with their times and team members
    const bookings: BookingEntry[] = []

    let bookingsPage = await square.bookings.list({
      startAtMin: startAt,
      startAtMax: endAt,
      limit: 200,
    })

    for (const b of bookingsPage.data) {
      const tmId = b.appointmentSegments?.[0]?.teamMemberId
      if (tmId && TEAM_MEMBER_LOCATIONS[tmId] && b.startAt) {
        bookings.push({
          teamMemberId: tmId,
          startAt: new Date(b.startAt),
          locationId: b.locationId || "",
        })
        stylistMetrics[tmId].serviceCount += 1
      }
    }

    while (bookingsPage.hasNextPage()) {
      bookingsPage = await bookingsPage.getNextPage()
      for (const b of bookingsPage.data) {
        const tmId = b.appointmentSegments?.[0]?.teamMemberId
        if (tmId && TEAM_MEMBER_LOCATIONS[tmId] && b.startAt) {
          bookings.push({
            teamMemberId: tmId,
            startAt: new Date(b.startAt),
            locationId: b.locationId || "",
          })
          stylistMetrics[tmId].serviceCount += 1
        }
      }
    }

    // Step 2: Get ALL completed orders in period
    const orders: OrderEntry[] = []

    const ordersRes = await square.orders.search({
      locationIds: ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"],
      query: {
        filter: {
          dateTimeFilter: { createdAt: { startAt, endAt } },
          stateFilter: { states: ["COMPLETED"] },
        },
      },
      limit: 500,
    })

    for (const o of (ordersRes.orders || [])) {
      const amount = Number(o.totalMoney?.amount || 0) / 100
      if (amount > 0 && o.createdAt) {
        orders.push({
          total: amount,
          createdAt: new Date(o.createdAt),
          locationId: o.locationId || "",
        })
      }
    }

    // Step 3: Match orders to bookings by time proximity
    // For each order, find the booking closest in time
    // Checkout usually happens 30min to 4 hours after booking start
    const usedBookings = new Set<number>()

    for (const order of orders) {
      let bestMatch: { index: number; diff: number } | null = null

      for (let i = 0; i < bookings.length; i++) {
        if (usedBookings.has(i)) continue

        const booking = bookings[i]
        const bookingStart = booking.startAt.getTime()
        const orderTime = order.createdAt.getTime()

        // Order should be created -30min to +5 hours from booking start
        const diffMs = orderTime - bookingStart
        const diffHours = diffMs / (1000 * 60 * 60)

        if (diffHours >= -0.5 && diffHours <= 5) {
          if (!bestMatch || Math.abs(diffMs) < Math.abs(bestMatch.diff)) {
            bestMatch = { index: i, diff: diffMs }
          }
        }
      }

      if (bestMatch) {
        const booking = bookings[bestMatch.index]
        usedBookings.add(bestMatch.index)
        stylistMetrics[booking.teamMemberId].revenue += order.total
      }
    }

    // Step 4: Calculate avg tickets
    for (const m of Object.values(stylistMetrics)) {
      if (m.serviceCount > 0 && m.revenue > 0) {
        m.avgTicket = Math.round((m.revenue / m.serviceCount) * 100) / 100
      }
    }

    // Step 5: Aggregate by location
    const ccMetrics: LocationMetrics = {
      location: "Corpus Christi", revenue: 0, serviceCount: 0, avgTicket: 0,
      stylistBreakdown: [], periodStart: startAt, periodEnd: endAt,
    }
    const saMetrics: LocationMetrics = {
      location: "San Antonio", revenue: 0, serviceCount: 0, avgTicket: 0,
      stylistBreakdown: [], periodStart: startAt, periodEnd: endAt,
    }

    for (const m of Object.values(stylistMetrics)) {
      const target = m.homeLocation === "Corpus Christi" ? ccMetrics : saMetrics
      target.revenue += m.revenue
      target.serviceCount += m.serviceCount
      target.stylistBreakdown.push(m)
    }

    if (ccMetrics.serviceCount > 0) ccMetrics.avgTicket = Math.round((ccMetrics.revenue / ccMetrics.serviceCount) * 100) / 100
    if (saMetrics.serviceCount > 0) saMetrics.avgTicket = Math.round((saMetrics.revenue / saMetrics.serviceCount) * 100) / 100

    ccMetrics.stylistBreakdown.sort((a, b) => b.revenue - a.revenue)
    saMetrics.stylistBreakdown.sort((a, b) => b.revenue - a.revenue)

    if (location === "Corpus Christi") return [ccMetrics]
    if (location === "San Antonio") return [saMetrics]
    return [ccMetrics, saMetrics]

  } catch (error) {
    console.error("Square metrics error:", error)
    return []
  }
}
