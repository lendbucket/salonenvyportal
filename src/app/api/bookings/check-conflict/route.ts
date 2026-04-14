import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SquareClient, SquareEnvironment } from "square"

function getSquare() {
  return new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { teamMemberId, startAt, durationMinutes } = await req.json()
  if (!teamMemberId || !startAt) return NextResponse.json({ hasConflict: false })

  try {
    const square = getSquare()
    const requestedStart = new Date(startAt).getTime()
    const requestedEnd = requestedStart + (durationMinutes || 60) * 60000

    // Get bookings for that day
    const dayStart = new Date(startAt)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(startAt)
    dayEnd.setHours(23, 59, 59, 999)

    const page = await square.bookings.list({
      startAtMin: dayStart.toISOString(),
      startAtMax: dayEnd.toISOString(),
      limit: 50,
    })

    for (const b of page.data) {
      if (b.status !== "ACCEPTED") continue
      const tmId = b.appointmentSegments?.[0]?.teamMemberId
      if (tmId !== teamMemberId) continue

      const bStart = new Date(b.startAt || "").getTime()
      const bDuration = b.appointmentSegments?.reduce((s, seg) => s + (seg.durationMinutes || 60), 0) || 60
      const bEnd = bStart + bDuration * 60000

      if (requestedStart < bEnd && requestedEnd > bStart) {
        return NextResponse.json({
          hasConflict: true,
          conflictingBooking: {
            startAt: b.startAt,
            endAt: new Date(bEnd).toISOString(),
            bookingId: b.id,
          },
        })
      }
    }

    return NextResponse.json({ hasConflict: false })
  } catch {
    return NextResponse.json({ hasConflict: false })
  }
}
