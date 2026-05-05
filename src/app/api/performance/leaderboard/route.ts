import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"
import {
  TEAM_NAMES,
  CC_LOCATION_ID,
  SA_LOCATION_ID,
  ALL_STAFF,
} from "@/lib/staff"

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

function maskName(name: string): string {
  if (!name) return "***"
  const parts = name.split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts[parts.length - 1][0]}.`
  }
  return `${name[0]}***`
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId, role } = session.user as { id: string; role: string }
    const searchParams = req.nextUrl.searchParams
    const locationId = searchParams.get("locationId")
    const period = searchParams.get("period") || "weekly"
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0]

    const { start, end } = getPeriodRange(period, dateStr)
    const startAt = start.toISOString()
    const endAt = end.toISOString()

    // Determine which staff to include
    let staffToInclude = ALL_STAFF
    if (locationId) {
      const locationName = locationId === CC_LOCATION_ID ? "Corpus Christi"
        : locationId === SA_LOCATION_ID ? "San Antonio"
        : null
      if (locationName) {
        staffToInclude = ALL_STAFF.filter((s) => s.location === locationName)
      }
    }

    // Get the current user's squareTeamMemberId if they are a STYLIST
    let mySquareId: string | null = null
    if (role === "STYLIST") {
      const staffMember = await prisma.staffMember.findFirst({
        where: { userId },
      })
      mySquareId = staffMember?.squareTeamMemberId ?? null
    }

    const square = getSquare()

    // Get all bookings in the period
    const bookings: { teamMemberId: string; startAt: Date }[] = []
    let bookingsPage = await square.bookings.list({
      startAtMin: startAt,
      startAtMax: endAt,
      limit: 200,
    })

    for (const b of bookingsPage.data) {
      const tmId = b.appointmentSegments?.[0]?.teamMemberId
      if (tmId && TEAM_NAMES[tmId] && b.startAt && b.status === "ACCEPTED") {
        bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt) })
      }
    }

    while (bookingsPage.hasNextPage()) {
      bookingsPage = await bookingsPage.getNextPage()
      for (const b of bookingsPage.data) {
        const tmId = b.appointmentSegments?.[0]?.teamMemberId
        if (tmId && TEAM_NAMES[tmId] && b.startAt && b.status === "ACCEPTED") {
          bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt) })
        }
      }
    }

    // Get all completed orders in the period
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

    // Attribute orders to staff members
    const staffRevenue: Record<string, { revenue: number; checkouts: number }> = {}
    for (const s of staffToInclude) {
      staffRevenue[s.id] = { revenue: 0, checkouts: 0 }
    }

    const usedBookings = new Set<number>()

    for (const o of orders) {
      const totalAmt = Number(o.totalMoney?.amount || 0)
      const taxAmt = Number(o.totalTaxMoney?.amount || 0)
      const tipAmt = Number(o.totalTipMoney?.amount || 0)
      const netAmount = (totalAmt - taxAmt - tipAmt) / 100
      if (netAmount <= 0) continue

      const orderTime = new Date(o.closedAt || o.createdAt || "")

      let bestIdx = -1
      let bestDiff = Infinity

      for (let i = 0; i < bookings.length; i++) {
        if (usedBookings.has(i)) continue
        const diffMs = orderTime.getTime() - bookings[i].startAt.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (diffHours >= -0.5 && diffHours <= 5) {
          if (Math.abs(diffMs) < bestDiff) {
            bestDiff = Math.abs(diffMs)
            bestIdx = i
          }
        }
      }

      let attributedTo: string | null = null

      if (bestIdx >= 0) {
        usedBookings.add(bestIdx)
        attributedTo = bookings[bestIdx].teamMemberId
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orderTeamMemberId = (o as any).tenders?.[0]?.employeeId
        if (orderTeamMemberId && staffRevenue[orderTeamMemberId]) {
          attributedTo = orderTeamMemberId
        }
      }

      if (attributedTo && staffRevenue[attributedTo]) {
        staffRevenue[attributedTo].revenue += netAmount
        staffRevenue[attributedTo].checkouts += 1
      }
    }

    // Build leaderboard
    const leaderboard = staffToInclude.map((s) => {
      const data = staffRevenue[s.id] || { revenue: 0, checkouts: 0 }
      const avgTicket = data.checkouts > 0
        ? Math.round((data.revenue / data.checkouts) * 100) / 100
        : 0

      let displayName: string
      if (role === "STYLIST") {
        // STYLIST sees their own name, others are masked
        displayName = s.id === mySquareId ? s.name : maskName(s.name)
      } else {
        // MANAGER and OWNER see full names
        displayName = s.name
      }

      return {
        staffMemberId: s.id,
        name: displayName,
        location: s.location,
        revenue: Math.round(data.revenue * 100) / 100,
        checkouts: data.checkouts,
        avgTicket,
        isCurrentUser: s.id === mySquareId,
      }
    })

    // Sort by revenue DESC
    leaderboard.sort((a, b) => b.revenue - a.revenue)

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
    }))

    return NextResponse.json({
      period,
      periodStart: startAt,
      periodEnd: endAt,
      locationId: locationId || "all",
      leaderboard: rankedLeaderboard,
    })
  } catch (error) {
    console.error("GET /api/performance/leaderboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
