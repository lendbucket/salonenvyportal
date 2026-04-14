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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Only owners and managers can cancel appointments" }, { status: 403 })
  }

  const { id: bookingId } = await params

  try {
    const body = await req.json().catch(() => ({})) as { reason?: string }
    console.log("[cancel] Cancelling booking:", bookingId, "reason:", body.reason)

    // Get current booking to find version and customer
    const current = await sq(`/bookings/${bookingId}`)
    if (current.errors) {
      return NextResponse.json({ error: current.errors[0]?.detail || "Booking not found" }, { status: 404 })
    }

    const booking = current.booking
    const version = booking?.version

    // Cancel the booking
    const cancelResult = await sq(`/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({
        booking_version: version,
      }),
    })

    console.log("[cancel] Square result:", JSON.stringify(cancelResult).substring(0, 500))

    if (cancelResult.errors) {
      return NextResponse.json({ error: cancelResult.errors[0]?.detail || "Cancel failed" }, { status: 400 })
    }

    // Send cancellation SMS to client
    if (booking?.customer_id) {
      try {
        const custData = await sq(`/customers/${booking.customer_id}`)
        const rawPhone = custData.customer?.phone_number || ""
        if (rawPhone) {
          let normalized = rawPhone.replace(/\D/g, "")
          if (normalized.length === 10) normalized = "+1" + normalized
          else if (normalized.length === 11 && normalized.startsWith("1")) normalized = "+" + normalized
          else if (!normalized.startsWith("+")) normalized = "+1" + normalized

          const { sendSMS } = await import("@/lib/twilio")
          await sendSMS(normalized, `Hi! Your appointment at Salon Envy has been cancelled. We apologize for any inconvenience. Please call us at (361) 889-1102 to rebook. Reply STOP to unsubscribe.`)
          console.log("[cancel] Cancellation SMS sent to:", normalized)
        }
      } catch (smsErr) {
        console.log("[cancel] SMS failed (non-fatal):", smsErr instanceof Error ? smsErr.message : smsErr)
      }
    }

    return NextResponse.json({ success: true, booking: cancelResult.booking })
  } catch (e: unknown) {
    console.error("[cancel] Error:", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to cancel" }, { status: 500 })
  }
}
