/**
 * Audit logging for enrollment lifecycle events.
 */

export async function logEnrollmentEvent(
  enrollmentId: string,
  action: string,
  opts?: {
    byUserId?: string
    metadata?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  },
): Promise<void> {
  const { prisma } = await import("@/lib/prisma")

  await prisma.auditLog.create({
    data: {
      action: `enrollment.${action}`,
      entity: "onboarding_enrollment",
      entityId: enrollmentId,
      userId: opts?.byUserId || null,
      ipAddress: opts?.ipAddress || null,
      metadata: {
        ...(opts?.metadata || {}),
        ...(opts?.userAgent ? { userAgent: opts.userAgent } : {}),
      },
    },
  })
}
