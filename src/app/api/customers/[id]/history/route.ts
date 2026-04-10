import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SA_LOCATION_ID, TEAM_NAMES } from "@/lib/staff"

const SQ = "https://connect.squareup.com/v2"

async function sq(path: string, options?: RequestInit) {
  const r = await fetch(`${SQ}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN!}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-04-16",
      ...(options?.headers || {}),
    },
  })
  return r.json()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: customerId } = await params

  try {
    // 1. Fetch customer
    const custData = await sq(`/customers/${customerId}`)
    if (custData.errors || !custData.customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    const c = custData.customer
    const customer = {
      id: c.id,
      name: `${c.given_name || ""} ${c.family_name || ""}`.trim() || "Client",
      phone: c.phone_number || "",
      email: c.email_address || "",
      createdAt: c.created_at,
    }

    // 2. Fetch their bookings (up to 50)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBookings: any[] = []
    let bookCursor: string | undefined
    do {
      const p = new URLSearchParams()
      p.set("limit", "50")
      p.set("customer_id", customerId)
      if (bookCursor) p.set("cursor", bookCursor)
      const bData = await sq(`/bookings?${p}`)
      if (bData.bookings) allBookings.push(...bData.bookings)
      bookCursor = bData.cursor
    } while (bookCursor)

    // 3. Fetch orders matching this customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allOrders: any[] = []
    let orderCursor: string | undefined
    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        location_ids: [SA_LOCATION_ID],
        query: {
          filter: {
            customer_filter: { customer_ids: [customerId] },
            state_filter: { states: ["COMPLETED"] },
          },
          sort: { sort_field: "CLOSED_AT", sort_order: "DESC" },
        },
        limit: 50,
      }
      if (orderCursor) body.cursor = orderCursor
      const oData = await sq("/orders/search", { method: "POST", body: JSON.stringify(body) })
      if (oData.orders) allOrders.push(...oData.orders)
      orderCursor = oData.cursor
    } while (orderCursor)

    // Build visits from bookings + orders
    // Map order by date for matching
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ordersByDate: Record<string, any> = {}
    for (const o of allOrders) {
      const d = (o.closed_at || o.created_at || "").slice(0, 10)
      if (d) ordersByDate[d] = o
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visits: any[] = []
    const seenDates = new Set<string>()

    // Bookings as primary visit source
    for (const b of allBookings) {
      const dateStr = (b.start_at || "").slice(0, 10)
      seenDates.add(dateStr)
      const stylistId = b.appointment_segments?.[0]?.team_member_id
      const stylist = stylistId ? (TEAM_NAMES[stylistId] || "Unknown") : "Unknown"
      const services = (b.appointment_segments || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (seg: any) => seg.service_variation_id || "Service"
      )
      const matchedOrder = ordersByDate[dateStr]
      const amount = matchedOrder ? Number(matchedOrder.total_money?.amount || 0) / 100 : 0
      const tips = matchedOrder ? Number(matchedOrder.total_tip_money?.amount || 0) / 100 : 0

      visits.push({
        date: b.start_at,
        stylist,
        services: matchedOrder
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (matchedOrder.line_items || []).map((li: any) => li.name || "Service")
          : services,
        amount,
        tips,
        status: b.status || "UNKNOWN",
      })
    }

    // Orders without bookings
    for (const o of allOrders) {
      const d = (o.closed_at || o.created_at || "").slice(0, 10)
      if (seenDates.has(d)) continue
      visits.push({
        date: o.closed_at || o.created_at,
        stylist: "Walk-in",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        services: (o.line_items || []).map((li: any) => li.name || "Service"),
        amount: Number(o.total_money?.amount || 0) / 100,
        tips: Number(o.total_tip_money?.amount || 0) / 100,
        status: "COMPLETED",
      })
    }

    // Sort most recent first
    visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const totalVisits = visits.length
    const totalSpend = visits.reduce((s, v) => s + v.amount, 0)
    const avgTicket = totalVisits > 0 ? totalSpend / totalVisits : 0
    const lastVisit = visits[0]?.date || null

    return NextResponse.json({
      customer,
      stats: {
        totalVisits,
        totalSpend: Math.round(totalSpend * 100) / 100,
        avgTicket: Math.round(avgTicket * 100) / 100,
        lastVisit,
      },
      visits,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}
