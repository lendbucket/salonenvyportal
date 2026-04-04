import { NextResponse } from "next/server"
import { SquareClient, SquareEnvironment } from "square"

export async function GET() {
  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const page = await square.bookings.list({
      startAtMin: thirtyDaysAgo.toISOString(),
      startAtMax: now.toISOString(),
      limit: 50,
    })

    // Show ALL statuses we see
    const statusCounts: Record<string, number> = {}
    const sampleByStatus: Record<string, unknown> = {}

    for (const booking of page.data) {
      const status = booking.status || "undefined"
      statusCounts[status] = (statusCounts[status] || 0) + 1
      if (!sampleByStatus[status]) {
        sampleByStatus[status] = {
          id: booking.id,
          customerId: booking.customerId,
          startAt: booking.startAt,
          locationId: booking.locationId,
          teamMemberId: booking.appointmentSegments?.[0]?.teamMemberId,
        }
      }
    }

    return NextResponse.json({
      totalBookings: page.data?.length || 0,
      statusCounts,
      sampleByStatus,
      hasMore: page.hasNextPage(),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg })
  }
}
