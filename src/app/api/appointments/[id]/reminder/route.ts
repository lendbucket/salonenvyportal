import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { TEAM_NAMES, TEAM_MEMBER_LOCATIONS } from "@/lib/staff"
import { sendSMS, formatAppointmentReminder } from "@/lib/twilio"

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: bookingId } = await params

  try {
    // Fetch the booking
    const bData = await sq(`/bookings/${bookingId}`)
    if (bData.errors || !bData.booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    const booking = bData.booking

    // Fetch customer for email
    let customerName = "there"
    let customerEmail = ""
    if (booking.customer_id) {
      const cData = await sq(`/customers/${booking.customer_id}`)
      if (cData.customer) {
        customerName = `${cData.customer.given_name || ""}`.trim() || "there"
        customerEmail = cData.customer.email_address || ""
      }
    }

    if (!customerEmail) {
      return NextResponse.json({ error: "No email address on file for this client" }, { status: 400 })
    }

    // Build appointment details
    const startAt = new Date(booking.start_at)
    const dateStr = startAt.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
      timeZone: "America/Chicago",
    })
    const timeStr = startAt.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
      timeZone: "America/Chicago",
    })
    const stylistId = booking.appointment_segments?.[0]?.team_member_id
    const stylistName = stylistId ? (TEAM_NAMES[stylistId] || "Your Stylist") : "Your Stylist"

    // Fetch location for address
    let locationAddress = "Salon Envy"
    if (booking.location_id) {
      const lData = await sq(`/locations/${booking.location_id}`)
      if (lData.location?.address) {
        const a = lData.location.address
        locationAddress = [a.address_line_1, a.locality, a.administrative_district_level_1].filter(Boolean).join(", ")
      }
    }

    // Service names from catalog (optional enrichment)
    const serviceNames: string[] = []
    for (const seg of booking.appointment_segments || []) {
      if (seg.service_variation_id) {
        try {
          const catData = await sq(`/catalog/object/${seg.service_variation_id}`)
          if (catData.object?.itemVariationData?.name) {
            serviceNames.push(catData.object.itemVariationData.name)
          } else if (catData.object?.item_variation_data?.name) {
            serviceNames.push(catData.object.item_variation_data.name)
          }
        } catch { /* skip */ }
      }
    }
    const servicesStr = serviceNames.length > 0 ? serviceNames.join(", ") : "Your scheduled service"

    // Send via Resend
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: "Salon Envy Team <team@salonenvyusa.com>",
      replyTo: "team@salonenvyusa.com",
      to: customerEmail,
      subject: "Reminder: Your appointment at Salon Envy\u00AE",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; color: #333;">
          <h2 style="margin: 0 0 20px; font-size: 20px; color: #111;">Appointment Reminder</h2>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6;">
            Hi ${customerName},
          </p>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6;">
            This is a reminder about your upcoming appointment:
          </p>
          <div style="background: #f8f7f5; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0 0 8px; font-size: 14px;">&#x1F4C5; <strong>${dateStr}</strong> at <strong>${timeStr} CST</strong></p>
            <p style="margin: 0 0 8px; font-size: 14px;">&#x1F487; Stylist: <strong>${stylistName}</strong></p>
            <p style="margin: 0 0 8px; font-size: 14px;">&#x2702;&#xFE0F; Services: <strong>${servicesStr}</strong></p>
            <p style="margin: 0; font-size: 14px;">&#x1F4CD; ${locationAddress}</p>
          </div>
          <p style="margin: 0 0 8px; font-size: 14px; color: #666;">
            Need to reschedule? Call us:
          </p>
          <p style="margin: 0 0 4px; font-size: 14px; color: #666;">CC: (361) 808-9788</p>
          <p style="margin: 0 0 24px; font-size: 14px; color: #666;">SA: (210) 920-3869</p>
          <p style="margin: 0; font-size: 15px; line-height: 1.6;">
            See you soon!<br />
            <strong>&mdash; Salon Envy&reg; Team</strong>
          </p>
        </div>
      `,
    })

    // Also send SMS if client has a phone number
    let smsStatus: "sent" | "failed" | "no_phone" = "no_phone"
    let customerPhone = ""
    if (booking.customer_id) {
      try {
        const cPhoneData = await sq(`/customers/${booking.customer_id}`)
        customerPhone = cPhoneData.customer?.phone_number || ""
      } catch { /* skip */ }
    }
    if (customerPhone) {
      const locName = stylistId && TEAM_MEMBER_LOCATIONS[stylistId]
        ? (TEAM_MEMBER_LOCATIONS[stylistId] === "Corpus Christi" ? "CC" : "SA")
        : "CC"
      const smsMessage = formatAppointmentReminder(customerName, stylistName, dateStr, timeStr, locName)
      const smsResult = await sendSMS(customerPhone, smsMessage)
      smsStatus = smsResult.success ? "sent" : "failed"
    }

    return NextResponse.json({ sent: true, smsStatus })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send reminder" }, { status: 500 })
  }
}
