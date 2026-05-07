/**
 * Creates all required Supabase Storage buckets for onboarding.
 * Idempotent — skips existing buckets.
 * Run: npm run setup:storage-buckets
 */

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BUCKETS = [
  { name: "onboarding-signatures", publicAccess: false, sizeLimit: 5_000_000, mimeTypes: ["image/png", "image/jpeg"] },
  { name: "onboarding-licenses", publicAccess: false, sizeLimit: 10_000_000, mimeTypes: ["image/png", "image/jpeg", "application/pdf"] },
  { name: "onboarding-gov-ids", publicAccess: false, sizeLimit: 10_000_000, mimeTypes: ["image/png", "image/jpeg"] },
  { name: "onboarding-insurance", publicAccess: false, sizeLimit: 10_000_000, mimeTypes: ["image/png", "image/jpeg", "application/pdf"] },
  { name: "onboarding-agreements", publicAccess: false, sizeLimit: 10_000_000, mimeTypes: ["application/pdf", "image/png"] },
  { name: "onboarding-i9", publicAccess: false, sizeLimit: 10_000_000, mimeTypes: ["image/png", "image/jpeg", "application/pdf"] },
]

async function main() {
  console.log("Setting up Supabase Storage buckets...")
  for (const config of BUCKETS) {
    const { data: existing } = await supabase.storage.getBucket(config.name)
    if (existing) {
      console.log(`  ${config.name} — already exists, skipping`)
      continue
    }
    const { error } = await supabase.storage.createBucket(config.name, {
      public: config.publicAccess,
      fileSizeLimit: config.sizeLimit,
      allowedMimeTypes: config.mimeTypes,
    })
    if (error) {
      console.error(`  ${config.name} — FAILED: ${error.message}`)
    } else {
      console.log(`  ${config.name} — created`)
    }
  }
  console.log("Done.")
}

main().catch(e => { console.error("Setup failed:", e); process.exit(1) })
