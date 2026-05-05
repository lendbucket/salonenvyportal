import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"
import { TEAM_NAMES, TEAM_MEMBER_LOCATIONS, CC_LOCATION_ID, SA_LOCATION_ID, ALL_STAFF } from "@/lib/staff"

const COMMISSION_RATE = 0.40

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

function getPeriodRange(period: string, dateStr: string): { start: Date; end: Date } {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date")
  }

  if (period === "weekly") {
    const day = date.getDay()
    const start = new Date(date)
    start.setDate(date.getDate() - day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    end.setHours(0, 0, 0, 0)
    return { start, end }
  }

  // monthly
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return { start, end }
}

async function getSquareRevenueForStaff(
  staffMemberId: string,
  startAt: string,
  endAt: string
): Promise<{ revenue: number; checkouts: number; servicesSubtotal: number; tips: number }> {
  const square = getSquare()
  const location = TEAM_MEMBER_LOCATIONS[staffMemberId]
  const locationId = location === "Corpus Christi" ? CC_LOCATION_ID : SA_LOCATION_ID

  // Get bookings for this staff member in the period
  const bookingTimes: Date[] = []
  let bookingsPage = await square.bookings.list({
    startAtMin: startAt,
    startAtMax: endAt,
    limit: 200,
  })

  for (const b of bookingsPage.data) {
    const tmId = b.appointmentSegments?.[0]?.teamMemberId
    if (tmId === staffMemberId && b.startAt && b.status === "ACCEPTED") {
      bookingTimes.push(new Date(b.startAt))
    }
  }

  while (bookingsPage.hasNextPage()) {
    bookingsPage = await bookingsPage.getNextPage()
    for (const b of bookingsPage.data) {
      const tmId = b.appointmentSegments?.[0]?.teamMemberId
      if (tmId === staffMemberId && b.startAt && b.status === "ACCEPTED") {
        bookingTimes.push(new Date(b.startAt))
      }
    }
  }

  // Get completed orders
  const ordersRes = await square.orders.search({
    locationIds: [CC_LOCATION_ID, SA_LOCATION_ID],
    query: {
      filter: {
        dateTimeFilter: { closedAt: { startAt, endAt } },
        stateFilter: { states: ["COMPLETED"] },
      },
      sort: { sortField: "CLOSED_AT", sortOrder: "DESC" },
    },
    limit: 500,
  })

  const orders = ordersRes.orders || []
  let revenue = 0
  let checkouts = 0
  let servicesSubtotal = 0
  let tips = 0
  const usedBookings = new Set<number>()

  for (const o of orders) {
    const totalAmt = Number(o.totalMoney?.amount || 0)
    const taxAmt = Number(o.totalTaxMoney?.amount || 0)
    const tipAmt = Number(o.totalTipMoney?.amount || 0)
    const netAmount = (totalAmt - taxAmt - tipAmt) / 100
    if (netAmount <= 0) continue

    const orderTime = new Date(o.closedAt || o.createdAt || "")

    // Match to booking
    let matched = false
    let bestIdx = -1
    let bestDiff = Infinity

    for (let i = 0; i < bookingTimes.length; i++) {
      if (usedBookings.has(i)) continue
      const diffMs = orderTime.getTime() - bookingTimes[i].getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours >= -0.5 && diffHours <= 5) {
        if (Math.abs(diffMs) < bestDiff) {
          bestDiff = Math.abs(diffMs)
          bestIdx = i
        }
      }
    }

    if (bestIdx >= 0) {
      usedBookings.add(bestIdx)
      matched = true
    } else {
      // Check if order has team member via tender
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderTeamMemberId = (o as any).tenders?.[0]?.employeeId
      if (orderTeamMemberId === staffMemberId) {
        matched = true
      }
    }

    if (matched) {
      revenue += netAmount
      checkouts += 1
      tips += tipAmt / 100

      // Calculate services subtotal (line items that are services, not products)
      for (const item of o.lineItems || []) {
        const itemType = item.itemType
        if (itemType !== "GIFT_CARD" && itemType !== "CUSTOM_AMOUNT") {
          const itemTotal = Number(item.totalMoney?.amount || 0) / 100
          const itemDiscount = Number(item.totalDiscountMoney?.amount || 0) / 100
          servicesSubtotal += itemTotal - itemDiscount
        }
      }
    }
  }

  return { revenue, checkouts, servicesSubtotal, tips }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId, role } = session.user as { id: string; role: string }
    const searchParams = req.nextUrl.searchParams
    let staffMemberId = searchParams.get("staffMemberId")
    const period = searchParams.get("period") || "weekly"
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0]

    // STYLIST can only query their own data
    if (role === "STYLIST") {
      const staffMember = await prisma.staffMember.findFirst({
        where: { userId },
      })
      if (!staffMember) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
      }
      const mySquareId = staffMember.squareTeamMemberId ?? staffMember.id
      if (staffMemberId && staffMemberId !== mySquareId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      staffMemberId = mySquareId
    }

    if (!staffMemberId) {
      return NextResponse.json({ error: "staffMemberId is required" }, { status: 400 })
    }

    const staffName = TEAM_NAMES[staffMemberId] || "Unknown"
    const staffLocation = TEAM_MEMBER_LOCATIONS[staffMemberId] || "Unknown"

    const { start, end } = getPeriodRange(period, dateStr)
    const startAt = start.toISOString()
    const endAt = end.toISOString()

    // Get Square revenue data for this staff member
    const squareData = await getSquareRevenueForStaff(staffMemberId, startAt, endAt)

    const avgTicket = squareData.checkouts > 0
      ? Math.round((squareData.revenue / squareData.checkouts) * 100) / 100
      : 0

    const commission = Math.round(squareData.servicesSubtotal * COMMISSION_RATE * 100) / 100

    // Check if PayrollEntry has tip data for this period
    let payrollTips = squareData.tips
    const payrollEntry = await prisma.payrollEntry.findFirst({
      where: {
        teamMemberId: staffMemberId,
        period: {
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
      },
    })
    if (payrollEntry) {
      payrollTips = payrollEntry.tips
    }

    // Get active goals for this staff member in the period
    const goals = await prisma.performanceGoal.findMany({
      where: {
        staffMemberId,
        status: "active",
        periodStart: { lte: end },
        periodEnd: { gte: start },
      },
    })

    const goalsWithProgress = goals.map((g) => ({
      ...g,
      progress: g.targetValue > 0
        ? Math.min(Math.round((g.currentValue / g.targetValue) * 100 * 100) / 100, 100)
        : 0,
      isComplete: g.currentValue >= g.targetValue,
    }))

    // Calculate leaderboard rank
    // Get all staff revenue for the same period to determine rank
    const allStaffRevenues: { staffMemberId: string; revenue: number }[] = []

    // We already have the current staff member's revenue
    allStaffRevenues.push({ staffMemberId, revenue: squareData.revenue })

    // Get revenue for all other active staff
    const otherStaff = ALL_STAFF.filter((s) => s.id !== staffMemberId)
    const otherRevenuePromises = otherStaff.map(async (s) => {
      try {
        const data = await getSquareRevenueForStaff(s.id, startAt, endAt)
        return { staffMemberId: s.id, revenue: data.revenue }
      } catch {
        return { staffMemberId: s.id, revenue: 0 }
      }
    })

    const otherRevenues = await Promise.all(otherRevenuePromises)
    allStaffRevenues.push(...otherRevenues)

    // Sort by revenue DESC and find rank
    allStaffRevenues.sort((a, b) => b.revenue - a.revenue)
    const leaderboardRank = allStaffRevenues.findIndex((s) => s.staffMemberId === staffMemberId) + 1
    const leaderboardTotal = allStaffRevenues.length

    return NextResponse.json({
      staffMemberId,
      staffName,
      staffLocation,
      period,
      periodStart: startAt,
      periodEnd: endAt,
      revenue: Math.round(squareData.revenue * 100) / 100,
      checkouts: squareData.checkouts,
      avgTicket,
      servicesSubtotal: Math.round(squareData.servicesSubtotal * 100) / 100,
      commission,
      tips: Math.round(payrollTips * 100) / 100,
      rebookRate: 0.0, // Placeholder — requires complex calculation
      goals: goalsWithProgress,
      leaderboardRank,
      leaderboardTotal,
    })
  } catch (error) {
    console.error("GET /api/performance/summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
