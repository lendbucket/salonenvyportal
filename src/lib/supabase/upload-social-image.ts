import { getSupabaseClient } from "./client"

const BUCKET = "social-media"
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function uploadSocialImage(
  file: File,
  locationId: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}. Use JPEG, PNG, or WebP.`)
  }

  if (file.size > MAX_SIZE) {
    throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`)
  }

  const ext = EXT_MAP[file.type] || "jpg"
  const rand = Math.random().toString(36).slice(2, 8)
  const folder = locationId === "CC" || locationId === "SA" ? locationId : "BOTH"
  const filename = `${folder}/${Date.now()}-${rand}.${ext}`

  const client = getSupabaseClient()

  const { error } = await client.storage
    .from(BUCKET)
    .upload(filename, file, { contentType: file.type, upsert: false })

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`)
  }

  const { data } = client.storage
    .from(BUCKET)
    .getPublicUrl(filename)

  return data.publicUrl
}
