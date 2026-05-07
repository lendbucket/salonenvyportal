/**
 * Generic document upload/management for enrollment documents.
 * Maps document types to storage buckets, handles upload/download/delete.
 */

import { createClient } from "@supabase/supabase-js"

const BUCKET_MAP: Record<string, string> = {
  license_image: "onboarding-licenses",
  gov_id_front: "onboarding-gov-ids",
  gov_id_back: "onboarding-gov-ids",
  insurance_cert: "onboarding-insurance",
  nda_signed: "onboarding-agreements",
  comp_agreement_signed: "onboarding-agreements",
  i9_supporting_doc: "onboarding-i9",
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function uploadDocument(params: {
  enrollmentId: string
  documentType: string
  fileBuffer: Buffer
  fileName: string
  mimeType: string
  metadata?: Record<string, unknown>
  expiresAt?: Date
}): Promise<{ documentId: string; url: string }> {
  const bucket = BUCKET_MAP[params.documentType]
  if (!bucket) throw new Error(`Unknown document type: ${params.documentType}`)

  const ext = params.fileName.split(".").pop() || "bin"
  const storagePath = `${params.enrollmentId}-${params.documentType}-${Date.now()}.${ext}`

  const supabase = getSupabase()
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, params.fileBuffer, { contentType: params.mimeType, upsert: false })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { prisma } = await import("@/lib/prisma")
  const doc = await prisma.enrollmentDocument.create({
    data: {
      enrollmentId: params.enrollmentId,
      documentType: params.documentType,
      storagePath,
      storageBucket: bucket,
      fileName: params.fileName,
      fileSize: params.fileBuffer.length,
      mimeType: params.mimeType,
      metadata: params.metadata ? (params.metadata as Record<string, string>) : undefined,
      expiresAt: params.expiresAt || null,
    },
  })

  const { data: urlData } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 86400)
  return { documentId: doc.id, url: urlData?.signedUrl || "" }
}

export async function getDocumentUrl(documentId: string, expiresIn = 86400): Promise<string> {
  const { prisma } = await import("@/lib/prisma")
  const doc = await prisma.enrollmentDocument.findUnique({ where: { id: documentId } })
  if (!doc) throw new Error("Document not found")

  const supabase = getSupabase()
  const { data, error } = await supabase.storage.from(doc.storageBucket).createSignedUrl(doc.storagePath, expiresIn)
  if (error) throw new Error(`URL generation failed: ${error.message}`)
  return data.signedUrl
}

export async function deleteDocument(documentId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  const doc = await prisma.enrollmentDocument.findUnique({ where: { id: documentId } })
  if (!doc) return

  const supabase = getSupabase()
  await supabase.storage.from(doc.storageBucket).remove([doc.storagePath])
  await prisma.enrollmentDocument.delete({ where: { id: documentId } })
}
