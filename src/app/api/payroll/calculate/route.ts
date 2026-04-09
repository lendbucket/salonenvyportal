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

  const memberIds = Object.entries(TEAM_MEMBERS).filter(([, v]) => v.location === locationId).map(([id]) => id)
  type SD = { name: string; serviceCount: number; serviceSubtotal: number; tips: number }
  const stylistData: Record<string, SD> = {}
  for (const id of memberIds) stylistData[id] = { name: TEAM_MEMBERS[id].name, serviceCount: 0, serviceSubtotal: 0, tips: 0 }

  console.log(`[Payroll] loc=${locationId} period=${start} → ${end} members=${JSON.stringify(memberIds)}`)

  // STEP 1: Cache service variation prices from Square Catalog
  const priceCache: Record<string, number> = {}
  async function getPrice(varId: string): Promise<number> {
    if (priceCache[varId] !== undefined) return priceCache[varId]
    try {
      const d = await sq(`/catalog/object/${varId}`)
      const p = d.object?.item_variation_data?.price_money?.amount || 0
      priceCache[varId] = p; return p
    } catch { priceCache[varId] = 0; return 0 }
  }

  // STEP 2: Fetch tips per customer from SA payments
  const customerTips: Record<string, number> = {}
  let pCursor: string | undefined
  do {
    const p = new URLSearchParams({ location_id: SA_LOCATION_ID, begin_time: startDate.toISOString(), end_time: endDate.toISOString(), limit: "100", sort_order: "ASC" })
    if (pCursor) p.set("cursor", pCursor)
    const d = await sq(`/payments?${p}`)
    for (const pay of (d.payments || [])) {
      if (pay.status !== "COMPLETED" || !pay.customer_id) continue
      const tips = (pay.tip_money?.amount || 0) / 100
      if (tips > 0) customerTips[pay.customer_id] = (customerTips[pay.customer_id] || 0) + tips
    }
    pCursor = d.cursor
  } while (pCursor)

  console.log(`[Payroll] tips found for ${Object.keys(customerTips).length} customers`)

  // STEP 3: Fetch bookings from BOTH locations, process service catalog prices
  const wStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const wEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString()
  let totalBookings = 0, totalSegments = 0

  for (const bLocId of [CC_LOCATION_ID, SA_LOCATION_ID]) {
    let bCursor: string | undefined
    do {
      const p = new URLSearchParams({ location_id: bLocId, start_at_min: wStart, start_at_max: wEnd, limit: "100" })
      if (bCursor) p.set("cursor", bCursor)
      const d = await sq(`/bookings?${p}`)
      bCursor = d.cursor

      for (const b of (d.bookings || [])) {
        if (b.status !== "ACCEPTED") continue
        const bTime = new Date(b.start_at).getTime()
        if (bTime < startDate.getTime() || bTime > endDate.getTime()) continue
        totalBookings++

        for (const seg of (b.appointment_segments || [])) {
          const tmId = seg.team_member_id
          if (!tmId || !stylistData[tmId]) continue
          const varId = seg.service_variation_id
          if (!varId) continue
          const priceCents = await getPrice(varId)
          stylistData[tmId].serviceSubtotal += priceCents / 100
          stylistData[tmId].serviceCount++
          totalSegments++
        }

        // Attribute tips from payment to first stylist on booking
        const custId = b.customer_id
        if (custId && customerTips[custId]) {
          const firstTm = b.appointment_segments?.[0]?.team_member_id
          if (firstTm && stylistData[firstTm]) {
            stylistData[firstTm].tips += customerTips[custId]
            delete customerTips[custId]
          }
        }
      }
    } while (bCursor)
  }

  console.log(`[Payroll] bookings=${totalBookings} segments=${totalSegments}`)
  console.log(`[Payroll] data=${JSON.stringify(stylistData)}`)

  // STEP 4: Calculate commissions
  let totalComm = 0, totalTips = 0, totalSvc = 0
  const entries = Object.entries(stylistData).map(([id, d]) => {
    const comm = Math.round(d.serviceSubtotal * 0.40 * 100) / 100
    totalComm += comm; totalTips += d.tips; totalSvc += d.serviceCount
    return { teamMemberId: id, teamMemberName: d.name, locationId, serviceCount: d.serviceCount, serviceSubtotal: Math.round(d.serviceSubtotal * 100) / 100, commission: comm, tips: Math.round(d.tips * 100) / 100, totalPayout: Math.round((comm + d.tips) * 100) / 100 }
  }).sort((a, b) => b.commission - a.commission)

  // STEP 5: Save to DB
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
