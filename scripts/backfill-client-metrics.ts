import { PrismaClient } from "@prisma/client"
import { computeMetricsForClient } from "../src/lib/metrics/compute-client-metrics"

async function main() {
  const prisma = new PrismaClient()
  try {
    const totalClients = await prisma.client.count()
    console.log(`[backfill] Starting metrics computation for ${totalClients} clients...`)

    const batchSize = 50
    let offset = 0
    let processed = 0
    let errors = 0

    while (offset < totalClients) {
      const clients = await prisma.client.findMany({
        skip: offset,
        take: batchSize,
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })

      for (const client of clients) {
        try {
          await computeMetricsForClient(client.id, prisma)
          processed++
        } catch (err) {
          errors++
          console.error(`[backfill] Error for client ${client.id}:`, err instanceof Error ? err.message : err)
        }
      }

      offset += batchSize
      console.log(`[backfill] Progress: ${processed}/${totalClients} (${errors} errors)`)
    }

    console.log(`[backfill] Done. Processed: ${processed}, Errors: ${errors}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error("[backfill] Fatal error:", err)
  process.exit(1)
})
