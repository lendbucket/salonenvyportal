import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function POST(
  req: NextRequest,
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
  const method = req.nextUrl.searchParams.get("method") || "email"

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id },
    include: { location: true },
  })

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
  }

  if (enrollment.status === "completed" || enrollment.status === "cancelled") {
    return NextResponse.json({ error: `Cannot resend to a ${enrollment.status} enrollment` }, { status: 400 })
  }

  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const enrollLink = `${baseUrl}/onboarding/enroll/${enrollment.inviteToken}`

  if (method === "email") {
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "Salon Envy Team <team@salonenvyusa.com>",
        replyTo: "team@salonenvyusa.com",
        to: enrollment.email,
        subject: "Reminder: Complete your Salon Envy onboarding",
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background-color:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;"><div style="display:none;color:#F4F5F7;">Reminder: Complete your Salon Envy onboarding</div><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F5F7;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;"><tr><td align="center" style="padding-bottom:24px;"><img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="130" style="display:block;height:auto;filter:brightness(0) saturate(100%) invert(60%) sepia(15%) saturate(600%) hue-rotate(155deg) brightness(90%);" /></td></tr><tr><td style="background-color:#FBFBFB;border-radius:16px;border:1px solid rgba(26,19,19,0.07);box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:4px;background:linear-gradient(90deg,#7a8f96,#9aafb7);"></td></tr></table><table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:36px 40px;"><tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:13px;font-weight:600;color:rgba(26,19,19,0.4);text-transform:uppercase;letter-spacing:0.08em;">Friendly Reminder</p></td></tr><tr><td style="padding-bottom:20px;"><h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A1313;">Complete your onboarding</h1><p style="margin:0;font-size:14px;color:rgba(26,19,19,0.55);line-height:1.6;">You have a pending onboarding invitation for the <strong style="color:#1A1313;">${enrollment.location?.name || "Salon Envy"}</strong> location. Your link expires on <strong style="color:#1A1313;">${enrollment.expiresAt ? new Date(enrollment.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "soon"}</strong>.</p></td></tr><tr><td style="padding-bottom:24px;" align="center"><a href="${process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"}/onboarding/enroll/${enrollment.inviteToken}" style="display:inline-block;padding:14px 32px;background-color:#7a8f96;color:#FBFBFB;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(122,143,150,0.3);">Complete Onboarding →</a></td></tr><tr><td><p style="margin:0;font-size:12px;color:rgba(26,19,19,0.35);text-align:center;">Questions? Contact us at (361) 889-1102 or reply to this email.</p></td></tr></table></td></tr><tr><td style="padding:20px 0 0;" align="center"><p style="margin:0;font-size:12px;color:rgba(26,19,19,0.3);">Salon Envy USA LLC · Corpus Christi, TX · San Antonio, TX</p></td></tr></table></td></tr></table></body></html>`,
      })
    } catch (e) {
      console.error("[resend] Failed to send reminder email:", e)
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }
  } else if (method === "sms") {
    if (!enrollment.phone) {
      return NextResponse.json({ error: "No phone number on file" }, { status: 400 })
    }
    try {
      const { sendSMS } = await import("@/lib/twilio")
      await sendSMS(
        enrollment.phone,
        `Hi ${enrollment.firstName}! Reminder to complete your Salon Envy onboarding. Click here: ${enrollLink} — Questions? Call (361) 889-1102. Reply STOP to unsubscribe.`
      )
    } catch (e) {
      console.error("[resend] Failed to send reminder SMS:", e)
      return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 })
  }

  await prisma.onboardingEnrollment.update({
    where: { id },
    data: {
      lastReminderSentAt: new Date(),
      reminderCount: { increment: 1 },
    },
  })

  logAction({
    action: AUDIT_ACTIONS.ENROLLMENT_REMINDER_SENT,
    entity: "OnboardingEnrollment",
    entityId: id,
    userId: user.id as string,
    userEmail: user.email as string,
    userRole: role,
    metadata: { method, enrolleeName: `${enrollment.firstName} ${enrollment.lastName}` },
  })

  return NextResponse.json({ success: true, method })
}
