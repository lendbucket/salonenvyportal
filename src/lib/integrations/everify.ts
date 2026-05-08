/**
 * E-Verify integration skeleton.
 *
 * INTEGRATION PENDING — REQUIRES USCIS ENROLLMENT
 *
 * E-Verify Web Services (EVWS) requires:
 * 1. Memorandum of Understanding (MOU) signed with USCIS
 * 2. Approved employer status (1-2 weeks processing)
 * 3. System integration testing with USCIS sandbox
 * 4. Production credentials issued after testing approval
 *
 * See docs/everify-setup-guide.md for enrollment steps.
 */

export interface EVerifyCase {
  caseNumber: string
  status: "PHOTO_MATCH" | "EMPLOYMENT_AUTHORIZED" | "TENTATIVE_NONCONFIRMATION" | "FINAL_NONCONFIRMATION"
  submittedAt: Date
  resolvedAt?: Date
}

export async function submitCase(_enrollmentId: string): Promise<{ caseNumber: string } | { error: string }> {
  // TODO: Implement when USCIS MOU is signed and credentials obtained
  return { error: "E-Verify integration pending USCIS enrollment. See docs/everify-setup-guide.md" }
}

export async function getCaseStatus(_caseNumber: string): Promise<EVerifyCase | { error: string }> {
  return { error: "E-Verify integration not yet configured" }
}

export function isEVerifyRequired(compensationType: string | null): boolean {
  return compensationType === "W2_HOURLY"
}
