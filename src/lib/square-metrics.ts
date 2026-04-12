import { SquareClient, SquareEnvironment } from "square"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

export const LOCATION_IDS = ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"] as const

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
  checkoutCount: number
  avgTicket: number
}

export interface LocationMetrics {
  location: string
  revenue: number
  checkoutCount: number
  avgTicket: number
  stylistBreakdown: StylistMetrics[]
  periodStart: string
  periodEnd: string
}

interface BookingEntry {
  teamMemberId: string
  startAt: Date
  locationId: string
}


function getCSTMidnight(date: Date): { start: string; end: string } {
  const cst = date.toLocaleDateString("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
  const [m, d, y] = cst.split("/")
  return {
    start: new Date(`${y}-${m}-${d}T00:00:00-06:00`).toISOString(),
    end: new Date(`${y}-${m}-${d}T23:59:59-06:00`).toISOString(),
  }
}

export function getDateRange(periodType: string) {
  const now = new Date()
  let startDate: Date

  switch (periodType) {
    case "today": {
      const { start, end } = getCSTMidnight(now)
      return { startAt: start, endAt: end }
    }
    case "yesterday": {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const { start, end } = getCSTMidnight(yesterday)
      return { startAt: start, endAt: end }
    }
    case "7days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "90days":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case "week":
      startDate = new Date(now)
      startDate.setDate(now.getDate() - now.getDay())
      startDate.setHours(0, 0, 0, 0)
      break
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  return { startAt: startDate.toISOString(), endAt: now.toISOString() }
}

export async function getMetricsByPeriod(
  periodType: string,
  location?: "Corpus Christi" | "San Antonio"
): Promise<LocationMetrics[]> {
  const { startAt, endAt } = getDateRange(periodType)
  return getMetricsByPeriodWithDates(startAt, endAt, location)
}

export async function getMetricsByPeriodWithDates(
  startAt: string,
  endAt: string,
  location?: "Corpus Christi" | "San Antonio"
): Promise<LocationMetrics[]> {
  const square = getSquare()

  const stylistMetrics: Record<string, StylistMetrics> = {}
  for (const [id, loc] of Object.entries(TEAM_MEMBER_LOCATIONS)) {
    stylistMetrics[id] = {
      teamMemberId: id,
      name: TEAM_MEMBER_NAMES[id],
      homeLocation: loc,
      revenue: 0,
      checkoutCount: 0,
      avgTicket: 0,
    }
  }

  try {
    // Step 1: Get ALL bookings in period (for stylist attribution)
    const bookings: BookingEntry[] = []

    let bookingsPage = await square.bookings.list({
      startAtMin: startAt,
      startAtMax: endAt,
      limit: 200,
    })

    for (const b of bookingsPage.data) {
      const tmId = b.appointmentSegments?.[0]?.teamMemberId
      if (tmId && TEAM_MEMBER_LOCATIONS[tmId] && b.startAt && b.status === "ACCEPTED") {
        bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt), locationId: b.locationId || "" })
      }
    }

    while (bookingsPage.hasNextPage()) {
      bookingsPage = await bookingsPage.getNextPage()
      for (const b of bookingsPage.data) {
        const tmId = b.appointmentSegments?.[0]?.teamMemberId
        if (tmId && TEAM_MEMBER_LOCATIONS[tmId] && b.startAt && b.status === "ACCEPTED") {
          bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt), locationId: b.locationId || "" })
        }
      }
    }

    // Step 2: Get ALL completed orders in period (closed_at for accuracy)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawOrders: any[] = []

    const ordersRes = await square.orders.search({
      locationIds: [...LOCATION_IDS],
      query: {
        filter: {
          dateTimeFilter: { closedAt: { startAt, endAt } },
          stateFilter: { states: ["COMPLETED"] },
        },
        sort: { sortField: "CLOSED_AT", sortOrder: "DESC" },
      },
      limit: 500,
    })

    for (const o of (ordersRes.orders || [])) {
      rawOrders.push(o)
    }

    // Step 2b + 3: Unified attribution — checkout count AND revenue from the same orders
    // Each completed order with net > 0 = 1 checkout + its net revenue, attributed together
    const usedBookings = new Set<number>()
    for (const o of rawOrders) {
      const totalAmt = Number(o.totalMoney?.amount || 0)
      const taxAmt = Number(o.totalTaxMoney?.amount || 0)
      const tipAmt = Number(o.totalTipMoney?.amount || 0)
      const netAmount = (totalAmt - taxAmt - tipAmt) / 100
      if (netAmount <= 0) continue

      const orderTime = new Date(o.closedAt || o.createdAt || "")

      // Find best matching booking (closest time, not already used)
      // Do NOT require same locationId — payments may be processed at either location
      let bestMatch: { index: number; diff: number } | null = null
      for (let i = 0; i < bookings.length; i++) {
        if (usedBookings.has(i)) continue
        const diffMs = orderTime.getTime() - bookings[i].startAt.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (diffHours >= -0.5 && diffHours <= 5) {
          if (!bestMatch || Math.abs(diffMs) < Math.abs(bestMatch.diff)) {
            bestMatch = { index: i, diff: diffMs }
          }
        }
      }

      if (bestMatch) {
        usedBookings.add(bestMatch.index)
        const tmId = bookings[bestMatch.index].teamMemberId
        stylistMetrics[tmId].checkoutCount += 1
        stylistMetrics[tmId].revenue += netAmount
      } else {
        // No booking match — attribute to first available stylist at this location
        const locName = o.locationId === "LTJSA6QR1HGW6" ? "Corpus Christi" : "San Antonio"
        const locStylists = Object.entries(TEAM_MEMBER_LOCATIONS).filter(([, l]) => l === locName)
        if (locStylists.length > 0) {
          stylistMetrics[locStylists[0][0]].checkoutCount += 1
          stylistMetrics[locStylists[0][0]].revenue += netAmount
        }
      }
    }

    // Step 4: Calculate avg tickets (revenue / checkouts)
    for (const m of Object.values(stylistMetrics)) {
      if (m.checkoutCount > 0 && m.revenue > 0) {
        m.avgTicket = Math.round((m.revenue / m.checkoutCount) * 100) / 100
      }
    }

    // Step 5: Aggregate by location
    const ccMetrics: LocationMetrics = {
      location: "Corpus Christi", revenue: 0, checkoutCount: 0, avgTicket: 0,
      stylistBreakdown: [], periodStart: startAt, periodEnd: endAt,
    }
    const saMetrics: LocationMetrics = {
      location: "San Antonio", revenue: 0, checkoutCount: 0, avgTicket: 0,
      stylistBreakdown: [], periodStart: startAt, periodEnd: endAt,
    }

    for (const m of Object.values(stylistMetrics)) {
      const target = m.homeLocation === "Corpus Christi" ? ccMetrics : saMetrics
      target.revenue += m.revenue
      target.checkoutCount += m.checkoutCount
      target.stylistBreakdown.push(m)
    }

    if (ccMetrics.checkoutCount > 0) ccMetrics.avgTicket = Math.round((ccMetrics.revenue / ccMetrics.checkoutCount) * 100) / 100
    if (saMetrics.checkoutCount > 0) saMetrics.avgTicket = Math.round((saMetrics.revenue / saMetrics.checkoutCount) * 100) / 100

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

