import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string
  const staff = await prisma.staffMember.findFirst({ where: { userId } })
  if (!staff) return NextResponse.json({ licenseNumber: null, verified: false, status: null })
  const daysUntilExpiry = staff.tdlrExpirationDate
    ? Math.ceil((new Date(staff.tdlrExpirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  return NextResponse.json({
    licenseNumber: staff.tdlrLicenseNumber,
    verified: !!staff.tdlrVerifiedAt,
    status: staff.tdlrStatus,
    expirationDate: staff.tdlrExpirationDate,
    holderName: staff.tdlrHolderName,
    verifiedAt: staff.tdlrVerifiedAt,
    daysUntilExpiry,
    expiringSoon: daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 60,
    expired: daysUntilExpiry !== null && daysUntilExpiry <= 0,
  })
}
