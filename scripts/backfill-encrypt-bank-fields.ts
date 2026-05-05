/**
 * Backfill script: encrypts existing plain-text bank fields in OnboardingEnrollment.
 *
 * Prerequisites:
 *   1. BANK_ENCRYPTION_KEY must be set in .env.local (base64-encoded 32-byte key)
 *   2. Run with: npm run backfill:bank-encrypt
 *
 * This script is idempotent — running it twice will skip already-encrypted rows.
 * It NEVER prints plaintext bank values.
 */

import { PrismaClient } from "@prisma/client"
import { encryptBankField, isEncrypted } from "../src/lib/crypto/bank-encryption"

async function main() {
  if (!process.env.BANK_ENCRYPTION_KEY) {
    console.error("ERROR: BANK_ENCRYPTION_KEY is not set. Aborting.")
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    const rows = await prisma.onboardingEnrollment.findMany({
      where: {
        OR: [
          { ddRoutingNumber: { not: null } },
          { ddAccountNumber: { not: null } },
        ],
      },
      select: {
        id: true,
        ddRoutingNumber: true,
        ddAccountNumber: true,
      },
    })

    console.log(`Found ${rows.length} rows with bank data`)

    let encrypted = 0
    let skipped = 0

    for (const row of rows) {
      const updates: Record<string, string> = {}
      let fieldsEncrypted: string[] = []

      // ddRoutingNumber
      if (row.ddRoutingNumber && !isEncrypted(row.ddRoutingNumber)) {
        updates.ddRoutingNumber = encryptBankField(row.ddRoutingNumber)
        fieldsEncrypted.push("ddRoutingNumber")
      }

      // ddAccountNumber
      if (row.ddAccountNumber && !isEncrypted(row.ddAccountNumber)) {
        updates.ddAccountNumber = encryptBankField(row.ddAccountNumber)
        fieldsEncrypted.push("ddAccountNumber")
      }

      if (Object.keys(updates).length > 0) {
        await prisma.onboardingEnrollment.update({
          where: { id: row.id },
          data: updates,
        })
        encrypted++
        console.log(`  [OK] ${row.id} — encrypted: ${fieldsEncrypted.join(", ")}`)
      } else {
        skipped++
        console.log(`  [SKIP] ${row.id} — already encrypted or masked`)
      }
    }

    console.log(`\nDone. Total: ${rows.length} | Encrypted: ${encrypted} | Skipped: ${skipped}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error("Backfill failed:", e.message)
  process.exit(1)
})
