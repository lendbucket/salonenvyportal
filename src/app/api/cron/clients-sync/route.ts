import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fast-exit: check for running job before importing heavy worker module
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()

  try {
    const job = await prisma.syncJob.findFirst({
      where: { type: "clients", status: "running" },
      orderBy: { startedAt: "asc" },
      select: { id: true, lastTickAt: true },
    })

    if (!job) {
      return NextResponse.json({ ok: true, idle: true })
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

    // Only import worker when there's actual work to do
    const { processClientsSyncBatch } = await import("@/lib/sync/clients-worker")
    const result = await processClientsSyncBatch(job.id)
    return NextResponse.json({ jobId: job.id, ...result })
  } finally {
    await prisma.$disconnect()
  }
}
