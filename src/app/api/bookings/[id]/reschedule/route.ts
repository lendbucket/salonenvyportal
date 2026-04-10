import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: bookingId } = await params
  const { startAt, version } = await req.json()

  if (!startAt) return NextResponse.json({ error: "startAt required" }, { status: 400 })

  try {
    // First get current booking to preserve segments
    const current = await sq(`/bookings/${bookingId}`)
    if (current.errors) {
      return NextResponse.json({ error: current.errors[0]?.detail || "Booking not found" }, { status: 404 })
    }

    const booking = current.booking
    const data = await sq(`/bookings/${bookingId}`, {
      method: "PUT",
      body: JSON.stringify({
        booking: {
          start_at: startAt,
          version: version || booking.version,
          location_id: booking.location_id,
          customer_id: booking.customer_id,
          appointment_segments: booking.appointment_segments,
        },
      }),
    })

    if (data.errors) {
      return NextResponse.json({ error: data.errors[0]?.detail || "Reschedule failed", errors: data.errors }, { status: 400 })
    }

    return NextResponse.json({ booking: data.booking })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Reschedule failed" }, { status: 500 })
  }
}
