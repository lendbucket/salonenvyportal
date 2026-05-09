import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // KILL SWITCH — set PORTAL_KILL_SWITCH=true in Vercel env vars to disable
  if (process.env.PORTAL_KILL_SWITCH === "true") {
    return NextResponse.json({ disabled: true, reason: "kill_switch_active" }, { status: 200 })
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()

  try {
    const job = await prisma.syncJob.findFirst({
      where: { type: "appointments", status: "running" },
      orderBy: { startedAt: "asc" },
      select: { id: true, lastTickAt: true },
    })

    if (!job) {
      return NextResponse.json({ ok: true, idle: true })
    }

    if (Date.now() - job.lastTickAt.getTime() > 5 * 60 * 1000) {
      await prisma.syncJob.update({ where: { id: job.id }, data: { status: "failed", errorMessage: "Stale job — no progress for 5 minutes" } })
      return NextResponse.json({ staleJobFailed: job.id })
    }

    const { processAppointmentsSyncBatch } = await import("@/lib/sync/appointments-worker")
    const result = await processAppointmentsSyncBatch(job.id)
    return NextResponse.json({ jobId: job.id, ...result })
  } finally {
    await prisma.$disconnect()
  }
}
