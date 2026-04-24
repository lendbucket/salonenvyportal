import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"
import { SquareClient, SquareEnvironment } from "square"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireSession()
  if (response) return response

  const user = session!.user as Record<string, unknown>
  const role = user.role as string
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can terminate staff" }, { status: 403 })
  }

  const { id: staffMemberId } = await params

  const staffMember = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    include: { location: true, user: true },
  })

  if (!staffMember) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
  }
  if (!staffMember.isActive) {
    return NextResponse.json({ error: "Staff member is already inactive" }, { status: 400 })
  }

  let body: {
    terminationType: string
    terminationReason: string
    terminationDate: string
    lastWorkingDay?: string
    notesFromManager?: string
    cancelFutureAppointments?: boolean
    sendTerminationNotice?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.terminationReason || body.terminationReason.length < 10) {
    return NextResponse.json({ error: "Termination reason must be at least 10 characters" }, { status: 400 })
  }
  if (!body.terminationDate) {
    return NextResponse.json({ error: "Termination date required" }, { status: 400 })
  }

  const { terminationType, terminationReason, terminationDate, lastWorkingDay, notesFromManager } = body
  const cancelFutureAppointments = body.cancelFutureAppointments !== false
  const sendTerminationNotice = body.sendTerminationNotice !== false

  let squareDeactivated = false
  let appointmentsCancelledCount = 0

  // STEP 2 — Deactivate in Square
  if (staffMember.squareTeamMemberId) {
    const square = getSquare()
    try {
      await square.teamMembers.update({
        teamMemberId: staffMember.squareTeamMemberId,
        body: {
          teamMember: {
            status: "INACTIVE",
          },
        },
      })
      console.log("[offboard] Square team member deactivated:", staffMember.squareTeamMemberId)
      squareDeactivated = true
    } catch (e) {
      console.error("[offboard] Failed to deactivate in Square:", e)
    }

    // STEP 3 — Cancel future appointments
    if (cancelFutureAppointments) {
      try {
        const today = new Date().toISOString()
        const bookingsResult = await square.bookings.list({
          teamMemberId: staffMember.squareTeamMemberId,
          startAtMin: today,
          limit: 100,
        })

        const bookings: Array<{ id?: string; version?: number; status?: string; customerId?: string | null }> = []
        for await (const booking of bookingsResult) {
          bookings.push(booking)
        }

        console.log("[offboard] Cancelling", bookings.length, "future appointments")

        for (const booking of bookings) {
          if (!booking.id || booking.status === "CANCELLED_BY_SELLER") continue
          try {
            await square.bookings.cancel({
              bookingId: booking.id,
              bookingVersion: booking.version,
            })
            appointmentsCancelledCount++

            // Notify client via SMS
            if (booking.customerId) {
              try {
                const customerResult = await square.customers.get({ customerId: booking.customerId })
                const phone = customerResult.customer?.phoneNumber
                if (phone) {
                  const { sendSMS } = await import("@/lib/twilio")
                  await sendSMS(
                    phone,
                    `Hi! We need to inform you that your upcoming appointment at Salon Envy has been cancelled due to a staff change. Please call us at (361) 889-1102 or visit salonenvyusa.com to rebook with one of our other talented stylists. We apologize for the inconvenience.`
                  )
                }
              } catch (custErr) {
                console.warn("[offboard] Failed to notify client:", custErr)
              }
            }
          } catch (cancelErr) {
            console.warn("[offboard] Failed to cancel booking:", booking.id, cancelErr)
          }
        }
      } catch (bookErr) {
        console.error("[offboard] Failed to list/cancel bookings:", bookErr)
      }
    }
  }

  // STEP 4 — Update Prisma
  await prisma.staffMember.update({
    where: { id: staffMemberId },
    data: {
      isActive: false,
      terminatedAt: new Date(terminationDate),
      terminationReason,
    },
  })

  await prisma.offboardingRecord.create({
    data: {
      staffMemberId,
      staffMemberName: staffMember.fullName,
      locationId: staffMember.locationId,
      terminationType: terminationType || "involuntary",
      terminationReason,
      terminationDate: new Date(terminationDate),
      lastWorkingDay: lastWorkingDay ? new Date(lastWorkingDay) : null,
      squareDeactivated,
      squareDeactivatedAt: squareDeactivated ? new Date() : null,
      appointmentsCancelled: cancelFutureAppointments,
      appointmentsCancelledAt: appointmentsCancelledCount > 0 ? new Date() : null,
      notesFromManager: notesFromManager || null,
      initiatedBy: user.id as string,
    },
  })

  // STEP 5 — Send termination notice
  if (sendTerminationNotice && staffMember.email) {
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      const termDateStr = new Date(terminationDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

      await resend.emails.send({
        from: "Salon Envy Team <team@salonenvyusa.com>",
        replyTo: "team@salonenvyusa.com",
        to: staffMember.email,
        subject: "Important Notice — Salon Envy Contractor Agreement",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="140" style="display:block;height:auto;margin:0 auto;background:#0f1d24;padding:10px 16px;border-radius:8px;" />
            </div>
            <h2 style="color: #000; font-size: 20px; margin: 0 0 16px;">Important Notice</h2>
            <p style="color: #333; font-size: 14px; line-height: 1.6;">Dear ${staffMember.fullName},</p>
            <p style="color: #333; font-size: 14px; line-height: 1.6;">
              This notice confirms that your Independent Contractor Agreement with Salon Envy USA LLC has been terminated effective <strong>${termDateStr}</strong>.
            </p>
            <p style="color: #333; font-size: 14px; line-height: 1.6;">Per Section 3 of your agreement, please note the following:</p>
            <ul style="color: #333; font-size: 14px; line-height: 1.8;">
              <li>Your access to the Salon Envy portal will be deactivated</li>
              <li>Your final commission payment for completed services will be processed on the next regular pay date</li>
              <li>Please return any Salon property within 5 business days</li>
              <li>Your non-compete and non-solicitation obligations remain in effect for 12 months per Section 11 of your agreement</li>
              <li>Your confidentiality obligations remain in effect for 10 years per Section 10 of your agreement</li>
            </ul>
            <p style="color: #333; font-size: 14px; line-height: 1.6;">
              If you have any questions regarding your final payment, please contact <a href="mailto:ceo@36west.org">ceo@36west.org</a>.
            </p>
            <p style="color: #333; font-size: 14px; line-height: 1.6; margin-top: 24px;">
              Robert R. Reyna<br/>Owner, Salon Envy USA LLC
            </p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error("[offboard] Failed to send termination notice:", emailErr)
    }
  }

  // STEP 6 — Email owner summary
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: "Salon Envy Portal <portal@salonenvyusa.com>",
      replyTo: "team@salonenvyusa.com",
      to: "ceo@36west.org",
      subject: `Staff Offboarding Complete — ${staffMember.fullName} — ${staffMember.location.name} — ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #000; border-bottom: 2px solid #7a8f96; padding-bottom: 10px;">Staff Offboarding Complete</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="color: #666; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #eee;">Name</td><td style="color: #000; font-size: 13px; padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">${staffMember.fullName}</td></tr>
            <tr><td style="color: #666; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #eee;">Location</td><td style="color: #000; font-size: 13px; padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">${staffMember.location.name}</td></tr>
            <tr><td style="color: #666; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #eee;">Type</td><td style="color: #000; font-size: 13px; padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">${terminationType}</td></tr>
            <tr><td style="color: #666; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #eee;">Reason</td><td style="color: #000; font-size: 13px; padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">${terminationReason}</td></tr>
            <tr><td style="color: #666; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #eee;">Square Deactivated</td><td style="color: #000; font-size: 13px; padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">${squareDeactivated ? "Yes" : "No (no Square ID)"}</td></tr>
            <tr><td style="color: #666; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #eee;">Appointments Cancelled</td><td style="color: #000; font-size: 13px; padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">${appointmentsCancelledCount}</td></tr>
            <tr><td style="color: #666; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #eee;">Termination Notice Sent</td><td style="color: #000; font-size: 13px; padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">${sendTerminationNotice ? "Yes" : "No"}</td></tr>
          </table>
          <p style="color: #999; font-size: 11px; margin-top: 20px;">Generated by Salon Envy Management Portal</p>
        </div>
      `,
    })
  } catch (e) {
    console.error("[offboard] Failed to send owner summary:", e)
  }

  // STEP 7 — Audit log
  logAction({
    action: AUDIT_ACTIONS.STAFF_TERMINATED,
    entity: "StaffMember",
    entityId: staffMemberId,
    userId: user.id as string,
    userEmail: user.email as string,
    userRole: role,
    locationId: staffMember.locationId,
    metadata: {
      staffMemberName: staffMember.fullName,
      terminationType,
      terminationReason,
      squareDeactivated,
      appointmentsCancelled: appointmentsCancelledCount,
    },
  })

  return NextResponse.json({
    success: true,
    squareDeactivated,
    appointmentsCancelled: appointmentsCancelledCount,
    staffMemberDeactivated: true,
  })
}
