/**
 * Backfill SMS consent records for all existing clients.
 * Creates OptInRecord entries for clients with smsMarketingConsent=true.
 * Idempotent — running twice does nothing on second run.
 *
 * Run: npm run backfill:sms-consent
 */

import { PrismaClient } from "@prisma/client"

const BATCH_SIZE = 100

async function main() {
  const prisma = new PrismaClient()

  try {
    const clients = await prisma.client.findMany({
      where: { smsMarketingConsent: true, smsOptedOutAt: null },
      select: { id: true, createdAt: true },
    })

    console.log(`Found ${clients.length} opted-in clients to process`)

    let created = 0
    let skipped = 0

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE)
      const now = new Date()

      // Check which clients already have an OptInRecord
      const existingRecords = await prisma.optInRecord.findMany({
        where: {
          clientId: { in: batch.map(c => c.id) },
          channel: "SMS",
          action: "OPT_IN",
        },
        select: { clientId: true },
      })
      const existingSet = new Set(existingRecords.map(r => r.clientId))

      const toCreate = batch.filter(c => !existingSet.has(c.id))
      skipped += batch.length - toCreate.length

      if (toCreate.length > 0) {
        await prisma.$transaction([
          prisma.optInRecord.createMany({
            data: toCreate.map(c => ({
              clientId: c.id,
              channel: "SMS",
              action: "OPT_IN",
              method: "BACKFILL_LEGACY",
              source: "salonenvyusa.com/book",
              consentLanguage: "Existing client opted in via booking form (backfilled 2026-05)",
              metadata: { backfillBatch: now.toISOString(), originalClientCreatedAt: c.createdAt.toISOString() },
            })),
          }),
          ...toCreate.map(c =>
            prisma.client.update({
              where: { id: c.id },
              data: {
                smsConsentTimestamp: c.createdAt || now,
                smsConsentMethod: "BOOKING_FORM",
                smsConsentSource: "salonenvyusa.com/book",
              },
            })
          ),
        ])
        created += toCreate.length
      }

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${toCreate.length} created, ${batch.length - toCreate.length} skipped`)
    }

    console.log(`\nDone. Total: ${clients.length} | Created: ${created} | Skipped: ${skipped}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error("Backfill failed:", e.message)
  process.exit(1)
})
