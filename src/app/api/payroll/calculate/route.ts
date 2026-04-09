import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TEAM_MEMBERS, SA_LOCATION_ID } from "@/lib/payrollUtils"

const SQ = "https://connect.squareup.com/v2"
const TOKEN = () => process.env.SQUARE_ACCESS_TOKEN!

async function sq(path: string, opts?: RequestInit) {
  const r = await fetch(`${SQ}${path}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json", "Square-Version": "2025-04-16", ...(opts?.headers || {}) } })
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
  // ALL payments come from SA location regardless of CC/SA payroll tab
  const sqLocId = SA_LOCATION_ID

  // Get stylist IDs for the requested location
  const memberIds = Object.entries(TEAM_MEMBERS).filter(([, v]) => v.location === locationId).map(([id]) => id)
  const stylistData: Record<string, { name: string; serviceCount: number; serviceSubtotal: number; tips: number }> = {}
  for (const id of memberIds) stylistData[id] = { name: TEAM_MEMBERS[id].name, serviceCount: 0, serviceSubtotal: 0, tips: 0 }

  console.log("[Payroll] locationId:", locationId, "sqLocId:", sqLocId)
  console.log("[Payroll] memberIds:", memberIds)
  console.log("[Payroll] period:", startDate.toISOString(), "→", endDate.toISOString())

  // STEP 1: Fetch all ACCEPTED bookings with WIDER window (±24h for edge cases)
  const custBookings: Record<string, { teamMemberId: string; startAt: string }[]> = {}
  const bookingStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
  const bookingEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
  let bCursor: string | undefined
  do {
    const p = new URLSearchParams({ location_id: sqLocId, start_at_min: bookingStart.toISOString(), start_at_max: bookingEnd.toISOString(), limit: "100" })
    if (bCursor) p.set("cursor", bCursor)
    const d = await sq(`/bookings?${p}`)
    for (const b of (d.bookings || [])) {
      if (b.status !== "ACCEPTED") continue
      const cid = b.customer_id; const tmid = b.appointment_segments?.[0]?.team_member_id
      if (!cid || !tmid) continue
      if (!custBookings[cid]) custBookings[cid] = []
      custBookings[cid].push({ teamMemberId: tmid, startAt: b.start_at })
    }
    bCursor = d.cursor
  } while (bCursor)

  console.log("[Payroll] total unique customers with bookings:", Object.keys(custBookings).length)
  console.log("[Payroll] total booking entries:", Object.values(custBookings).reduce((s, a) => s + a.length, 0))

  // STEP 2: Fetch all COMPLETED payments → match to stylist via customer_id → booking
  let paymentCount = 0, matchedCount = 0, skippedNoCustomer = 0, skippedNoBooking = 0, skippedWrongTeam = 0
  let pCursor: string | undefined
  do {
    const p = new URLSearchParams({ location_id: sqLocId, begin_time: startDate.toISOString(), end_time: endDate.toISOString(), limit: "100", sort_order: "ASC" })
    if (pCursor) p.set("cursor", pCursor)
    const d = await sq(`/payments?${p}`)
    for (const pay of (d.payments || [])) {
      if (pay.status !== "COMPLETED") continue
      paymentCount++

      // FIX 1: Strict date guard — exclude anything outside the exact period
      const paymentTime = new Date(pay.created_at).getTime()
      if (paymentTime < startDate.getTime() || paymentTime > endDate.getTime()) continue

      const cid = pay.customer_id
      if (!cid) { skippedNoCustomer++; continue }

      // FIX 3: Only consider bookings within 24h BEFORE the payment (service before payment)
      const eligibleBookings = (custBookings[cid] || []).filter(b => {
        const bt = new Date(b.startAt).getTime()
        return bt <= paymentTime && bt >= paymentTime - 24 * 60 * 60 * 1000
      })
      if (eligibleBookings.length === 0) { skippedNoBooking++; continue }

      // Find closest eligible booking to payment time
      let tmid: string
      if (eligibleBookings.length === 1) { tmid = eligibleBookings[0].teamMemberId }
      else {
        tmid = eligibleBookings.reduce((prev, curr) => Math.abs(new Date(curr.startAt).getTime() - paymentTime) < Math.abs(new Date(prev.startAt).getTime() - paymentTime) ? curr : prev).teamMemberId
      }

      if (!stylistData[tmid]) { skippedWrongTeam++; continue } // Not in this location's team
      matchedCount++

      stylistData[tmid].serviceSubtotal += (pay.amount_money?.amount || 0) / 100
      stylistData[tmid].tips += (pay.tip_money?.amount || 0) / 100
      stylistData[tmid].serviceCount += 1
    }
    pCursor = d.cursor
  } while (pCursor)

  console.log("[Payroll] payments total:", paymentCount, "matched:", matchedCount, "noCustomer:", skippedNoCustomer, "noBooking:", skippedNoBooking, "wrongTeam:", skippedWrongTeam)
  console.log("[Payroll] stylistData:", JSON.stringify(stylistData, null, 2))

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
