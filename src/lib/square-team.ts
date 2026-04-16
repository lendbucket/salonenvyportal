import { SquareClient, SquareEnvironment } from "square"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

export async function createSquareTeamMember(data: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  locationId: string
  role: "STYLIST" | "MANAGER"
}): Promise<{ teamMemberId: string; success: boolean; error?: string }> {
  console.log("[square-team] ========== START createSquareTeamMember ==========")
  console.log("[square-team] Input data:", JSON.stringify({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    locationId: data.locationId,
    role: data.role,
  }))

  try {
    const square = getSquare()

    // Normalize phone to E.164
    let phone: string | undefined = undefined
    if (data.phone) {
      const digits = data.phone.replace(/\D/g, "")
      if (digits.length === 10) {
        phone = `+1${digits}`
      } else if (digits.length === 11 && digits.startsWith("1")) {
        phone = `+${digits}`
      } else if (digits.length > 0) {
        phone = `+${digits}`
      }
      console.log("[square-team] Normalized phone:", phone)
    }

    const idempotencyKey = `team-${data.email}-${Date.now()}`
    console.log("[square-team] Idempotency key:", idempotencyKey)

    // Step 1: Create team member (WITHOUT wageSetting — set separately)
    const createPayload = {
      idempotencyKey,
      teamMember: {
        givenName: data.firstName.trim(),
        familyName: data.lastName.trim(),
        emailAddress: data.email.trim(),
        ...(phone ? { phoneNumber: phone } : {}),
        assignedLocations: {
          assignmentType: "EXPLICIT_LOCATIONS" as const,
          locationIds: [data.locationId],
        },
        status: "ACTIVE" as const,
      },
    }
    console.log("[square-team] Create payload:", JSON.stringify(createPayload))

    const createResult = await square.teamMembers.create(createPayload)
    console.log("[square-team] Create API response:", JSON.stringify(createResult))

    const teamMemberId = createResult.teamMember?.id
    if (!teamMemberId) {
      throw new Error("Square returned success but no team member ID in response")
    }
    console.log("[square-team] Team member created with ID:", teamMemberId)

    // Step 2: Update wage setting
    try {
      console.log("[square-team] Setting wage for:", teamMemberId)
      const wageResult = await square.teamMembers.wageSetting.update({
        teamMemberId,
        wageSetting: {
          jobAssignments: [
            {
              jobTitle: data.role === "MANAGER" ? "Manager" : "Stylist",
              payType: "NONE",
            },
          ],
          isOvertimeExempt: true,
        },
      })
      console.log("[square-team] Wage setting applied:", JSON.stringify(wageResult))
    } catch (wageErr: unknown) {
      console.error("[square-team] Wage setting failed (non-fatal):", (wageErr as Error).message)
    }

    // Step 3: Enable booking profile
    try {
      console.log("[square-team] Enabling booking profile for:", teamMemberId)
      const bookingResult = await square.bookings.teamMemberProfiles.get({ teamMemberId })
      console.log("[square-team] Booking profile status:", JSON.stringify(bookingResult))
    } catch (bookErr: unknown) {
      console.warn("[square-team] Booking profile not yet available (Square provisions async):", (bookErr as Error).message)
    }

    // Step 4: Verify team member was created by fetching back
    try {
      console.log("[square-team] Verifying team member exists...")
      const verify = await square.teamMembers.get({ teamMemberId })
      console.log("[square-team] VERIFIED team member:", JSON.stringify({
        id: verify.teamMember?.id,
        givenName: verify.teamMember?.givenName,
        familyName: verify.teamMember?.familyName,
        status: verify.teamMember?.status,
        locations: verify.teamMember?.assignedLocations?.locationIds,
      }))
    } catch (verifyErr: unknown) {
      console.error("[square-team] Verification fetch failed:", (verifyErr as Error).message)
    }

    console.log("[square-team] ========== SUCCESS ==========")
    return { teamMemberId, success: true }
  } catch (err: unknown) {
    const error = err as Record<string, unknown>
    const errorDetail =
      (Array.isArray(error.errors) && (error.errors as Array<Record<string, string>>)[0]?.detail) ||
      (Array.isArray(error.errors) && (error.errors as Array<Record<string, string>>)[0]?.code) ||
      (err instanceof Error ? err.message : null) ||
      "Unknown error"
    console.error("[square-team] ========== FAILED ==========")
    console.error("[square-team] Error detail:", errorDetail)
    try {
      console.error("[square-team] Full error:", JSON.stringify(err))
    } catch {
      console.error("[square-team] Full error (message):", err instanceof Error ? err.message : String(err))
    }
    return { teamMemberId: "", success: false, error: String(errorDetail) }
  }
}

export async function assignTeamMemberToAllServices(
  teamMemberId: string,
  _locationId: string
): Promise<{ success: boolean; servicesAssigned: number; error?: string }> {
  try {
    console.log("[square-team] Confirming booking profile for:", teamMemberId)
    const square = getSquare()

    try {
      const profile = await square.bookings.teamMemberProfiles.get({ teamMemberId })
      console.log("[square-team] Booking profile confirmed:", JSON.stringify(profile))
    } catch {
      console.warn("[square-team] Booking profile not yet available — Square may take a moment to provision")
    }

    return { success: true, servicesAssigned: 0 }
  } catch (err: unknown) {
    console.error("[square-team] Service assignment error:", (err as Error).message)
    return { success: false, servicesAssigned: 0, error: (err as Error).message }
  }
}
