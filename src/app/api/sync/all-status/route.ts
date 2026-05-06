import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")

  const [clients, orders, payments, appointments] = await Promise.all([
    prisma.syncJob.findFirst({ where: { type: "clients" }, orderBy: { startedAt: "desc" } }),
    prisma.syncJob.findFirst({ where: { type: "orders" }, orderBy: { startedAt: "desc" } }),
    prisma.syncJob.findFirst({ where: { type: "payments" }, orderBy: { startedAt: "desc" } }),
    prisma.syncJob.findFirst({ where: { type: "appointments" }, orderBy: { startedAt: "desc" } }),
  ])

  // Metrics: find the most recently computed client
  const lastComputed = await prisma.client.findFirst({
    where: { metricsLastComputedAt: { not: null } },
    orderBy: { metricsLastComputedAt: "desc" },
    select: { metricsLastComputedAt: true },
  })
  const metricsCount = await prisma.client.count({ where: { metricsLastComputedAt: { not: null } } })

  const format = (job: typeof clients) => job ? {
    type: job.type,
    status: job.status,
    totalProcessed: job.totalProcessed,
    pagesProcessed: job.pagesProcessed,
    startedAt: job.startedAt,
    lastTickAt: job.lastTickAt,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage,
  } : null

  return NextResponse.json({
    clients: format(clients),
    orders: format(orders),
    payments: format(payments),
    appointments: format(appointments),
    metrics: { lastRun: lastComputed?.metricsLastComputedAt, processed: metricsCount },
  })
}
