import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const SQ = "https://connect.squareup.com/v2"

async function sq(path: string) {
  const r = await fetch(`${SQ}${path}`, { headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN!}`, "Content-Type": "application/json", "Square-Version": "2025-04-16" } })
  return r.json()
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const CC = "LTJSA6QR1HGW6"
  const SA = "LXJYXDXWR0XZF"
  const CC_MEMBERS = ["TMbc13IBzS8Z43AO", "TMaExUyYaWYlvSqh", "TMCzd3unwciKEVX7", "TMn7kInT8g7Vrgxi", "TMMdDDwU8WXpCZ9m", "TM_xI40vPph2_Cos"]

  // Fetch CC bookings for wide April window
  const ccBookings = await sq(`/bookings?location_id=${CC}&start_at_min=2026-03-31T05:00:00Z&start_at_max=2026-04-16T05:00:00Z&limit=50`)

  // Fetch SA payments for April 1-14
  const saPayments = await sq(`/payments?location_id=${SA}&begin_time=2026-04-01T05:00:00Z&end_time=2026-04-15T04:59:59Z&limit=20`)

  // Build CC customer map
  const ccCustMap: Record<string, string> = {}
  for (const b of (ccBookings.bookings || [])) {
    if (b.status !== "ACCEPTED") continue
    const tm = b.appointment_segments?.[0]?.team_member_id
    if (tm && CC_MEMBERS.includes(tm) && b.customer_id) ccCustMap[b.customer_id] = tm
  }

  const payments = saPayments.payments || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matched = payments.filter((p: any) => p.customer_id && ccCustMap[p.customer_id])

  return NextResponse.json({
    ccBookingsTotal: (ccBookings.bookings || []).length,
    ccBookingsError: ccBookings.errors || null,
    ccAcceptedWithCCStylist: Object.keys(ccCustMap).length,
    ccCustomerIds: Object.keys(ccCustMap).slice(0, 10),
    saPaymentsTotal: payments.length,
    saPaymentsError: saPayments.errors || null,
    matchedToCC: matched.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchedPayments: matched.slice(0, 5).map((p: any) => ({
      id: p.id, customerId: p.customer_id, stylist: ccCustMap[p.customer_id],
      amount: p.amount_money?.amount, tips: p.tip_money?.amount, created: p.created_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    samplePayments: payments.slice(0, 5).map((p: any) => ({
      customerId: p.customer_id, amount: p.amount_money?.amount, status: p.status, created: p.created_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sampleBookings: (ccBookings.bookings || []).slice(0, 5).map((b: any) => ({
      customerId: b.customer_id, status: b.status, teamMemberId: b.appointment_segments?.[0]?.team_member_id, startAt: b.start_at,
    })),
  })
}
