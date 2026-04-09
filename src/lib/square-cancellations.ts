import { SquareClient, SquareEnvironment } from "square"
import {
  TEAM_MEMBER_NAMES,
  TEAM_MEMBER_LOCATIONS,
  getDateRange,
} from "./square-metrics"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

const CANCELLATION_STATUSES = [
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_SELLER",
  "NO_SHOW",
] as const

type CancellationStatus = (typeof CANCELLATION_STATUSES)[number]

export interface CancellationEntry {
  bookingId: string
  status: CancellationStatus
  scheduledAt: string
  createdAt: string
  customerId: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  isRepeatClient: boolean
  totalPastVisits: number
  lastVisitDate: string | null
  stylistId: string
  stylistName: string
  location: "Corpus Christi" | "San Antonio" | "Unknown"
  locationId: string
}

export interface CancellationStats {
  totalCancellations: number
  cancelledByCustomer: number
  cancelledBySeller: number
  noShows: number
  repeatClientCancellations: number
  newClientCancellations: number
  estimatedRevenueLost: number
  byStylist: Record<string, number>
  byDay: Record<string, number>
}

export interface CancellationData {
  cancellations: CancellationEntry[]
  stats: CancellationStats
}

const LOCATION_ID_MAP: Record<string, "Corpus Christi" | "San Antonio"> = {
  LTJSA6QR1HGW6: "Corpus Christi",
  LXJYXDXWR0XZF: "San Antonio",
}

function getLocationForBooking(
  locationId: string | undefined,
  teamMemberId: string | undefined
): "Corpus Christi" | "San Antonio" | "Unknown" {
  if (locationId && LOCATION_ID_MAP[locationId]) return LOCATION_ID_MAP[locationId]
  if (teamMemberId && TEAM_MEMBER_LOCATIONS[teamMemberId]) return TEAM_MEMBER_LOCATIONS[teamMemberId]
  return "Unknown"
}

