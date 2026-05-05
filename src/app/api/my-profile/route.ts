import { NextResponse } from "next/server"
import { requireStylistContext } from "@/lib/auth/get-stylist-context"

export async function GET() {
  let ctx
  try {
    ctx = await requireStylistContext()
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")

  const staffMember = await prisma.staffMember.findUnique({
    where: { id: ctx.staffMemberId },
    include: { location: { select: { name: true } } },
  })

  if (!staffMember) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
  }

  // Look up onboarding enrollment for bank last 4
  let bankLast4: string | null = null
  let hasOnFile = false

  const enrollment = await prisma.onboardingEnrollment.findFirst({
    where: { email: staffMember.email || ctx.email || "" },
    select: { ddAccountNumber: true },
    orderBy: { createdAt: "desc" },
  })

  if (enrollment?.ddAccountNumber && enrollment.ddAccountNumber.length >= 4) {
    bankLast4 = enrollment.ddAccountNumber.slice(-4)
    hasOnFile = true
  }

  return NextResponse.json({
    fullName: staffMember.fullName,
    email: staffMember.email || ctx.email,
    phone: staffMember.phone,
    location: { name: staffMember.location.name },
    license: {
      number: staffMember.tdlrLicenseNumber,
      status: staffMember.tdlrStatus,
      expirationDate: staffMember.tdlrExpirationDate?.toISOString() ?? null,
      verifiedAt: staffMember.tdlrVerifiedAt?.toISOString() ?? null,
      holderName: staffMember.tdlrHolderName,
    },
    bank: {
      last4: bankLast4,
      hasOnFile,
    },
  })
}
