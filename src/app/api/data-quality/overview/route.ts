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
    paymentsTotal,
    ordersTotal,
    clientCount,
    clientsWithPayments,
    clientsWithAppointments,
    paymentsBySource,
    paymentsByLocation,
    lastClientSync,
    lastOrderSync,
    lastPaymentSync,
    lastApptSync,
  ] = await Promise.all([
    prisma.squarePayment.aggregate({
      _sum: { totalAmount: true, refundedAmount: true },
      _count: true,
      where: { status: { in: ["COMPLETED", "APPROVED"] } },
    }),
    prisma.squareOrder.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { state: "COMPLETED" },
    }),
    prisma.client.count(),
    prisma.squarePayment.groupBy({
      by: ["clientId"],
      where: { clientId: { not: null }, status: { in: ["COMPLETED", "APPROVED"] } },
    }),
    prisma.squareAppointment.groupBy({
      by: ["clientId"],
      where: { clientId: { not: null } },
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
    prisma.syncJob.findFirst({ where: { type: "clients", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
    prisma.syncJob.findFirst({ where: { type: "orders", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
    prisma.syncJob.findFirst({ where: { type: "payments", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
    prisma.syncJob.findFirst({ where: { type: "appointments", status: "completed" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
  ])

  const recentPayments = await prisma.squarePayment.aggregate({
    _sum: { totalAmount: true },
    _count: true,
    where: { status: { in: ["COMPLETED", "APPROVED"] }, createdAtSquare: { gte: thirtyDaysAgo } },
  })

  const paymentsRevenue = (paymentsTotal._sum.totalAmount || 0) - (paymentsTotal._sum.refundedAmount || 0)
  const ordersRevenue = ordersTotal._sum.totalAmount || 0

  return NextResponse.json({
    revenue: {
      paymentsTotal: paymentsTotal._sum.totalAmount || 0,
      paymentsNet: paymentsRevenue,
      ordersTotal: ordersRevenue,
      gap: paymentsRevenue - ordersRevenue,
      last30d: recentPayments._sum.totalAmount || 0,
      last30dCount: recentPayments._count,
    },
    counts: {
      payments: paymentsTotal._count,
      orders: ordersTotal._count,
      clients: clientCount,
    },
    clientCoverage: {
      withPayments: clientsWithPayments.length,
      withAppointments: clientsWithAppointments.length,
      total: clientCount,
      paymentPct: clientCount > 0 ? Math.round((clientsWithPayments.length / clientCount) * 100) : 0,
      appointmentPct: clientCount > 0 ? Math.round((clientsWithAppointments.length / clientCount) * 100) : 0,
    },
    sourceBreakdown: paymentsBySource.map(s => ({
      sourceType: s.sourceType,
      count: s._count,
      amount: s._sum.totalAmount || 0,
    })),
    locationSplit: paymentsByLocation.map(l => ({
      locationId: l.squareLocationId,
      count: l._count,
      amount: l._sum.totalAmount || 0,
    })),
    syncHealth: {
      clients: lastClientSync?.completedAt || null,
      orders: lastOrderSync?.completedAt || null,
      payments: lastPaymentSync?.completedAt || null,
      appointments: lastApptSync?.completedAt || null,
    },
  })
}