export async function getCancellations(
  period: string,
  locationFilter?: string
): Promise<CancellationData> {
  const square = getSquare()
  const { startAt, endAt } = getDateRange(period)

  // Step 1: Get ALL bookings in date range with pagination
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allBookings: any[] = []

  let page = await square.bookings.list({
    startAtMin: startAt,
    startAtMax: endAt,
    limit: 200,
  })

  for (const b of page.data) {
    allBookings.push(b)
  }

  while (page.hasNextPage()) {
    page = await page.getNextPage()
    for (const b of page.data) {
      allBookings.push(b)
    }
  }

  // Step 2: Filter to cancellation statuses
  const cancelled = allBookings.filter((b) =>
    CANCELLATION_STATUSES.includes(b.status as CancellationStatus)
  )

  // Step 3: Optionally filter by location
  let filtered = cancelled
  if (locationFilter && locationFilter !== "Both") {
    const locName =
      locationFilter === "CC"
        ? "Corpus Christi"
        : locationFilter === "SA"
          ? "San Antonio"
          : locationFilter
    filtered = cancelled.filter((b) => {
      const tmId = b.appointmentSegments?.[0]?.teamMemberId
      const loc = getLocationForBooking(b.locationId, tmId)
      return loc === locName
    })
  }

  // Step 4: Collect unique customer IDs
  const customerIds = new Set<string>()
  for (const b of filtered) {
    if (b.customerId) customerIds.add(b.customerId)
  }

  // Step 5: Get historical booking data (2 years back in 30-day chunks) for repeat client detection
  const historicalVisits: Record<string, { count: number; lastDate: string | null }> = {}
  const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
  const now = new Date()

  // Fetch historical data in 30-day chunks
  const chunkMs = 30 * 24 * 60 * 60 * 1000
  const historyPromises: Promise<void>[] = []

  for (
    let chunkStart = twoYearsAgo.getTime();
    chunkStart < now.getTime();
    chunkStart += chunkMs
  ) {
    const chunkEnd = Math.min(chunkStart + chunkMs, now.getTime())
    const csISO = new Date(chunkStart).toISOString()
    const ceISO = new Date(chunkEnd).toISOString()

    historyPromises.push(
      (async () => {
        try {
          let hPage = await square.bookings.list({
            startAtMin: csISO,
            startAtMax: ceISO,
            limit: 200,
          })

          const processBooking = (hb: { customerId?: string | null; status?: string; startAt?: string | null }) => {
            if (
              hb.customerId &&
              customerIds.has(hb.customerId) &&
              hb.status !== "CANCELLED_BY_CUSTOMER" &&
              hb.status !== "CANCELLED_BY_SELLER" &&
              hb.status !== "DECLINED"
            ) {
              if (!historicalVisits[hb.customerId]) {
                historicalVisits[hb.customerId] = { count: 0, lastDate: null }
              }
              historicalVisits[hb.customerId].count += 1
              if (
                hb.startAt &&
                (!historicalVisits[hb.customerId].lastDate ||
                  hb.startAt > historicalVisits[hb.customerId].lastDate!)
              ) {
                historicalVisits[hb.customerId].lastDate = hb.startAt
              }
            }
          }

          for (const hb of hPage.data) processBooking(hb)
          while (hPage.hasNextPage()) {
            hPage = await hPage.getNextPage()
            for (const hb of hPage.data) processBooking(hb)
          }
        } catch (e) {
          console.error("Historical chunk error:", e)
        }
      })()
    )
  }

  // Run history chunks with concurrency limit of 3
  for (let i = 0; i < historyPromises.length; i += 3) {
    await Promise.all(historyPromises.slice(i, i + 3))
  }

  // Step 6: Fetch customer details (up to 100)
  const customerDetails: Record<
    string,
    { name: string; email: string; phone: string }
  > = {}
  const custArray = Array.from(customerIds).slice(0, 100)

  for (let i = 0; i < custArray.length; i += 10) {
    const batch = custArray.slice(i, i + 10)
    await Promise.all(
      batch.map(async (cid) => {
        try {
          const res = await square.customers.get({ customerId: cid })
          const c = res.customer
          if (c) {
            const name = [c.givenName, c.familyName].filter(Boolean).join(" ") || "Unknown"
            customerDetails[cid] = {
              name,
              email: c.emailAddress || "",
              phone: c.phoneNumber || "",
            }
          }
        } catch {
          customerDetails[cid] = { name: "Unknown", email: "", phone: "" }
        }
      })
    )
  }

  // Step 7: Enrich cancellations
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  const cancellations: CancellationEntry[] = filtered.map((b) => {
    const tmId = b.appointmentSegments?.[0]?.teamMemberId || ""
    const cid = b.customerId || null
    const cust = cid ? customerDetails[cid] : null
    const hist = cid ? historicalVisits[cid] : null

    return {
      bookingId: b.id || "",
      status: b.status as CancellationStatus,
      scheduledAt: b.startAt || "",
      createdAt: b.createdAt || "",
      customerId: cid,
      customerName: cust?.name || "Walk-in",
      customerEmail: cust?.email || "",
      customerPhone: cust?.phone || "",
      isRepeatClient: (hist?.count || 0) >= 2,
      totalPastVisits: hist?.count || 0,
      lastVisitDate: hist?.lastDate || null,
      stylistId: tmId,
      stylistName: TEAM_MEMBER_NAMES[tmId] || "Unknown",
      location: getLocationForBooking(b.locationId, tmId),
      locationId: b.locationId || "",
    }
  })

  // Sort by scheduledAt desc
  cancellations.sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  )

  // Step 8: Calculate stats
  const stats: CancellationStats = {
    totalCancellations: cancellations.length,
    cancelledByCustomer: cancellations.filter((c) => c.status === "CANCELLED_BY_CUSTOMER").length,
    cancelledBySeller: cancellations.filter((c) => c.status === "CANCELLED_BY_SELLER").length,
    noShows: cancellations.filter((c) => c.status === "NO_SHOW").length,
    repeatClientCancellations: cancellations.filter((c) => c.isRepeatClient).length,
    newClientCancellations: cancellations.filter((c) => !c.isRepeatClient).length,
    estimatedRevenueLost: 0, // TODO: calculate from actual average ticket data
    byStylist: {},
    byDay: {},
  }

  for (const c of cancellations) {
    stats.byStylist[c.stylistName] = (stats.byStylist[c.stylistName] || 0) + 1
    if (c.scheduledAt) {
      const dayName = dayNames[new Date(c.scheduledAt).getDay()]
      stats.byDay[dayName] = (stats.byDay[dayName] || 0) + 1
    }
  }

  return { cancellations, stats }
}
