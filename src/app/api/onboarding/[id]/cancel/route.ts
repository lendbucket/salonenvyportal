import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireSession()
  if (response) return response

  const user = session!.user as Record<string, unknown>
  const role = user.role as string
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id },
    include: { location: true },
  })

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
  }

  if (enrollment.status === "completed") {
    return NextResponse.json({ error: "Cannot cancel a completed enrollment" }, { status: 400 })
  }

  if (enrollment.status === "cancelled") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 })
  }

  await prisma.onboardingEnrollment.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date() },
  })

  // Send cancellation email
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: "Salon Envy Team <team@salonenvyusa.com>",
      replyTo: "team@salonenvyusa.com",
      to: enrollment.email,
      subject: "Salon Envy Onboarding Invitation Cancelled",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="140" style="display:block;height:auto;margin:0 auto;background:#0f1d24;padding:10px 16px;border-radius:8px;" />
          </div>
          <h2 style="color: #000; font-size: 18px; margin: 0 0 12px;">Onboarding Invitation Cancelled</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Hi ${enrollment.firstName},
          </p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Your onboarding invitation for Salon Envy ${enrollment.location.name} has been cancelled. If you have questions, please contact the salon directly.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">Salon Envy USA LLC &bull; (361) 889-1102</p>
        </div>
      `,
    })
  } catch (e) {
    console.error("[cancel] Failed to send cancellation email:", e)
  }

  logAction({
    action: AUDIT_ACTIONS.ENROLLMENT_CANCELLED,
    entity: "OnboardingEnrollment",
    entityId: id,
    userId: user.id as string,
    userEmail: user.email as string,
    userRole: role,
    metadata: { enrolleeName: `${enrollment.firstName} ${enrollment.lastName}`, enrolleeEmail: enrollment.email },
  })

  return NextResponse.json({ success: true })
}