export async function getComparisonMetrics(
  periodType: string,
  location?: "Corpus Christi" | "San Antonio"
) {
  const now = new Date()
  const current = getDateRange(periodType)

  let prevStartAt: string
  let prevEndAt: string

  switch (periodType) {
    case "today": {
      // Compare to same day last week (7 days ago)
      const prevDay = new Date(now)
      prevDay.setDate(now.getDate() - 7)
      const { start, end } = getCSTMidnight(prevDay)
      prevStartAt = start
      prevEndAt = end
      break
    }
    case "yesterday": {
      // Compare to same day last week (yesterday - 7 = 8 days ago)
      const prevDay = new Date(now)
      prevDay.setDate(now.getDate() - 8)
      const { start, end } = getCSTMidnight(prevDay)
      prevStartAt = start
      prevEndAt = end
      break
    }
    case "7days":
      prevStartAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
      prevEndAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      break
    case "30days":
      prevStartAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
      prevEndAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      break
    case "90days":
      prevStartAt = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()
      prevEndAt = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      break
    case "week": {
      const ws = new Date(now)
      ws.setDate(now.getDate() - now.getDay() - 7)
      ws.setHours(0, 0, 0, 0)
      const we = new Date(now)
      we.setDate(now.getDate() - now.getDay())
      we.setHours(0, 0, 0, 0)
      prevStartAt = ws.toISOString()
      prevEndAt = we.toISOString()
      break
    }
    case "month":
      prevStartAt = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      prevEndAt = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      break
    case "year":
      prevStartAt = new Date(now.getFullYear() - 1, 0, 1).toISOString()
      prevEndAt = new Date(now.getFullYear(), 0, 1).toISOString()
      break
    default:
      prevStartAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
      prevEndAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }

  const [currentMetrics, previousMetrics] = await Promise.all([
    getMetricsByPeriodWithDates(current.startAt, current.endAt, location),
    getMetricsByPeriodWithDates(prevStartAt, prevEndAt, location),
  ])

  return { currentMetrics, previousMetrics, prevStartAt, prevEndAt }
}
