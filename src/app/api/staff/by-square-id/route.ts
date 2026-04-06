import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const squareId = req.nextUrl.searchParams.get("squareId")
  if (!squareId) {
    return NextResponse.json({ error: "squareId query param required" }, { status: 400 })
  }

  const staff = await prisma.staffMember.findFirst({
    where: { squareTeamMemberId: squareId },
    include: {
      location: true,
      user: { select: { email: true } },
    },
  })

  if (!staff) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
  }

  return NextResponse.json({
    staff: {
      id: staff.id,
      fullName: staff.fullName,
      email: staff.user?.email || staff.email,
      phone: staff.phone,
      position: staff.position,
      isActive: staff.isActive,
      squareTeamMemberId: staff.squareTeamMemberId,
      location: { id: staff.location.id, name: staff.location.name },
      tdlrStatus: staff.tdlrStatus,
      tdlrLicenseNumber: staff.tdlrLicenseNumber,
      tdlrExpirationDate: staff.tdlrExpirationDate,
      createdAt: staff.createdAt,
    },
  })
}
