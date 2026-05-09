import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const TERMINAL_STATUSES = ["active", "completed", "cancelled", "rejected", "expired"]
const REMINDER_DAYS = [3, 7, 14]
const EXPIRY_DAY = 21

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")
  const now = Date.now()

  const enrollments = await prisma.onboardingEnrollment.findMany({
    where: { status: { notIn: TERMINAL_STATUSES } },
    select: { id: true, firstName: true, email: true, phone: true, inviteToken: true, createdAt: true, reminderSchedule: true, status: true },
  })

  let sent = 0
  let expired = 0

  for (const e of enrollments) {
    const daysSinceCreated = Math.floor((now - e.createdAt.getTime()) / 86400000)
    const schedule = (e.reminderSchedule as { sentAt: string; type: string }[] | null) || []
    const sentTypes = new Set(schedule.map(r => r.type))

    // Check expiry
    if (daysSinceCreated >= EXPIRY_DAY) {
      await prisma.onboardingEnrollment.update({
        where: { id: e.id },
        data: { status: "expired" },
      })
      expired++
      continue
    }

    // Find next reminder to send
    let reminderType: string | null = null
    for (const day of REMINDER_DAYS) {
      if (daysSinceCreated >= day && !sentTypes.has(`${day}day`)) {
        reminderType = `${day}day`
        break
      }
    }

    if (!reminderType) continue

    // Send reminder email
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      const baseUrl = process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"
      const link = `${baseUrl}/onboarding/enroll/${e.inviteToken}`

      const subject = reminderType === "14day"
        ? `Final reminder: Complete your Salon Envy onboarding`
        : `Reminder: Complete your Salon Envy onboarding`

      await resend.emails.send({
        from: "Salon Envy Team <team@salonenvyusa.com>",
        to: e.email,
        subject,
        html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;"><p>Hi ${e.firstName},</p><p>${reminderType === "14day" ? "This is your final reminder." : "Just a friendly reminder."} Your Salon Envy onboarding is still incomplete.</p><p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#7a8f96;color:#fff;border-radius:8px;text-decoration:none;">Continue Onboarding</a></p><p style="color:#9ca3af;font-size:12px;">Questions? Reply to this email or call (361) 889-1102.</p></div>`,
      })
    } catch { /* non-blocking */ }

    // Update schedule
    const newSchedule = [...schedule, { sentAt: new Date().toISOString(), type: reminderType }]
    await prisma.onboardingEnrollment.update({
      where: { id: e.id },
      data: {
        reminderSchedule: newSchedule,
        lastReminderSentAt: new Date(),
        reminderCount: { increment: 1 },
      },
    })
    sent++
  }

  return NextResponse.json({ ok: true, checked: enrollments.length, remindersSent: sent, expired })
}
