import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")

  // Check for existing in-progress job
  const existing = await prisma.syncJob.findFirst({
    where: { type: "clients", status: { in: ["pending", "running"] } },
    orderBy: { startedAt: "desc" },
  })

  if (existing) {
    return NextResponse.json({ jobId: existing.id, status: existing.status, message: "Sync already in progress" }, { status: 409 })
  }

  const userId = (session.user as Record<string, unknown>).id as string
  const job = await prisma.syncJob.create({
    data: { type: "clients", status: "running", triggeredBy: userId },
  })

  return NextResponse.json({ jobId: job.id, status: "running" }, { status: 202 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")

  const job = await prisma.syncJob.findFirst({
    where: { type: "clients" },
    orderBy: { startedAt: "desc" },
  })

  if (!job) {
    return NextResponse.json({ jobId: null, status: "none" })
  }

  const isStale = job.status === "running" && (Date.now() - job.lastTickAt.getTime() > 3 * 60 * 1000)

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    totalProcessed: job.totalProcessed,
    pagesProcessed: job.pagesProcessed,
    totalEstimate: job.totalEstimate,
    startedAt: job.startedAt.toISOString(),
    lastTickAt: job.lastTickAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    isStale,
  })
}
