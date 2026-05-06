import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { prisma } = await import("@/lib/prisma")
  const existing = await prisma.syncJob.findFirst({ where: { type: "orders", status: { in: ["pending", "running"] } } })
  if (existing) return NextResponse.json({ jobId: existing.id, status: existing.status, message: "Orders sync already in progress" }, { status: 409 })
  const userId = (session.user as Record<string, unknown>).id as string
  const job = await prisma.syncJob.create({ data: { type: "orders", status: "running", triggeredBy: userId } })
  return NextResponse.json({ jobId: job.id, status: "running" }, { status: 202 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { prisma } = await import("@/lib/prisma")
  const job = await prisma.syncJob.findFirst({ where: { type: "orders" }, orderBy: { startedAt: "desc" } })
  if (!job) return NextResponse.json({ status: "none" })
  return NextResponse.json({ jobId: job.id, status: job.status, totalProcessed: job.totalProcessed, pagesProcessed: job.pagesProcessed, startedAt: job.startedAt, lastTickAt: job.lastTickAt, completedAt: job.completedAt, errorMessage: job.errorMessage })
}
