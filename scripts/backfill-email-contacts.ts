/**
 * Backfill EmailContact records for all existing clients with email addresses.
 * Creates EmailContact entries linked to Client rows where email IS NOT NULL.
 * Idempotent — running twice does nothing on second run (upserts by email).
 *
 * Run: npm run backfill:email-contacts
 */

import { PrismaClient } from "@prisma/client"

const BATCH_SIZE = 100

async function main() {
  const prisma = new PrismaClient()

  try {
    const clients = await prisma.client.findMany({
      where: { email: { not: null } },
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
    })

    console.log(`Found ${clients.length} clients with email addresses to process`)

    let created = 0
    let skipped = 0

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE)

      // Check which clients already have an EmailContact
      const existingContacts = await prisma.emailContact.findMany({
        where: {
          clientId: { in: batch.map(c => c.id) },
        },
        select: { clientId: true },
      })
      const existingSet = new Set(existingContacts.map(r => r.clientId))

      const toCreate = batch.filter(c => !existingSet.has(c.id) && c.email)

      if (toCreate.length > 0) {
        for (const client of toCreate) {
          try {
            await prisma.emailContact.upsert({
              where: { email: client.email! },
              create: {
                clientId: client.id,
                email: client.email!,
                firstName: client.firstName,
                lastName: client.lastName,
                consentSource: "salonenvyusa.com/book",
                consentMethod: "BACKFILL_LEGACY",
                isOptedIn: true,
                optedInAt: client.createdAt || new Date(),
              },
              update: {
                // If contact exists by email but not linked to this client, link it
                clientId: client.id,
                firstName: client.firstName || undefined,
                lastName: client.lastName || undefined,
              },
            })
            created++
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            // Skip duplicates gracefully
            if (msg.includes("Unique constraint")) {
              skipped++
            } else {
              console.error(`  Error for client ${client.id} (${client.email}): ${msg}`)
              skipped++
            }
          }
        }
      } else {
        skipped += batch.length
      }

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: processed ${batch.length} clients`)
    }

    console.log(`\nDone. Total clients with email: ${clients.length} | Created: ${created} | Skipped: ${skipped}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error("Backfill failed:", e.message)
  process.exit(1)
})
