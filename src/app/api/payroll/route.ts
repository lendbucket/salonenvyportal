import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"
import { CC_LOCATION_ID, SA_LOCATION_ID } from "@/lib/staff"

const LOCATION_IDS = [CC_LOCATION_ID, SA_LOCATION_ID] as const

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

/** Get current Wed-Tue pay period in CST */
function getCurrentPeriod(): { start: string; end: string } {
  const now = new Date()
  const cst = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
  const day = cst.getDay()
  const daysBack = day >= 3 ? day - 3 : day + 4
  const wed = new Date(cst)
  wed.setDate(cst.getDate() - daysBack)
  const tue = new Date(wed)
  tue.setDate(wed.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start: fmt(wed), end: fmt(tue) }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as Record<string, unknown>
  if (user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  let startParam = searchParams.get("start")
  let endParam = searchParams.get("end")

  // Default to current Wed-Tue period
  if (!startParam || !endParam) {
    const current = getCurrentPeriod()
    startParam = current.start
    endParam = current.end
  }

  // Build team members map from DB
  const staffMembers = await prisma.staffMember.findMany({
    where: { isActive: true, squareTeamMemberId: { not: null } },
    select: { squareTeamMemberId: true, fullName: true, location: { select: { name: true } } },
  })

  const TEAM: Record<string, { name: string; location: string }> = {}
  for (const s of staffMembers) {
    if (s.squareTeamMemberId) {
      TEAM[s.squareTeamMemberId] = { name: s.fullName, location: s.location.name }
    }
  }

  const startAt = new Date(`${startParam}T00:00:00-06:00`).toISOString()
  const endAt = new Date(`${endParam}T23:59:59-06:00`).toISOString()
  const square = getSquare()

  try {
    // Fetch bookings in 28-day chunks
    interface BookingEntry { teamMemberId: string; startAt: Date; locationId: string }
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
        if (tmId && TEAM[tmId] && b.startAt && b.status === "ACCEPTED") {
          bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt), locationId: b.locationId || "" })
        }
      }
      while (page.hasNextPage()) {
        page = await page.getNextPage()
        for (const b of page.data) {
          const tmId = b.appointmentSegments?.[0]?.teamMemberId
          if (tmId && TEAM[tmId] && b.startAt && b.status === "ACCEPTED") {
            bookings.push({ teamMemberId: tmId, startAt: new Date(b.startAt), locationId: b.locationId || "" })
          }
        }
      }
      chunkStart = new Date(chunkEnd)
    }

    // Fetch completed orders with pagination
    interface OrderEntry { subtotal: number; tip: number; createdAt: Date; locationId: string }
    const orders: OrderEntry[] = []

    let ordersCursor: string | undefined
    do {
      const ordersRes = await square.orders.search({
        locationIds: [...LOCATION_IDS],
        query: {
          filter: {
            dateTimeFilter: { closedAt: { startAt, endAt } },
            stateFilter: { states: ["COMPLETED"] },
          },
        },
        limit: 500,
        cursor: ordersCursor,
      })

      for (const o of (ordersRes.orders || [])) {
        const totalAmt = Number(o.totalMoney?.amount || 0)
        const taxAmt = Number(o.totalTaxMoney?.amount || 0)
        const tipAmt = Number(o.totalTipMoney?.amount || 0)
        const subtotal = (totalAmt - taxAmt - tipAmt) / 100
        const tip = tipAmt / 100
        if (subtotal > 0 && (o.closedAt || o.createdAt)) {
          orders.push({ subtotal, tip, createdAt: new Date(o.closedAt || o.createdAt!), locationId: o.locationId || "" })
        }
      }
      ordersCursor = ordersRes.cursor || undefined
    } while (ordersCursor)

    // Init stylist data
    const data: Record<string, { services: number; subtotal: number; tips: number }> = {}
    for (const id of Object.keys(TEAM)) data[id] = { services: 0, subtotal: 0, tips: 0 }

    // Count services from bookings
    for (const b of bookings) data[b.teamMemberId].services += 1

    // Match orders to bookings for revenue
    const used = new Set<number>()
    for (const order of orders) {
      let best: { idx: number; diff: number } | null = null
      for (let i = 0; i < bookings.length; i++) {
        if (used.has(i)) continue
        const diffMs = order.createdAt.getTime() - bookings[i].startAt.getTime()
        const diffH = diffMs / 3600000
        if (diffH >= -0.5 && diffH <= 5) {
          if (!best || Math.abs(diffMs) < Math.abs(best.diff)) best = { idx: i, diff: diffMs }
        }
      }
      if (best) {
        used.add(best.idx)
        const tm = bookings[best.idx].teamMemberId
        data[tm].subtotal += order.subtotal
        data[tm].tips += order.tip
      }
    }

    // Build response
    const stylists = Object.entries(TEAM).map(([id, info]) => ({
      teamMemberId: id,
      name: info.name,
      location: info.location,
      services: data[id].services,
      subtotal: Math.round(data[id].subtotal * 100) / 100,
      commission: Math.round(data[id].subtotal * 0.40 * 100) / 100,
      tips: Math.round(data[id].tips * 100) / 100,
      totalPay: Math.round((data[id].subtotal * 0.40 + data[id].tips) * 100) / 100,
    }))

    // Check if period is marked paid
    const periodRecord = await prisma.payrollPeriod.findFirst({
      where: {
        startDate: new Date(startAt),
        endDate: new Date(endAt),
        markedPaidAt: { not: null },
      },
      include: { markedBy: { select: { name: true } } },
    })

    // Compute totals by location
    const cc = stylists.filter(s => s.location === "Corpus Christi")
    const sa = stylists.filter(s => s.location === "San Antonio")
    const sum = (arr: typeof stylists) => arr.reduce((a, s) => ({
      services: a.services + s.services, subtotal: a.subtotal + s.subtotal,
      commission: a.commission + s.commission, tips: a.tips + s.tips,
      totalPay: a.totalPay + s.totalPay,
    }), { services: 0, subtotal: 0, commission: 0, tips: 0, totalPay: 0 })

    return NextResponse.json({
      period: { start: startParam, end: endParam },
      payroll: stylists,
      totals: { cc: sum(cc), sa: sum(sa), combined: sum(stylists) },
      paidInfo: periodRecord ? { paidAt: periodRecord.markedPaidAt, paidBy: periodRecord.markedBy?.name } : null,
    })
  } catch (error) {
    console.error("Payroll API error:", error)
    return NextResponse.json({ error: "Failed to compute payroll" }, { status: 500 })
  }
}
