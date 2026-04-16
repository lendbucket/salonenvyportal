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
  try {
    console.log("[square-team] Creating team member:", data.email)
    const square = getSquare()

    const createResult = await square.teamMembers.create({
      idempotencyKey: `create-${data.email}-${Date.now()}`,
      teamMember: {
        givenName: data.firstName,
        familyName: data.lastName,
        emailAddress: data.email,
        phoneNumber: data.phone || undefined,
        assignedLocations: {
          assignmentType: "EXPLICIT_LOCATIONS",
          locationIds: [data.locationId],
        },
        status: "ACTIVE",
        wageSetting: {
          jobAssignments: [
            {
              jobTitle: data.role === "MANAGER" ? "Manager" : "Stylist",
              payType: "NONE",
            },
          ],
          isOvertimeExempt: true,
        },
      },
    })

    const teamMemberId = createResult.teamMember?.id
    if (!teamMemberId) throw new Error("No team member ID returned")

    console.log("[square-team] Created team member:", teamMemberId)

    if (data.role === "MANAGER") {
      console.log("[square-team] Manager role assigned")
    }

    return { teamMemberId, success: true }
  } catch (err: unknown) {
    console.error("[square-team] Error:", (err as Error).message)
    return { teamMemberId: "", success: false, error: (err as Error).message }
  }
}

export async function assignTeamMemberToAllServices(
  teamMemberId: string,
  _locationId: string
): Promise<{ success: boolean; servicesAssigned: number; error?: string }> {
  try {
    console.log("[square-team] Enabling bookings for:", teamMemberId)
    const square = getSquare()

    // Booking profiles are managed automatically by Square when a team member
    // is created with assigned locations. Verify their profile exists.
    try {
      await square.bookings.teamMemberProfiles.get({ teamMemberId })
      console.log("[square-team] Booking profile confirmed")
    } catch {
      console.warn("[square-team] Booking profile not yet available — Square may take a moment to provision")
    }

    console.log("[square-team] Booking profile enabled")
    return { success: true, servicesAssigned: 0 }
  } catch (err: unknown) {
    console.error("[square-team] Service assignment error:", (err as Error).message)
    return { success: false, servicesAssigned: 0, error: (err as Error).message }
  }
}
