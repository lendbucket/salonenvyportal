import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { safeDecrypt, maskSsn, maskAccountNumber } from "@/lib/crypto/bank-encryption"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id },
    include: { location: true },
  })
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Decrypt sensitive fields for admin view
  const decrypted = {
    ...enrollment,
    w9Ssn: safeDecrypt(enrollment.w9Ssn),
    w9Ein: safeDecrypt(enrollment.w9Ein),
    ddRoutingNumber: safeDecrypt(enrollment.ddRoutingNumber),
    ddAccountNumber: safeDecrypt(enrollment.ddAccountNumber),
    // Also provide masked versions for display
    w9SsnMasked: enrollment.w9Ssn ? maskSsn(safeDecrypt(enrollment.w9Ssn) || "") : null,
    ddRoutingMasked: enrollment.ddRoutingNumber ? maskAccountNumber(safeDecrypt(enrollment.ddRoutingNumber) || "") : null,
    ddAccountMasked: enrollment.ddAccountNumber ? maskAccountNumber(safeDecrypt(enrollment.ddAccountNumber) || "") : null,
  }

  // Get signature URL if stored in Supabase
  if (enrollment.signatureUrl) {
    try {
      const { getSignatureUrl } = await import("@/lib/storage/onboarding-signatures")
      decrypted.signatureUrl = await getSignatureUrl(enrollment.signatureUrl)
    } catch { /* ignore — will show fallback */ }
  }

  return NextResponse.json({ enrollment: decrypted })
}
