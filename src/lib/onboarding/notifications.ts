/**
 * Notification helpers for enrollment lifecycle events.
 * Uses Resend (email), Twilio (SMS), and admin_alerts table.
 */

const OWNER_EMAIL = "ceo@36west.org"

export async function notifyEnrollmentSubmitted(enrollmentId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { location: true },
  })
  if (!enrollment) return

  const name = `${enrollment.firstName} ${enrollment.lastName}`

  // Admin alert
  await prisma.adminAlert.create({
    data: {
      type: "enrollment_pending_review",
      title: "New enrollment ready for review",
      body: `${name} (${enrollment.role}) at ${enrollment.location.name} has completed onboarding and is waiting for your approval.`,
      severity: "warning",
      locationId: enrollment.locationId,
    },
  })

  // Email to owner
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: "Salon Envy Portal <portal@salonenvyusa.com>",
      to: OWNER_EMAIL,
      subject: `Enrollment Review Needed: ${name} (${enrollment.role})`,
      html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;"><h2 style="color:#1A1313;">New Enrollment Pending Review</h2><p>${name} has completed their onboarding as a <strong>${enrollment.role}</strong> at <strong>${enrollment.location.name}</strong>.</p><p><a href="https://portal.salonenvyusa.com/staff/enrollments/${enrollmentId}" style="display:inline-block;padding:12px 24px;background:#7a8f96;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Review Now</a></p></div>`,
    })
  } catch { /* non-blocking */ }
}

export async function notifyEnrollmentApproved(enrollmentId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { location: true },
  })
  if (!enrollment) return

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: "Salon Envy Team <team@salonenvyusa.com>",
      to: enrollment.email,
      subject: "Your onboarding has been approved - Salon Envy",
      html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;"><h2>Welcome to Salon Envy!</h2><p>Hi ${enrollment.firstName},</p><p>Your onboarding has been approved. Your Square profile is being set up and you can now be booked for appointments at ${enrollment.location.name}.</p><p>Your portal login: <strong>portal.salonenvyusa.com</strong></p></div>`,
    })
  } catch { /* non-blocking */ }
}

export async function notifyEnrollmentRejected(enrollmentId: string, reason: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  const enrollment = await prisma.onboardingEnrollment.findUnique({ where: { id: enrollmentId } })
  if (!enrollment) return

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: "Salon Envy Team <team@salonenvyusa.com>",
      to: enrollment.email,
      subject: "Onboarding update required - Salon Envy",
      html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;"><h2>Action Required</h2><p>Hi ${enrollment.firstName},</p><p>Your onboarding submission needs attention:</p><blockquote style="border-left:3px solid #d97706;padding:8px 16px;color:#525866;margin:16px 0;">${reason}</blockquote><p>Please contact us at team@salonenvyusa.com or (361) 889-1102 for next steps.</p></div>`,
    })
  } catch { /* non-blocking */ }
}

export async function notifySquareSyncFailed(enrollmentId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { location: true },
  })
  if (!enrollment) return

  await prisma.adminAlert.create({
    data: {
      type: "enrollment_square_sync_failed",
      title: "Square sync failed",
      body: `Failed to create Square team member for ${enrollment.firstName} ${enrollment.lastName}. Error: ${enrollment.squareCreationError || "Unknown"}. Retry at /staff/enrollments/${enrollmentId}`,
      severity: "error",
      locationId: enrollment.locationId,
    },
  })
}
