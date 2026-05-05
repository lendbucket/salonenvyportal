import { NextResponse } from "next/server"
import { requireStylistContext } from "@/lib/auth/get-stylist-context"
import { isEncrypted, decryptBankField } from "@/lib/crypto/bank-encryption"

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

  if (enrollment?.ddAccountNumber) {
    if (isEncrypted(enrollment.ddAccountNumber)) {
      // Encrypted at rest — decrypt to extract last 4
      try {
        const raw = decryptBankField(enrollment.ddAccountNumber)
        bankLast4 = raw.slice(-4)
        hasOnFile = true
      } catch {
        // Decryption failed — key mismatch or corrupted data
        hasOnFile = false
      }
    } else if (enrollment.ddAccountNumber.length >= 4) {
      // Legacy plain-text or masked row — take last 4 directly
      bankLast4 = enrollment.ddAccountNumber.slice(-4)
      hasOnFile = true
    }
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
