import { NextResponse } from "next/server"
import { requireStylistContext } from "@/lib/auth/get-stylist-context"
import { verifyTDLRLicense } from "@/lib/tdlr"

export async function POST() {
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
    select: { tdlrLicenseNumber: true },
  })

  if (!staffMember?.tdlrLicenseNumber) {
    return NextResponse.json({ error: "No license number on file" }, { status: 400 })
  }

  const result = await verifyTDLRLicense(staffMember.tdlrLicenseNumber)

  const updated = await prisma.staffMember.update({
    where: { id: ctx.staffMemberId },
    data: {
      tdlrStatus: result.status || (result.valid ? "ACTIVE" : "UNKNOWN"),
      tdlrExpirationDate: result.expirationDate ? new Date(result.expirationDate) : null,
      tdlrVerifiedAt: new Date(),
      tdlrHolderName: result.holderName || null,
    },
    select: {
      tdlrLicenseNumber: true,
      tdlrStatus: true,
      tdlrExpirationDate: true,
      tdlrVerifiedAt: true,
      tdlrHolderName: true,
    },
  })

  return NextResponse.json({
    license: {
      number: updated.tdlrLicenseNumber,
      status: updated.tdlrStatus,
      expirationDate: updated.tdlrExpirationDate?.toISOString() ?? null,
      verifiedAt: updated.tdlrVerifiedAt?.toISOString() ?? null,
      holderName: updated.tdlrHolderName,
    },
  })
}
