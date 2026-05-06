import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")

  const [
    clientCount,
    orderCount,
    appointmentCount,
    totalRevenue,
    lastClientSync,
    lastOrderSync,
    lastApptSync,
    metricsComputed,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.squareOrder.count(),
    prisma.squareAppointment.count(),
    prisma.squareOrder.aggregate({ _sum: { totalAmount: true }, where: { state: "COMPLETED" } }),
    prisma.syncJob.findFirst({ where: { type: "clients", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true, totalProcessed: true } }),
    prisma.syncJob.findFirst({ where: { type: "orders", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true, totalProcessed: true } }),
    prisma.syncJob.findFirst({ where: { type: "appointments", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true, totalProcessed: true } }),
    prisma.client.count({ where: { metricsLastComputedAt: { not: null } } }),
  ])

  return NextResponse.json({
    counts: {
      clients: clientCount,
      orders: orderCount,
      appointments: appointmentCount,
      metricsComputed,
    },
    revenue: {
      totalCompleted: totalRevenue._sum.totalAmount || 0,
    },
    lastSync: {
      clients: lastClientSync ? { completedAt: lastClientSync.completedAt, totalProcessed: lastClientSync.totalProcessed } : null,
      orders: lastOrderSync ? { completedAt: lastOrderSync.completedAt, totalProcessed: lastOrderSync.totalProcessed } : null,
      appointments: lastApptSync ? { completedAt: lastApptSync.completedAt, totalProcessed: lastApptSync.totalProcessed } : null,
    },
  })
}
