import { NextRequest } from "next/server"
import { validateApiKey, apiResponse, apiError } from "@/lib/api-v1-auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return apiError(auth.error!, auth.status || 401)
  if (!auth.apiKey!.permissions.includes("staff:read")) {
    return apiError("Insufficient permissions: staff:read required", 403)
  }

  const locationId = req.nextUrl.searchParams.get("locationId")
  const isActive = req.nextUrl.searchParams.get("isActive")

  const staff = await prisma.staffMember.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      ...(isActive !== null ? { isActive: isActive !== "false" } : {}),
      ...(auth.apiKey!.locationId ? { locationId: auth.apiKey!.locationId } : {}),
    },
    include: { location: true },
    orderBy: { fullName: "asc" },
  })

  return apiResponse({
    staff: staff.map((s) => ({
      id: s.id,
      squareTeamMemberId: s.squareTeamMemberId,
      name: s.fullName,
      firstName: s.fullName.split(" ")[0],
      lastName: s.fullName.split(" ").slice(1).join(" "),
      position: s.position,
      location: s.location.name === "Corpus Christi" ? "CC" : "SA",
      locationId: s.locationId,
      email: s.email,
      phone: s.phone,
      licenseNumber: s.tdlrLicenseNumber,
      isActive: s.isActive,
    })),
    total: staff.length,
  })
}
