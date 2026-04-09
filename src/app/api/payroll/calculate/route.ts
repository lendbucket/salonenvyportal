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

  // Which stylists belong to this location tab
  const memberIds = Object.entries(TEAM_MEMBERS).filter(([, v]) => v.location === locationId).map(([id]) => id)
  type SD = { name: string; serviceCount: number; serviceSubtotal: number; tips: number }
  const stylistData: Record<string, SD> = {}
  for (const id of memberIds) stylistData[id] = { name: TEAM_MEMBERS[id].name, serviceCount: 0, serviceSubtotal: 0, tips: 0 }

  console.log(`[Payroll] START loc=${locationId} period=${start} → ${end}`)
  console.log(`[Payroll] members=${JSON.stringify(memberIds)}`)

  // STEP 1: Fetch bookings from the correct location (CC from CC, SA from SA)
  // Widen window ±24h for edge cases
  const bookingLocId = locationId === "CC" ? CC_LOCATION_ID : SA_LOCATION_ID
  const wStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const wEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const customerMap: Record<string, { teamMemberId: string; startAt: number }[]> = {}
  let bCursor: string | undefined
  let totalBookings = 0
  do {
    const p = new URLSearchParams({ location_id: bookingLocId, start_at_min: wStart, start_at_max: wEnd, limit: "100" })
    if (bCursor) p.set("cursor", bCursor)
    const d = await sq(`/bookings?${p}`)
    for (const b of (d.bookings || [])) {
      if (b.status !== "ACCEPTED") continue
      const cid = b.customer_id; const tmid = b.appointment_segments?.[0]?.team_member_id
      if (!cid || !tmid) continue
      if (!memberIds.includes(tmid)) continue // Only track this team's stylists
      if (!customerMap[cid]) customerMap[cid] = []
      customerMap[cid].push({ teamMemberId: tmid, startAt: new Date(b.start_at).getTime() })
      totalBookings++
    }
    bCursor = d.cursor
  } while (bCursor)

  console.log(`[Payroll] bookings=${totalBookings} customers=${Object.keys(customerMap).length}`)

  // STEP 2: Fetch completed payments from SA location (all payments go through SA)
  let pCursor: string | undefined
  let totalPay = 0, matched = 0, noCustomer = 0, noBooking = 0
  do {
    const p = new URLSearchParams({ location_id: SA_LOCATION_ID, begin_time: startDate.toISOString(), end_time: endDate.toISOString(), limit: "100", sort_order: "ASC" })
    if (pCursor) p.set("cursor", pCursor)
    const d = await sq(`/payments?${p}`)
    for (const pay of (d.payments || [])) {
      if (pay.status !== "COMPLETED") continue
      totalPay++
      const cid = pay.customer_id
      if (!cid) { noCustomer++; continue }
      const bookings = customerMap[cid]
      if (!bookings || bookings.length === 0) { noBooking++; continue }

      const payTime = new Date(pay.created_at).getTime()
      // Find booking closest to payment within 48h window (service usually before payment)
      const eligible = bookings.filter(b => Math.abs(b.startAt - payTime) < 48 * 60 * 60 * 1000)
      if (eligible.length === 0) { noBooking++; continue }
      const tmid = eligible.sort((a, b) => Math.abs(a.startAt - payTime) - Math.abs(b.startAt - payTime))[0].teamMemberId
      if (!stylistData[tmid]) continue

      stylistData[tmid].serviceSubtotal += (pay.amount_money?.amount || 0) / 100
      stylistData[tmid].tips += (pay.tip_money?.amount || 0) / 100
      stylistData[tmid].serviceCount++
      matched++
    }
    pCursor = d.cursor
  } while (pCursor)

  console.log(`[Payroll] payments=${totalPay} matched=${matched} noCustomer=${noCustomer} noBooking=${noBooking}`)
  console.log(`[Payroll] data=${JSON.stringify(stylistData)}`)

  // STEP 3: Calculate commissions
  let totalComm = 0, totalTips = 0, totalSvc = 0
  const entries = Object.entries(stylistData).map(([id, d]) => {
    const comm = Math.round(d.serviceSubtotal * 0.40 * 100) / 100
    totalComm += comm; totalTips += d.tips; totalSvc += d.serviceCount
    return { teamMemberId: id, teamMemberName: d.name, locationId, serviceCount: d.serviceCount, serviceSubtotal: Math.round(d.serviceSubtotal * 100) / 100, commission: comm, tips: Math.round(d.tips * 100) / 100, totalPayout: Math.round((comm + d.tips) * 100) / 100 }
  }).sort((a, b) => b.commission - a.commission)

  // STEP 4: Upsert to DB
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
