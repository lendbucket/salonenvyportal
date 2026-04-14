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

  console.log("[booking] Creating booking:", { sqLocationId, customerId, stylistId, startAt, servicesCount: services?.length })

  try {
    // Fetch service variation versions from Square catalog if not provided
    const segments = []
    for (const s of (services || [])) {
      let version = s.version ? Number(s.version) : 0
      if (!version && s.id) {
        try {
          const catData = await sq(`/catalog/object/${s.id}`)
          version = Number(catData.object?.version) || 0
          console.log("[booking] Got version for", s.id, ":", version)
        } catch (catErr) {
          console.log("[booking] Catalog version fetch failed for", s.id, ":", catErr instanceof Error ? catErr.message : catErr)
        }
      }
      segments.push({
        service_variation_id: s.id,
        team_member_id: stylistId,
        duration_minutes: s.durationMinutes || 60,
        any_team_member: false,
        ...(version ? { service_variation_version: version } : {}),
      })
    }

    const booking = {
      start_at: startAt,
      location_id: sqLocationId,
      customer_id: customerId,
      customer_note: notes || undefined,
      appointment_segments: segments,
    }

    console.log("[booking] Square payload:", JSON.stringify(booking))

    const data = await sq("/bookings", { method: "POST", body: JSON.stringify({ booking, idempotency_key: `booking_${Date.now()}_${Math.random().toString(36).slice(2)}` }) })

    console.log("[booking] Square response:", JSON.stringify(data).substring(0, 500))

    if (data.errors) {
      const errMsg = data.errors.map((e: { detail?: string; code?: string; field?: string }) => `${e.detail || e.code || "Unknown"}${e.field ? ` (field: ${e.field})` : ""}`).join("; ")
      console.error("[booking] Square errors:", JSON.stringify(data.errors))
      return NextResponse.json({ error: errMsg, errors: data.errors, sentPayload: booking }, { status: 400 })
    }

    // Send confirmation SMS if client has a phone number
    if (customerId) {
      try {
        const custData = await sq(`/customers/${customerId}`)
        const phone = custData.customer?.phone_number
        if (phone) {
          const { sendSMS } = await import("@/lib/twilio")
          const startDate = new Date(startAt)
          const dateStr = startDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Chicago" })
          const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
          const { TEAM_NAMES } = await import("@/lib/staff")
          const stylistName = TEAM_NAMES[stylistId] || "your stylist"
          const locName = sqLocationId === CC_LOCATION_ID ? "Corpus Christi" : "San Antonio"
          await sendSMS(phone, `Hi ${custData.customer?.given_name || "there"}! Your appointment at Salon Envy ${locName} is confirmed for ${dateStr} at ${timeStr} with ${stylistName}. Reply STOP to unsubscribe.`)
        }
      } catch (smsErr) {
        console.log("[booking] SMS failed (non-fatal):", smsErr)
      }
    }

    return NextResponse.json({ booking: data.booking })
  } catch (e: unknown) {
    console.error("[booking] Error:", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Booking creation failed" }, { status: 500 })
  }
}
