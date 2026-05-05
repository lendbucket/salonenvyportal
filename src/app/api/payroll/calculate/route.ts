import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TEAM_MEMBERS, CC_LOCATION_ID, SA_LOCATION_ID } from "@/lib/payrollUtils"

const SQ = "https://connect.squareup.com/v2"

async function sq(path: string, options?: RequestInit) {
  const r = await fetch(`${SQ}${path}`, { ...options, headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN!}`, "Content-Type": "application/json", "Square-Version": "2025-04-16", ...(options?.headers || {}) } })
  return r.json()
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { locationId, start, end } = await req.json()
  const startDate = new Date(start)
  const endDate = new Date(end)

  // Map abbreviated locationId ("CC"/"SA") to Square location ID for order searches
  const squareLocationId = locationId === "CC" ? CC_LOCATION_ID : locationId === "SA" ? SA_LOCATION_ID : null
  if (!squareLocationId) return NextResponse.json({ error: "Invalid locationId — must be CC or SA" }, { status: 400 })

  const memberIds = Object.entries(TEAM_MEMBERS).filter(([, v]) => v.location === locationId).map(([id]) => id)
  type SD = { name: string; serviceCount: number; serviceSubtotal: number; tips: number }
  const stylistData: Record<string, SD> = {}
  for (const id of memberIds) stylistData[id] = { name: TEAM_MEMBERS[id].name, serviceCount: 0, serviceSubtotal: 0, tips: 0 }

  console.log(`[Payroll] loc=${locationId} period=${start} → ${end} members=${JSON.stringify(memberIds)}`)

  // STEP 1: Build customer → team_member map from bookings (BOTH locations)
  const customerToMember: Record<string, string> = {}
  const wStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const wEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString()

  for (const bLocId of [CC_LOCATION_ID, SA_LOCATION_ID]) {
    let cursor: string | undefined
    do {
      const p = new URLSearchParams({ location_id: bLocId, start_at_min: wStart, start_at_max: wEnd, limit: "100" })
      if (cursor) p.set("cursor", cursor)
      const d = await sq(`/bookings?${p}`)
      cursor = d.cursor
      for (const b of (d.bookings || [])) {
        if (b.status !== "ACCEPTED") continue
        const cid = b.customer_id; const tmid = b.appointment_segments?.[0]?.team_member_id
        if (!cid || !tmid) continue
        if (!memberIds.includes(tmid)) continue
        customerToMember[cid] = tmid
      }
    } while (cursor)
  }

  console.log(`[Payroll] customerToMember: ${Object.keys(customerToMember).length} entries`)

  // STEP 2: Fetch COMPLETED orders closed within period for this location
  let orderCursor: string | undefined
  let totalOrders = 0, matchedOrders = 0

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      location_ids: [squareLocationId],
      query: { filter: { date_time_filter: { closed_at: { start_at: startDate.toISOString(), end_at: endDate.toISOString() } }, state_filter: { states: ["COMPLETED"] } }, sort: { sort_field: "CLOSED_AT", sort_order: "ASC" } },
      limit: 100,
    }
    if (orderCursor) body.cursor = orderCursor

    const data = await sq("/orders/search", { method: "POST", body: JSON.stringify(body) })
    orderCursor = data.cursor

    for (const order of (data.orders || [])) {
      totalOrders++
      const cid = order.customer_id
      if (!cid) continue
      const tmid = customerToMember[cid]
      if (!tmid || !stylistData[tmid]) continue

      // Sum service line items (item_type === "ITEM") — gross_sales_money is pre-tax
      let subtotal = 0, svcCount = 0
      for (const li of (order.line_items || [])) {
        if (li.item_type !== "ITEM") continue
        subtotal += (li.gross_sales_money?.amount || 0) / 100
        svcCount++
      }
      if (subtotal === 0 && svcCount === 0) continue

      const tips = (order.total_tip_money?.amount || 0) / 100
      stylistData[tmid].serviceSubtotal += subtotal
      stylistData[tmid].serviceCount += svcCount
      stylistData[tmid].tips += tips
      matchedOrders++
    }
  } while (orderCursor)

  console.log(`[Payroll] orders: total=${totalOrders} matched=${matchedOrders}`)
  console.log(`[Payroll] data=${JSON.stringify(stylistData)}`)

  // STEP 3: Calculate commissions
  let totalComm = 0, totalTips = 0, totalSvc = 0
  const entries = Object.entries(stylistData).map(([id, d]) => {
    const comm = Math.round(d.serviceSubtotal * 0.40 * 100) / 100
    totalComm += comm; totalTips += d.tips; totalSvc += d.serviceCount
    return { teamMemberId: id, teamMemberName: d.name, locationId, serviceCount: d.serviceCount, serviceSubtotal: Math.round(d.serviceSubtotal * 100) / 100, commission: comm, tips: Math.round(d.tips * 100) / 100, totalPayout: Math.round((comm + d.tips) * 100) / 100 }
  }).sort((a, b) => b.commission - a.commission)

  // STEP 4: Save to DB
  let period = await prisma.payrollPeriod.findFirst({ where: { locationId, periodStart: startDate, periodEnd: endDate } })
  if (period) {
    await prisma.payrollEntry.deleteMany({ where: { periodId: period.id } })
    period = await prisma.payrollPeriod.update({ where: { id: period.id }, data: { totalCommission: Math.round(totalComm * 100) / 100, totalTips: Math.round(totalTips * 100) / 100, totalServices: totalSvc, updatedAt: new Date() } })
  } else {
    period = await prisma.payrollPeriod.create({ data: { locationId, periodStart: startDate, periodEnd: endDate, status: "pending", totalCommission: Math.round(totalComm * 100) / 100, totalTips: Math.round(totalTips * 100) / 100, totalServices: totalSvc } })
  }
  await prisma.payrollEntry.createMany({ data: entries.map(e => ({ ...e, periodId: period!.id })) })
  const result = await prisma.payrollPeriod.findUnique({ where: { id: period.id }, include: { entries: true } })
  return NextResponse.json({ period: result })
}
