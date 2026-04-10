import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CC_LOCATION_ID, SA_LOCATION_ID } from "@/lib/staff"

const SQ = "https://connect.squareup.com/v2"

async function sq(path: string, options?: RequestInit) {
  const r = await fetch(`${SQ}${path}`, { ...options, headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN!}`, "Content-Type": "application/json", "Square-Version": "2025-04-16", ...(options?.headers || {}) } })
  return r.json()
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { locationId, customerId, stylistId, startAt, services, notes } = await req.json()
  const sqLocationId = locationId === "SA" || locationId === "San Antonio" ? SA_LOCATION_ID : CC_LOCATION_ID

  try {
    const booking = {
      start_at: startAt,
      location_id: sqLocationId,
      customer_id: customerId,
      customer_note: notes || undefined,
      appointment_segments: (services || []).map((s: { id: string; durationMinutes: number; version?: number }) => ({
        service_variation_id: s.id,
        team_member_id: stylistId,
        duration_minutes: s.durationMinutes || 60,
        ...(s.version ? { service_variation_version: s.version } : {}),
      })),
    }

    const data = await sq("/bookings", { method: "POST", body: JSON.stringify({ booking, idempotency_key: `booking_${Date.now()}_${Math.random().toString(36).slice(2)}` }) })

    if (data.errors) {
      return NextResponse.json({ error: data.errors[0]?.detail || "Booking failed", errors: data.errors }, { status: 400 })
    }

    return NextResponse.json({ booking: data.booking })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Booking creation failed" }, { status: 500 })
  }
}
