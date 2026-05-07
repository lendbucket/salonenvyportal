import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { prisma } = await import("@/lib/prisma")

  const enrollment = await prisma.onboardingEnrollment.findUnique({ where: { inviteToken: token } })
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (enrollment.status === "completed" || enrollment.status === "active") {
    return NextResponse.json({ error: "Enrollment already completed" }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const documentType = formData.get("documentType") as string
  const metadataStr = formData.get("metadata") as string | null
  const expiresAtStr = formData.get("expiresAt") as string | null

  if (!file || !documentType) return NextResponse.json({ error: "File and documentType required" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const metadata = metadataStr ? JSON.parse(metadataStr) : undefined
  const expiresAt = expiresAtStr ? new Date(expiresAtStr) : undefined

  const { uploadDocument } = await import("@/lib/storage/enrollment-documents")
  const result = await uploadDocument({
    enrollmentId: enrollment.id,
    documentType,
    fileBuffer: buffer,
    fileName: file.name,
    mimeType: file.type,
    metadata,
    expiresAt,
  })

  return NextResponse.json(result, { status: 201 })
}
