import { SquareClient, SquareEnvironment } from "square"
import { TEAM_MEMBER_NAMES } from "./square-metrics"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

const LOCATION_MAP: Record<string, string> = {
  LTJSA6QR1HGW6: "Corpus Christi",
  LXJYXDXWR0XZF: "San Antonio",
}

const ALL_LOCATION_IDS = ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"]

interface BookingRecord { date: string; stylistId: string; locationId: string }

interface CustomerRetention {
  customerId: string
  customerName: string
  email: string
  phone: string
  totalVisits: number
  ticketCount: number
  firstVisit: string
  lastVisit: string
  totalSpend: number
  avgTicket: number
  minTicket: number
  maxTicket: number
  daysSinceLastVisit: number
  lapsedSegment: string
  preferredStylist: string
  locationName: string
}

export interface RetentionStats {
  totalCustomers: number
  activeCustomers: number
  retentionRate: number
  avgVisitsPerCustomer: number
  oneTimeCustomers: number
  recurringCustomers: number
  lapsedSegments: Record<string, number>
  top20Recurring: CustomerRetention[]
  top5HighestTickets: CustomerRetention[]
  retentionScore: number
  retentionGrade: string
  allCustomers: CustomerRetention[]
  dataNote: string
}

function getLapsedSegment(daysSince: number): string {
  if (daysSince <= 90) return "active"
  if (daysSince <= 180) return "<6mo"
  if (daysSince <= 365) return "<12mo"
  if (daysSince <= 545) return "<18mo"
  if (daysSince <= 730) return "<2yr"
  return "3yr+"
}

function getRetentionGrade(score: number): string {
  if (score >= 95) return "A+"
  if (score >= 90) return "A"
  if (score >= 85) return "A-"
  if (score >= 80) return "B+"
  if (score >= 75) return "B"
  if (score >= 70) return "B-"
  if (score >= 65) return "C+"
  if (score >= 60) return "C"
  if (score >= 55) return "C-"
  if (score >= 50) return "D+"
  if (score >= 45) return "D"
  if (score >= 40) return "D-"
  return "F"
}

