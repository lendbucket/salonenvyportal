/**
 * Enrollment status state machine.
 * Enforces valid transitions and writes audit log entries.
 */

export const ENROLLMENT_STATUSES = [
  "invited",
  "started",
  "personal_info",
  "email_verified",
  "phone_verified",
  "w9_complete",
  "dd_complete",
  "acknowledgments_complete",
  "signed",
  "pending_review",
  "approved",
  "square_synced",
  "active",
  "expired",
  "cancelled",
  "rejected",
] as const

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

// Map "pending" and "in_progress" (legacy) to valid states
export function normalizeStatus(status: string): EnrollmentStatus {
  if (status === "pending") return "invited"
  if (status === "in_progress") return "started"
  if (status === "completed") return "active"
  return status as EnrollmentStatus
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  invited: ["started", "expired", "cancelled"],
  started: ["personal_info", "expired", "cancelled"],
  personal_info: ["email_verified", "expired", "cancelled"],
  email_verified: ["phone_verified", "expired", "cancelled"],
  phone_verified: ["w9_complete", "expired", "cancelled"],
  w9_complete: ["dd_complete", "expired", "cancelled"],
  dd_complete: ["acknowledgments_complete", "expired", "cancelled"],
  acknowledgments_complete: ["signed", "expired", "cancelled"],
  signed: ["pending_review", "expired", "cancelled"],
  pending_review: ["approved", "rejected", "cancelled"],
  approved: ["square_synced", "cancelled"],
  square_synced: ["active"],
  active: [],
  expired: ["invited"], // Can re-invite
  cancelled: ["invited"], // Can re-invite
  rejected: ["invited", "pending_review"], // Can re-invite or re-review
  // Legacy statuses
  pending: ["started", "in_progress", "expired", "cancelled"],
  in_progress: ["personal_info", "email_verified", "phone_verified", "w9_complete", "dd_complete", "acknowledgments_complete", "signed", "pending_review", "completed", "expired", "cancelled"],
  completed: [],
}

/**
 * Transition an enrollment to a new status.
 * Validates the transition is allowed and writes an audit log entry.
 */
export async function transition(
  enrollmentId: string,
  toStatus: string,
  byUserId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma")

  const enrollment = await prisma.onboardingEnrollment.findUnique({ where: { id: enrollmentId }, select: { status: true } })
  if (!enrollment) throw new Error("Enrollment not found")

  const fromStatus = enrollment.status
  const allowed = ALLOWED_TRANSITIONS[fromStatus]

  // Allow transition if explicitly allowed, or if going forward in the pipeline from legacy statuses
  if (allowed && !allowed.includes(toStatus)) {
    // Soft check — allow any transition from legacy statuses for now
    if (fromStatus !== "pending" && fromStatus !== "in_progress" && fromStatus !== "completed") {
      throw new Error(`Invalid transition: ${fromStatus} -> ${toStatus}`)
    }
  }

  await prisma.onboardingEnrollment.update({
    where: { id: enrollmentId },
    data: { status: toStatus },
  })

  // Write audit log
  await prisma.auditLog.create({
    data: {
      action: "enrollment.status_change",
      entity: "onboarding_enrollment",
      entityId: enrollmentId,
      userId: byUserId || null,
      metadata: { from: fromStatus, to: toStatus, ...(metadata || {}) },
    },
  })
}

/**
 * Status display labels (human-readable).
 */
export const STATUS_LABELS: Record<string, string> = {
  invited: "Invited",
  started: "Started",
  personal_info: "Personal Info",
  email_verified: "Email Verified",
  phone_verified: "Phone Verified",
  w9_complete: "W-9 Complete",
  dd_complete: "Direct Deposit",
  acknowledgments_complete: "Acknowledgments",
  signed: "Signed",
  pending_review: "Pending Review",
  approved: "Approved",
  square_synced: "Square Synced",
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
  rejected: "Rejected",
  // Legacy
  pending: "Invited",
  in_progress: "In Progress",
  completed: "Completed",
}
