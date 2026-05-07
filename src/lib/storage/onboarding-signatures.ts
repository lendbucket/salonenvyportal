import { createClient } from "@supabase/supabase-js"

const BUCKET = "onboarding-signatures"
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MIN_SIZE = 1024 // 1KB

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Uploads a base64 PNG signature to Supabase Storage.
 * Returns the storage path (not a signed URL — generate that on read).
 */
export async function uploadSignature(
  enrollmentId: string,
  base64Png: string,
): Promise<{ path: string; size: number }> {
  // Strip data URL prefix if present
  const raw = base64Png.replace(/^data:image\/\w+;base64,/, "")
  const buffer = Buffer.from(raw, "base64")

  if (buffer.length > MAX_SIZE) throw new Error("Signature too large (max 5MB)")
  if (buffer.length < MIN_SIZE) throw new Error("Signature too small (min 1KB)")

  const supabase = getSupabase()
  const filename = `${enrollmentId}-${Date.now()}.png`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: "image/png", upsert: false })

  if (error) throw new Error(`Signature upload failed: ${error.message}`)

  return { path: filename, size: buffer.length }
}

/**
 * Generates a signed URL for viewing a signature (24h expiry).
 */
export async function getSignatureUrl(path: string): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 24 * 60 * 60) // 24 hours

  if (error) throw new Error(`Failed to generate signed URL: ${error.message}`)
  return data.signedUrl
}
