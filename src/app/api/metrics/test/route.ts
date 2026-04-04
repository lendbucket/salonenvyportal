import { NextResponse } from "next/server"
import { SquareClient, SquareEnvironment } from "square"

export async function GET() {
  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    const now = new Date()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get recent bookings
    const bookingsPage = await square.bookings.list({
      startAtMin: monthAgo.toISOString(),
      startAtMax: now.toISOString(),
      limit: 5,
    })
    const bookings = bookingsPage.data?.map(b => ({
      id: b.id,
      teamMemberId: b.appointmentSegments?.[0]?.teamMemberId,
      startAt: b.startAt,
      status: b.status,
    }))

    // Get recent completed orders and check source
    const ordersRes = await square.orders.search({
      locationIds: ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"],
      query: {
        filter: {
          dateTimeFilter: { createdAt: { startAt: monthAgo.toISOString(), endAt: now.toISOString() } },
          stateFilter: { states: ["COMPLETED"] },
        },
      },
      limit: 5,
    })

    const orders = ordersRes.orders?.map(o => ({
      id: o.id,
      total: Number(o.totalMoney?.amount || 0) / 100,
      source: (o as unknown as Record<string, unknown>).source,
      metadata: o.metadata,
      createdAt: o.createdAt,
    }))

    return NextResponse.json({
      bookings: bookings || [],
      orders: orders || [],
      message: "Check if orders have source.bookingId matching booking IDs",
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg })
  }
}
