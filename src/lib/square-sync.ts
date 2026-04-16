import { prisma } from "@/lib/prisma"
import { createSquareTeamMember, assignTeamMemberToAllServices } from "@/lib/square-team"

export async function syncStaffMemberToSquare(staffMemberId: string): Promise<void> {
  const staff = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    include: { location: true },
  })
  if (!staff) return

  if (staff.squareTeamMemberId) {
    console.log("[square-sync] Staff already has Square ID:", staff.squareTeamMemberId)
    return
  }

  const nameParts = staff.fullName.trim().split(/\s+/)
  const firstName = nameParts[0] || staff.fullName
  const lastName = nameParts.slice(1).join(" ") || ""
  const role = staff.position === "manager" ? "MANAGER" as const : "STYLIST" as const

  const result = await createSquareTeamMember({
    firstName,
    lastName,
    email: staff.email || "",
    phone: staff.phone || undefined,
    locationId: staff.location.squareLocationId,
    role,
  })

  if (result.success && result.teamMemberId) {
    await prisma.staffMember.update({
      where: { id: staffMemberId },
      data: { squareTeamMemberId: result.teamMemberId },
    })
    console.log("[square-sync] Staff synced to Square:", result.teamMemberId)
  }
}

export async function syncScheduleToSquare(_scheduleData: unknown): Promise<void> {
  // Push schedule/availability to Square booking system
  console.log("[square-sync] Schedule sync placeholder")
}

export async function syncServiceAssignmentsToSquare(
  teamMemberId: string,
  locationId: string
): Promise<void> {
  await assignTeamMemberToAllServices(teamMemberId, locationId)
}
