import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params
  const body = await req.json()
  const reason = body.reason as string

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { id },
    include: { documents: true },
  })
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const deletableStatuses = ["cancelled", "rejected", "expired"]
  if (!deletableStatuses.includes(enrollment.status)) {
    return NextResponse.json({ error: "Can only delete cancelled, rejected, or expired enrollments" }, { status: 400 })
  }

  // Delete files from storage
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  let filesDeleted = 0
  for (const doc of enrollment.documents) {
    try {
      await supabase.storage.from(doc.storageBucket).remove([doc.storagePath])
      filesDeleted++
    } catch { /* continue */ }
  }

  // Delete signature from storage if exists
  if (enrollment.signatureUrl) {
    try {
      await supabase.storage.from("onboarding-signatures").remove([enrollment.signatureUrl])
      filesDeleted++
    } catch { /* continue */ }
  }

  // Delete DB records (cascade deletes documents)
  await prisma.onboardingEnrollment.delete({ where: { id } })

  // Audit log (kept — not PII)
  await prisma.auditLog.create({
    data: {
      action: "enrollment.pii_deleted",
      entity: "onboarding_enrollment",
      entityId: id,
      userId,
      metadata: { reason, filesDeleted, documentsDeleted: enrollment.documents.length },
    },
  })

  return NextResponse.json({ success: true, filesDeleted, documentsDeleted: enrollment.documents.length })
}
