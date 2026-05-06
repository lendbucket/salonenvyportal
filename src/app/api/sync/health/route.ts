import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    clientCount,
    orderCount,
    appointmentCount,
    paymentCount,
    totalRevenue,
    lastClientSync,
    lastOrderSync,
    lastApptSync,
    lastPaymentSync,
    metricsComputed,
    paymentsAggregate,
    paymentsLast30d,
    paymentsBySource,
    paymentsByLocation,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.squareOrder.count(),
    prisma.squareAppointment.count(),
    prisma.squarePayment.count(),
    prisma.squareOrder.aggregate({ _sum: { totalAmount: true }, where: { state: "COMPLETED" } }),
    prisma.syncJob.findFirst({ where: { type: "clients", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true, totalProcessed: true } }),
    prisma.syncJob.findFirst({ where: { type: "orders", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true, totalProcessed: true } }),
    prisma.syncJob.findFirst({ where: { type: "appointments", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true, totalProcessed: true } }),
    prisma.syncJob.findFirst({ where: { type: "payments", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true, totalProcessed: true } }),
    prisma.client.count({ where: { metricsLastComputedAt: { not: null } } }),
    prisma.squarePayment.aggregate({
      _sum: { totalAmount: true, refundedAmount: true },
      _count: true,
      where: { status: { in: ["COMPLETED", "APPROVED"] } },
    }),
    prisma.squarePayment.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { status: { in: ["COMPLETED", "APPROVED"] }, createdAtSquare: { gte: thirtyDaysAgo } },
    }),
    prisma.squarePayment.groupBy({
      by: ["sourceType"],
      where: { status: { in: ["COMPLETED", "APPROVED"] } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.squarePayment.groupBy({
      by: ["squareLocationId"],
      where: { status: { in: ["COMPLETED", "APPROVED"] } },
      _count: true,
      _sum: { totalAmount: true },
    }),
  ])

  const totalPaymentsRevenue = (paymentsAggregate._sum.totalAmount || 0) - (paymentsAggregate._sum.refundedAmount || 0)
  const avgTicket = paymentsAggregate._count > 0 ? totalPaymentsRevenue / paymentsAggregate._count : 0

  return NextResponse.json({
    counts: {
      clients: clientCount,
      orders: orderCount,
      appointments: appointmentCount,
      payments: paymentCount,
      metricsComputed,
    },
    revenue: {
      totalCompleted: totalRevenue._sum.totalAmount || 0,
    },
    payments: {
      total: paymentsAggregate._count,
      totalRevenue: totalPaymentsRevenue,
      last30dRevenue: paymentsLast30d._sum.totalAmount || 0,
      last30dCount: paymentsLast30d._count,
      avgTicket: Math.round(avgTicket * 100) / 100,
      bySourceType: paymentsBySource.map(s => ({
        sourceType: s.sourceType,
        count: s._count,
        amount: s._sum.totalAmount || 0,
      })),
      byLocation: paymentsByLocation.map(l => ({
        locationId: l.squareLocationId,
        count: l._count,
        amount: l._sum.totalAmount || 0,
      })),
    },
    lastSync: {
      clients: lastClientSync ? { completedAt: lastClientSync.completedAt, totalProcessed: lastClientSync.totalProcessed } : null,
      orders: lastOrderSync ? { completedAt: lastOrderSync.completedAt, totalProcessed: lastOrderSync.totalProcessed } : null,
      payments: lastPaymentSync ? { completedAt: lastPaymentSync.completedAt, totalProcessed: lastPaymentSync.totalProcessed } : null,
      appointments: lastApptSync ? { completedAt: lastApptSync.completedAt, totalProcessed: lastApptSync.totalProcessed } : null,
    },
  })
}
