import { SquareClient, SquareEnvironment } from "square"
import { LOCATION_IDS, TEAM_MEMBER_NAMES } from "./square-metrics"

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

interface BookingRecord {
  date: string
  stylistId: string
  locationId: string
}

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
}

function getDateChunks(yearsBack: number): { startAt: string; endAt: string }[] {
  const now = new Date()
  const start = new Date(now)
  start.setFullYear(start.getFullYear() - yearsBack)

  const chunks: { startAt: string; endAt: string }[] = []
  let current = new Date(start)

  while (current < now) {
    const chunkEnd = new Date(current)
    chunkEnd.setDate(chunkEnd.getDate() + 30)
    if (chunkEnd > now) chunkEnd.setTime(now.getTime())

    chunks.push({
      startAt: current.toISOString(),
      endAt: chunkEnd.toISOString(),
    })

    current = new Date(chunkEnd)
  }

  return chunks
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
  const chunks = getDateChunks(3)

  // Filter location IDs based on filter
  const filterLocationIds = locationFilter
    ? LOCATION_IDS.filter((id) => LOCATION_MAP[id] === locationFilter)
    : [...LOCATION_IDS]

  // Step 1: Collect all bookings by customer
  const customerBookings: Record<string, BookingRecord[]> = {}
  const customerNames: Record<string, string> = {}
  const customerEmails: Record<string, string> = {}
  const customerPhones: Record<string, string> = {}

  for (const chunk of chunks) {
    try {
      let page = await square.bookings.list({
        startAtMin: chunk.startAt,
        startAtMax: chunk.endAt,
        limit: 200,
      })

      const processBookings = (data: typeof page.data) => {
        for (const b of data) {
          if (b.status !== "ACCEPTED") continue
          if (!b.customerId || !b.startAt) continue
          if (filterLocationIds.length > 0 && b.locationId && !filterLocationIds.includes(b.locationId as typeof LOCATION_IDS[number])) continue

          const stylistId = b.appointmentSegments?.[0]?.teamMemberId || "unknown"
          if (!customerBookings[b.customerId]) {
            customerBookings[b.customerId] = []
          }
          customerBookings[b.customerId].push({
            date: b.startAt,
            stylistId,
            locationId: b.locationId || "",
          })

          // Use customer name from booking if available
          if (b.customerNote) {
            // customerNote may not have name; we track ID
          }
        }
      }

      processBookings(page.data)

      while (page.hasNextPage()) {
        page = await page.getNextPage()
        processBookings(page.data)
      }
    } catch (err) {
      console.error("Booking chunk error:", err)
    }
  }

  // Step 2: Get customer spend from orders — store individual amounts
  const customerOrders: Record<string, number[]> = {}

  for (const chunk of chunks) {
    try {
      const ordersRes = await square.orders.search({
        locationIds: filterLocationIds as unknown as string[],
        query: {
          filter: {
            dateTimeFilter: { createdAt: { startAt: chunk.startAt, endAt: chunk.endAt } },
            stateFilter: { states: ["COMPLETED"] },
          },
        },
        limit: 500,
      })

      for (const o of ordersRes.orders || []) {
        const custId = o.customerId
        if (!custId) continue
        const amount = Number(o.totalMoney?.amount || 0) / 100
        if (amount > 0) {
          if (!customerOrders[custId]) customerOrders[custId] = []
          customerOrders[custId].push(amount)
        }
      }
    } catch (err) {
      console.error("Orders chunk error:", err)
    }
  }

  // Step 3: Fetch customer details for top customers
  const allCustomerIds = Object.keys(customerBookings)
  const topCustomerIds = allCustomerIds
    .sort((a, b) => (customerBookings[b]?.length || 0) - (customerBookings[a]?.length || 0))
    .slice(0, 100)

  for (const custId of topCustomerIds) {
    try {
      const res = await square.customers.get({ customerId: custId })
      if (res.customer) {
        const c = res.customer
        const name = [c.givenName, c.familyName].filter(Boolean).join(" ")
        if (name) customerNames[custId] = name
        if (c.emailAddress) customerEmails[custId] = c.emailAddress
        if (c.phoneNumber) customerPhones[custId] = c.phoneNumber
      }
    } catch {
      // Customer may have been deleted
    }
  }

  // Step 4: Calculate per-customer metrics
  const now = new Date()
  const customers: CustomerRetention[] = []

  for (const [custId, bookings] of Object.entries(customerBookings)) {
    if (bookings.length === 0) continue

    const dates = bookings.map((b) => new Date(b.date)).sort((a, b) => a.getTime() - b.getTime())
    const firstVisit = dates[0].toISOString()
    const lastVisit = dates[dates.length - 1].toISOString()
    const daysSinceLastVisit = Math.floor(
      (now.getTime() - dates[dates.length - 1].getTime()) / (1000 * 60 * 60 * 24)
    )

    // Preferred stylist
    const stylistCounts: Record<string, number> = {}
    for (const b of bookings) {
      stylistCounts[b.stylistId] = (stylistCounts[b.stylistId] || 0) + 1
    }
    const preferredStylistId = Object.entries(stylistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ""
    const preferredStylist = TEAM_MEMBER_NAMES[preferredStylistId] || preferredStylistId

    // Location
    const locationCounts: Record<string, number> = {}
    for (const b of bookings) {
      const locName = LOCATION_MAP[b.locationId] || b.locationId
      locationCounts[locName] = (locationCounts[locName] || 0) + 1
    }
    const locationName = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ""

    const orders = customerOrders[custId] || []
    const totalSpend = orders.reduce((sum, a) => sum + a, 0)
    const ticketCount = orders.length
    const avgTicket = ticketCount > 0 ? Math.round((totalSpend / ticketCount) * 100) / 100 : 0
    const minTicket = ticketCount > 0 ? Math.round(Math.min(...orders) * 100) / 100 : 0
    const maxTicket = ticketCount > 0 ? Math.round(Math.max(...orders) * 100) / 100 : 0
    const totalVisits = bookings.length

    customers.push({
      customerId: custId,
      customerName: customerNames[custId] || `Customer ${custId.slice(-6)}`,
      email: customerEmails[custId] || "",
      phone: customerPhones[custId] || "",
      totalVisits,
      ticketCount,
      firstVisit,
      lastVisit,
      totalSpend,
      avgTicket,
      minTicket,
      maxTicket,
      daysSinceLastVisit,
      lapsedSegment: getLapsedSegment(daysSinceLastVisit),
      preferredStylist,
      locationName,
    })
  }

  // Step 5: Aggregate stats
  const totalCustomers = customers.length
  const activeCustomers = customers.filter((c) => c.lapsedSegment === "active").length
  const oneTimeCustomers = customers.filter((c) => c.totalVisits === 1).length
  const recurringCustomers = customers.filter((c) => c.totalVisits > 1).length
  const retentionRate = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100 * 10) / 10 : 0
  const avgVisitsPerCustomer =
    totalCustomers > 0
      ? Math.round((customers.reduce((sum, c) => sum + c.totalVisits, 0) / totalCustomers) * 10) / 10
      : 0

  const lapsedSegments: Record<string, number> = {
    active: 0,
    "<6mo": 0,
    "<12mo": 0,
    "<18mo": 0,
    "<2yr": 0,
    "3yr+": 0,
  }
  for (const c of customers) {
    lapsedSegments[c.lapsedSegment] = (lapsedSegments[c.lapsedSegment] || 0) + 1
  }

  const top20Recurring = [...customers]
    .filter((c) => c.totalVisits > 1)
    .sort((a, b) => b.totalVisits - a.totalVisits)
    .slice(0, 20)

  const top5HighestTickets = [...customers]
    .filter((c) => c.maxTicket > 0)
    .sort((a, b) => b.maxTicket - a.maxTicket)
    .slice(0, 5)

  // Retention score: weighted combination
  const recurringRatio = totalCustomers > 0 ? recurringCustomers / totalCustomers : 0
  const activeRatio = totalCustomers > 0 ? activeCustomers / totalCustomers : 0
  const visitScore = Math.min(avgVisitsPerCustomer / 5, 1)

  const retentionScore = Math.round(
    activeRatio * 40 + recurringRatio * 35 + visitScore * 25
  )
  const retentionGrade = getRetentionGrade(retentionScore)

  return {
    totalCustomers,
    activeCustomers,
    retentionRate,
    avgVisitsPerCustomer,
    oneTimeCustomers,
    recurringCustomers,
    lapsedSegments,
    top20Recurring,
    top5HighestTickets,
    retentionScore,
    retentionGrade,
    allCustomers: customers,
  }
}