export async function getAllRetentionData(
  locationFilter?: "Corpus Christi" | "San Antonio"
): Promise<RetentionStats> {
  const square = getSquare()

  const filterLocationIds = locationFilter
    ? ALL_LOCATION_IDS.filter((id) => LOCATION_MAP[id] === locationFilter)
    : ALL_LOCATION_IDS

  const customerBookings: Record<string, BookingRecord[]> = {}
  const customerOrders: Record<string, number[]> = {}
  const customerNames: Record<string, string> = {}
  const customerEmails: Record<string, string> = {}
  const customerPhones: Record<string, string> = {}

  const now = new Date()
  const DAY = 24 * 60 * 60 * 1000

  // Build 28-day chunks covering 3 years (stays under Square's 31-day limit)
  const chunks: { startAt: string; endAt: string }[] = []
  const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000)
  let chunkStart = new Date(threeYearsAgo)
  while (chunkStart < now) {
    const chunkEnd = new Date(chunkStart)
    chunkEnd.setDate(chunkEnd.getDate() + 28)
    if (chunkEnd > now) chunkEnd.setTime(now.getTime())
    chunks.push({ startAt: chunkStart.toISOString(), endAt: chunkEnd.toISOString() })
    chunkStart = new Date(chunkEnd)
    chunkStart.setSeconds(chunkStart.getSeconds() + 1)
  }

  // Step 1: Fetch bookings in batches of 5 parallel chunks
  const BATCH_SIZE = 5
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(batch.map(async (chunk) => {
      try {
        let page = await square.bookings.list({
          startAtMin: chunk.startAt,
          startAtMax: chunk.endAt,
          limit: 200,
        })
        const processPage = (data: typeof page.data) => {
          for (const b of data) {
            if (b.status !== "ACCEPTED") continue
            if (!b.customerId || !b.startAt) continue
            if (b.locationId && !filterLocationIds.includes(b.locationId)) continue
            if (!customerBookings[b.customerId]) customerBookings[b.customerId] = []
            customerBookings[b.customerId].push({
              date: b.startAt,
              stylistId: b.appointmentSegments?.[0]?.teamMemberId || "unknown",
              locationId: b.locationId || "",
            })
          }
        }
        processPage(page.data)
        while (page.hasNextPage()) {
          page = await page.getNextPage()
          processPage(page.data)
        }
      } catch (e) {
        console.warn("Booking chunk skipped:", chunk.startAt, e instanceof Error ? e.message : e)
      }
    }))
  }

  // Step 1b: Fetch orders in batches of 5 parallel chunks
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(batch.map(async (chunk) => {
      try {
        const res = await square.orders.search({
          locationIds: filterLocationIds,
          query: {
            filter: {
              dateTimeFilter: { createdAt: { startAt: chunk.startAt, endAt: chunk.endAt } },
              stateFilter: { states: ["COMPLETED"] },
            },
          },
          limit: 500,
        })
        for (const o of res.orders || []) {
          if (!o.customerId) continue
          const amount = Number(o.totalMoney?.amount || 0) / 100
          if (amount > 0) {
            if (!customerOrders[o.customerId]) customerOrders[o.customerId] = []
            customerOrders[o.customerId].push(amount)
          }
        }
      } catch (e) {
        console.warn("Order chunk skipped:", chunk.startAt, e instanceof Error ? e.message : e)
      }
    }))
  }

  // Step 2: Fetch top 100 customer details in parallel
  const topIds = Object.entries(customerBookings)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 100)
    .map(([id]) => id)

  await Promise.allSettled(
    topIds.map(async (custId) => {
      try {
        const res = await square.customers.get({ customerId: custId })
        if (res.customer) {
          const c = res.customer
          const name = [c.givenName, c.familyName].filter(Boolean).join(" ")
          if (name) customerNames[custId] = name
          if (c.emailAddress) customerEmails[custId] = c.emailAddress
          if (c.phoneNumber) customerPhones[custId] = c.phoneNumber
        }
      } catch { /* deleted customer */ }
    })
  )

  // Step 3: Build customer metrics
  const customers: CustomerRetention[] = []

  for (const [custId, bookings] of Object.entries(customerBookings)) {
    if (bookings.length === 0) continue

    const dates = bookings.map((b) => new Date(b.date)).sort((a, b) => a.getTime() - b.getTime())
    const firstVisit = dates[0].toISOString()
    const lastVisit = dates[dates.length - 1].toISOString()
    const daysSince = Math.floor((now.getTime() - dates[dates.length - 1].getTime()) / DAY)

    const stylistCounts: Record<string, number> = {}
    for (const b of bookings) stylistCounts[b.stylistId] = (stylistCounts[b.stylistId] || 0) + 1
    const preferredId = Object.entries(stylistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ""

    const locCounts: Record<string, number> = {}
    for (const b of bookings) {
      const n = LOCATION_MAP[b.locationId] || b.locationId
      locCounts[n] = (locCounts[n] || 0) + 1
    }
    const locationName = Object.entries(locCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ""

    const orders = customerOrders[custId] || []
    const totalSpend = orders.reduce((s, a) => s + a, 0)
    const ticketCount = orders.length
    const avgTicket = ticketCount > 0 ? Math.round((totalSpend / ticketCount) * 100) / 100 : 0
    const minTicket = ticketCount > 0 ? Math.round(orders.reduce((m, a) => a < m ? a : m, orders[0]) * 100) / 100 : 0
    const maxTicket = ticketCount > 0 ? Math.round(orders.reduce((m, a) => a > m ? a : m, orders[0]) * 100) / 100 : 0

    customers.push({
      customerId: custId,
      customerName: customerNames[custId] || `Customer ${custId.slice(-6)}`,
      email: customerEmails[custId] || "",
      phone: customerPhones[custId] || "",
      totalVisits: bookings.length,
      ticketCount,
      firstVisit,
      lastVisit,
      totalSpend,
      avgTicket,
      minTicket,
      maxTicket,
      daysSinceLastVisit: daysSince,
      lapsedSegment: getLapsedSegment(daysSince),
      preferredStylist: TEAM_MEMBER_NAMES[preferredId] || preferredId,
      locationName,
    })
  }

  // Step 4: Aggregate stats
  const totalCustomers = customers.length
  const activeCustomers = customers.filter((c) => c.lapsedSegment === "active").length
  const oneTimeCustomers = customers.filter((c) => c.totalVisits === 1).length
  const recurringCustomers = customers.filter((c) => c.totalVisits > 1).length
  const retentionRate = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 1000) / 10 : 0
  const avgVisits = totalCustomers > 0 ? Math.round((customers.reduce((s, c) => s + c.totalVisits, 0) / totalCustomers) * 10) / 10 : 0

  const lapsedSegments: Record<string, number> = { active: 0, "<6mo": 0, "<12mo": 0, "<18mo": 0, "<2yr": 0, "3yr+": 0 }
  for (const c of customers) lapsedSegments[c.lapsedSegment] = (lapsedSegments[c.lapsedSegment] || 0) + 1

  const recurringRatio = totalCustomers > 0 ? recurringCustomers / totalCustomers : 0
  const activeRatio = totalCustomers > 0 ? activeCustomers / totalCustomers : 0
  const visitScore = Math.min(avgVisits / 5, 1)
  const retentionScore = Math.round(activeRatio * 40 + recurringRatio * 35 + visitScore * 25)

  const top20Recurring = [...customers].filter((c) => c.totalVisits > 1).sort((a, b) => b.totalVisits - a.totalVisits).slice(0, 20)
  const top5HighestTickets = [...customers].filter((c) => c.maxTicket > 0).sort((a, b) => b.maxTicket - a.maxTicket).slice(0, 5)

  return {
    totalCustomers,
    activeCustomers,
    retentionRate,
    avgVisitsPerCustomer: avgVisits,
    oneTimeCustomers,
    recurringCustomers,
    lapsedSegments,
    top20Recurring,
    top5HighestTickets,
    retentionScore,
    retentionGrade: getRetentionGrade(retentionScore),
    allCustomers: customers,
    dataNote: "Data covers last 3 years from Square bookings (parallel fetch)",
  }
}
