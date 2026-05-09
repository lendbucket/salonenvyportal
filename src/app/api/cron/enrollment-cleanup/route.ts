import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const INVITE_EXPIRY_DAYS = 30
const SOFT_DELETE_AFTER_DAYS = 90

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")
  const now = Date.now()

  // 1. Mark stale INVITED as EXPIRED
  const inviteExpiry = new Date(now - INVITE_EXPIRY_DAYS * 86400000)
  const expired = await prisma.onboardingEnrollment.updateMany({
    where: { status: { in: ["invited", "pending"] }, createdAt: { lt: inviteExpiry }, deletedAt: null },
    data: { status: "expired" },
  })

  // 2. Soft-delete terminal enrollments > 90 days old
  const softDeleteCutoff = new Date(now - SOFT_DELETE_AFTER_DAYS * 86400000)
  const toSoftDelete = await prisma.onboardingEnrollment.findMany({
    where: { status: { in: ["cancelled", "rejected", "expired"] }, updatedAt: { lt: softDeleteCutoff }, deletedAt: null },
    select: { id: true },
  })

  let softDeleted = 0
  for (const enrollment of toSoftDelete) {
    // Delete associated document files from storage
    const docs = await prisma.enrollmentDocument.findMany({
      where: { enrollmentId: enrollment.id },
      select: { id: true, storageBucket: true, storagePath: true },
    })

    if (docs.length > 0) {
      try {
        const { createClient } = await import("@supabase/supabase-js")
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        for (const doc of docs) {
          await supabase.storage.from(doc.storageBucket).remove([doc.storagePath]).catch(() => {})
        }
      } catch { /* continue */ }
      await prisma.enrollmentDocument.deleteMany({ where: { enrollmentId: enrollment.id } })
    }

    // Anonymize PII on the enrollment record (keep audit history)
    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        deletedAt: new Date(),
        phone: null, dateOfBirth: null, address: null, city: null, state: null, zip: null,
        w9Ssn: null, w9Ein: null, w9LegalName: null, w9BusinessName: null, w9Address: null,
        ddRoutingNumber: null, ddAccountNumber: null, ddBankName: null, ddNameOnAccount: null,
        emergencyName: null, emergencyPhone: null,
        signatureData: null, signatureUrl: null,
      },
    })
    softDeleted++
  }

  return NextResponse.json({ ok: true, expired: expired.count, softDeleted })
}
