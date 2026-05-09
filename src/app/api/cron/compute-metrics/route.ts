import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { computeMetricsForClient } from "@/lib/metrics/compute-client-metrics"

export const maxDuration = 60

const BATCH_SIZE = 200
const SOFT_DEADLINE_MS = 50_000

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const prisma = new PrismaClient()
  try {
    // Process clients that haven't had metrics computed recently (oldest first)
    const clients = await prisma.client.findMany({
      orderBy: { metricsLastComputedAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true },
    })

    const startTime = Date.now()
    let processed = 0
    let errors = 0

    for (const client of clients) {
      if (Date.now() - startTime > SOFT_DEADLINE_MS) break
      try {
        await computeMetricsForClient(client.id, prisma)
        processed++
      } catch (err) {
        console.error(`[compute-metrics] Error for client ${client.id}:`, err instanceof Error ? err.message : err)
        errors++
      }
    }

    return NextResponse.json({ processed, errors, total: clients.length })
  } finally {
    await prisma.$disconnect()
  }
}
