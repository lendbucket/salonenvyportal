/**
 * Enrollment status state machine — Phase 2 expanded.
 * 23 states + 3 terminal states.
 */

export const ENROLLMENT_STATUSES = [
  "invited",
  "started",
  "personal_info",
  "email_verified",
  "phone_verified",
  "license_verified",
  "gov_id_uploaded",
  "insurance_uploaded",
  "w9_complete",
  "state_tax_complete",
  "dd_complete",
  "nda_signed",
  "comp_agreement_signed",
  "i9_section_1_complete",
  "acknowledgments_complete",
  "signed",
  "pending_review",
  "bg_check_pending",
  "bg_check_clear",
  "i9_section_2_complete",
  "approved",
  "square_synced",
  "active",
  // Terminal states
  "expired",
  "cancelled",
  "rejected",
] as const

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

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
  phone_verified: ["license_verified", "w9_complete", "expired", "cancelled"],
  license_verified: ["gov_id_uploaded", "w9_complete", "expired", "cancelled"],
  gov_id_uploaded: ["insurance_uploaded", "w9_complete", "expired", "cancelled"],
  insurance_uploaded: ["w9_complete", "expired", "cancelled"],
  w9_complete: ["state_tax_complete", "dd_complete", "expired", "cancelled"],
  state_tax_complete: ["dd_complete", "expired", "cancelled"],
  dd_complete: ["nda_signed", "acknowledgments_complete", "expired", "cancelled"],
  nda_signed: ["comp_agreement_signed", "acknowledgments_complete", "expired", "cancelled"],
  comp_agreement_signed: ["i9_section_1_complete", "acknowledgments_complete", "expired", "cancelled"],
  i9_section_1_complete: ["acknowledgments_complete", "expired", "cancelled"],
  acknowledgments_complete: ["signed", "expired", "cancelled"],
  signed: ["pending_review", "expired", "cancelled"],
  pending_review: ["bg_check_pending", "approved", "rejected", "cancelled"],
  bg_check_pending: ["bg_check_clear", "rejected", "cancelled"],
  bg_check_clear: ["i9_section_2_complete", "approved", "cancelled"],
  i9_section_2_complete: ["approved", "cancelled"],
  approved: ["square_synced", "cancelled"],
  square_synced: ["active"],
  active: [],
  expired: ["invited"],
  cancelled: ["invited"],
  rejected: ["invited", "pending_review"],
  // Legacy statuses
  pending: ["started", "in_progress", "expired", "cancelled"],
  in_progress: ["personal_info", "email_verified", "phone_verified", "license_verified", "gov_id_uploaded", "insurance_uploaded", "w9_complete", "state_tax_complete", "dd_complete", "nda_signed", "comp_agreement_signed", "i9_section_1_complete", "acknowledgments_complete", "signed", "pending_review", "completed", "expired", "cancelled"],
  completed: [],
}

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

  if (allowed && !allowed.includes(toStatus)) {
    if (fromStatus !== "pending" && fromStatus !== "in_progress" && fromStatus !== "completed") {
      throw new Error(`Invalid transition: ${fromStatus} -> ${toStatus}`)
    }
  }

  await prisma.onboardingEnrollment.update({
    where: { id: enrollmentId },
    data: { status: toStatus },
  })

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

export const STATUS_LABELS: Record<string, string> = {
  invited: "Invited", started: "Started", personal_info: "Personal Info",
  email_verified: "Email Verified", phone_verified: "Phone Verified",
  license_verified: "License Verified", gov_id_uploaded: "Gov ID Uploaded",
  insurance_uploaded: "Insurance Uploaded", w9_complete: "W-9 Complete",
  state_tax_complete: "State Tax", dd_complete: "Direct Deposit",
  nda_signed: "NDA Signed", comp_agreement_signed: "Comp Agreement",
  i9_section_1_complete: "I-9 Section 1", acknowledgments_complete: "Acknowledgments",
  signed: "Signed", pending_review: "Pending Review",
  bg_check_pending: "Background Check", bg_check_clear: "BG Check Clear",
  i9_section_2_complete: "I-9 Complete", approved: "Approved",
  square_synced: "Square Synced", active: "Active",
  expired: "Expired", cancelled: "Cancelled", rejected: "Rejected",
  pending: "Invited", in_progress: "In Progress", completed: "Completed",
}

export function getStepperSteps(compensationType?: string | null): { key: string; label: string }[] {
  const steps = [
    { key: "personal_info", label: "Personal Info" },
    { key: "email_verified", label: "Email Verification" },
    { key: "phone_verified", label: "Phone Verification" },
    { key: "license_verified", label: "License" },
    { key: "gov_id_uploaded", label: "Government ID" },
    { key: "insurance_uploaded", label: "Insurance" },
    { key: "w9_complete", label: "W-9 Tax Form" },
    { key: "state_tax_complete", label: "State Tax" },
    { key: "dd_complete", label: "Direct Deposit" },
    { key: "nda_signed", label: "NDA" },
    { key: "comp_agreement_signed", label: "Compensation Agreement" },
  ]
  if (compensationType === "W2_HOURLY") {
    steps.push({ key: "i9_section_1_complete", label: "I-9 Section 1" })
  }
  steps.push(
    { key: "acknowledgments_complete", label: "Acknowledgments" },
    { key: "signed", label: "Signature" },
  )
  return steps
}
