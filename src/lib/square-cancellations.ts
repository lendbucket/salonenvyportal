import { SquareClient, SquareEnvironment } from "square"
import {
  TEAM_MEMBER_NAMES,
  TEAM_MEMBER_LOCATIONS,
  getDateRange,
} from "./square-metrics"
import { getFullCache } from "./catalogCache"
import { CC_STYLISTS_MAP, SA_STYLISTS_MAP } from "./staff"

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

export interface CustomerProfile {
  id: string
  name: string
  phone: string
  email: string
  address: string
  createdAt: string
  note: string
}

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
  services: string[]
  durationMinutes: number
  cancelledBy: "Customer" | "Salon" | "No Show"
  lostRevenue: number
  updatedAt: string
  customer: CustomerProfile | null
  visitCount: number
}

export interface CancellationStats {
  totalCancellations: number
  cancelledByCustomer: number
  cancelledBySeller: number
  noShows: number
  repeatClientCancellations: number
  newClientCancellations: number
  estimatedRevenueLost: number
  avgTicket: number
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

  // Step 3: Filter by location using stylist maps
  let filtered = cancelled
  if (locationFilter && locationFilter !== "Both") {
    const stylistMap = locationFilter === "CC" ? CC_STYLISTS_MAP
      : locationFilter === "SA" ? SA_STYLISTS_MAP
      : null
    if (stylistMap) {
      filtered = cancelled.filter((b) => {
        const tmId = b.appointmentSegments?.[0]?.teamMemberId
        return tmId && tmId in stylistMap
      })
    }
  }

  // Step 4: Collect unique customer IDs
  const customerIds = new Set<string>()
  for (const b of filtered) {
    if (b.customerId) customerIds.add(b.customerId)
  }

  // Step 5: Get visit counts per customer (ACCEPTED bookings only)
  const visitCounts: Record<string, { count: number; lastDate: string | null }> = {}
  const custArr5 = Array.from(customerIds)

  for (let i = 0; i < custArr5.length; i += 5) {
    const batch = custArr5.slice(i, i + 5)
    await Promise.all(batch.map(async (cid) => {
      try {
        let count = 0
        let lastDate: string | null = null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let bPage: any = await square.bookings.list({ limit: 100 })
        // Square bookings.list doesn't support customer_id filter directly,
        // so we fetch recent bookings and filter client-side
        const processPage = (data: { customerId?: string | null; status?: string; startAt?: string | null }[]) => {
          for (const b of data) {
            if (b.customerId === cid && b.status === "ACCEPTED") {
              count++
              if (b.startAt && (!lastDate || b.startAt > lastDate)) lastDate = b.startAt
            }
          }
        }
        processPage(bPage.data || [])
        // Only paginate up to 3 pages to keep it fast
        let pages = 0
        while (bPage.hasNextPage() && pages < 3) {
          bPage = await bPage.getNextPage()
          processPage(bPage.data || [])
          pages++
        }
        visitCounts[cid] = { count, lastDate }
      } catch {
        visitCounts[cid] = { count: 0, lastDate: null }
      }
    }))
  }

  // Step 6: Fetch full customer profiles (up to 100)
  const customerProfiles: Record<string, CustomerProfile> = {}
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
            const addr = c.address
            const address = addr
              ? [addr.addressLine1, addr.addressLine2, addr.locality, addr.administrativeDistrictLevel1, addr.postalCode].filter(Boolean).join(", ")
              : ""
            customerProfiles[cid] = {
              id: cid,
              name,
              phone: c.phoneNumber || "",
              email: c.emailAddress || "",
              address,
              createdAt: c.createdAt || "",
              note: c.note || "",
            }
          }
        } catch {
          customerProfiles[cid] = { id: cid, name: "Unknown", email: "", phone: "", address: "", createdAt: "", note: "" }
        }
      })
    )
  }

  // Step 6.5: Calculate avg ticket first (needed for lost revenue fallback)
  let avgTicket = 75 // fallback
  try {
    const LOCATION_IDS = ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"]
    const ordersRes = await square.orders.search({
      locationIds: LOCATION_IDS,
      query: {
        filter: {
          dateTimeFilter: { closedAt: { startAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), endAt: new Date().toISOString() } },
          stateFilter: { states: ["COMPLETED"] },
        },
      },
      limit: 200,
    })
    const orders = ordersRes.orders || []
    if (orders.length > 0) {
      const totalRev = orders.reduce((sum, o) => {
        const total = Number(o.totalMoney?.amount || 0)
        const tax = Number(o.totalTaxMoney?.amount || 0)
        const tip = Number(o.totalTipMoney?.amount || 0)
        return sum + (total - tax - tip) / 100
      }, 0)
      const computed = Math.round(totalRev / orders.length)
      if (computed > 0) avgTicket = computed
    }
  } catch {
    // Use fallback
  }

  // Step 6.6: Load catalog cache for service names
  const catalog = getFullCache()

  // Step 7: Enrich cancellations
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const cancelledByMap: Record<string, "Customer" | "Salon" | "No Show"> = {
    CANCELLED_BY_CUSTOMER: "Customer",
    CANCELLED_BY_SELLER: "Salon",
    NO_SHOW: "No Show",
  }

  const fullCatalog = catalog

  const cancellations: CancellationEntry[] = filtered.map((b) => {
    const tmId = b.appointmentSegments?.[0]?.teamMemberId || ""
    const cid = b.customerId || null
    const cust = cid ? customerProfiles[cid] : null
    const hist = cid ? visitCounts[cid] : null

    // Extract services and duration from appointment segments
    const segments = b.appointmentSegments || []
    const services: string[] = []
    let totalDuration = 0
    let totalServicePrice = 0
    for (const seg of segments) {
      const dur = seg.durationMinutes || 0
      totalDuration += dur
      const varId = seg.serviceVariationId
      if (varId && fullCatalog[varId]) {
        services.push(fullCatalog[varId].name)
        totalServicePrice += fullCatalog[varId].price
      } else {
        services.push("Service")
      }
    }

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
      services,
      durationMinutes: totalDuration,
      cancelledBy: cancelledByMap[b.status as string] || "Customer",
      lostRevenue: totalServicePrice > 0 ? Math.round(totalServicePrice * 100) / 100 : avgTicket,
      updatedAt: b.updatedAt || b.createdAt || "",
      customer: cust,
      visitCount: hist?.count || 0,
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
    estimatedRevenueLost: Math.round(cancellations.reduce((sum, c) => sum + c.lostRevenue, 0) * 100) / 100,
    avgTicket,
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
