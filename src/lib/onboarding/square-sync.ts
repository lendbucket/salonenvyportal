/**
 * Square sync with retry logic for enrollment approval.
 * 3 attempts with exponential backoff (2s, 8s, 32s).
 */

const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 2000

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function syncToSquare(enrollmentId: string): Promise<{ success: boolean; teamMemberId?: string; error?: string }> {
  const { prisma } = await import("@/lib/prisma")

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { location: true },
  })

  if (!enrollment) return { success: false, error: "Enrollment not found" }

  const { createSquareTeamMember, assignTeamMemberToAllServices } = await import("@/lib/square-team")

  let lastError = ""

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await createSquareTeamMember({
        firstName: enrollment.firstName,
        lastName: enrollment.lastName,
        email: enrollment.email,
        phone: enrollment.phone || undefined,
        locationId: enrollment.location.squareLocationId,
        role: enrollment.role === "MANAGER" ? "MANAGER" : "STYLIST",
      })

      if (result.success && result.teamMemberId) {
        // Assign to all services
        try {
          await assignTeamMemberToAllServices(result.teamMemberId, enrollment.location.squareLocationId)
        } catch { /* non-blocking */ }

        // Save team member ID
        await prisma.onboardingEnrollment.update({
          where: { id: enrollmentId },
          data: { squareTeamMemberId: result.teamMemberId, squareCreationError: null },
        })

        return { success: true, teamMemberId: result.teamMemberId }
      }

      lastError = result.error || "Unknown failure"

      // Classify error: 4xx = permanent, 5xx/network = transient
      if (lastError.includes("400") || lastError.includes("409") || lastError.includes("422") || lastError.includes("INVALID")) {
        // Permanent error — don't retry
        break
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }

    // Exponential backoff: 2s, 8s, 32s
    if (attempt < MAX_RETRIES - 1) {
      const delay = BACKOFF_BASE_MS * Math.pow(4, attempt)
      await sleep(delay)
    }
  }

  // All retries exhausted — save error
  await prisma.onboardingEnrollment.update({
    where: { id: enrollmentId },
    data: { squareCreationError: lastError },
  })

  // Create admin alert
  await prisma.adminAlert.create({
    data: {
      type: "enrollment_square_sync_failed",
      title: "Square sync failed",
      body: `Enrollment for ${enrollment.firstName} ${enrollment.lastName} failed Square sync: ${lastError}`,
      severity: "error",
      locationId: enrollment.locationId,
    },
  })

  return { success: false, error: lastError }
}
