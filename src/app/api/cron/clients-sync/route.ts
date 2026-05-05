import { NextRequest, NextResponse } from "next/server"
import { processClientsSyncBatch } from "@/lib/sync/clients-worker"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")

  // Find oldest running sync job
  const job = await prisma.syncJob.findFirst({
    where: { type: "clients", status: "running" },
    orderBy: { startedAt: "asc" },
  })

  if (!job) {
    return NextResponse.json({ idle: true })
  }

  // Check for stale jobs (no progress for 5 minutes)
  const staleThreshold = 5 * 60 * 1000
  if (Date.now() - job.lastTickAt.getTime() > staleThreshold) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: "Stale job — no progress for 5 minutes", lastTickAt: new Date() },
    })
    return NextResponse.json({ staleJobFailed: job.id })
  }

  const result = await processClientsSyncBatch(job.id)
  return NextResponse.json({ jobId: job.id, ...result })
}
