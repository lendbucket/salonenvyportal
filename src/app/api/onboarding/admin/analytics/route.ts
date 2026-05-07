import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 86400000)
  const sevenDaysAgo = new Date(now - 7 * 86400000)

  const allEnrollments = await prisma.onboardingEnrollment.findMany({
    select: { id: true, status: true, createdAt: true, completedAt: true },
  })

  const total = allEnrollments.length
  const last30d = allEnrollments.filter(e => e.createdAt >= thirtyDaysAgo).length
  const last7d = allEnrollments.filter(e => e.createdAt >= sevenDaysAgo).length
  const completed = allEnrollments.filter(e => ["active", "completed", "square_synced"].includes(e.status))
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0

  // Average time to complete (days)
  const completedWithTime = completed.filter(e => e.completedAt)
  const avgDays = completedWithTime.length > 0
    ? Math.round(completedWithTime.reduce((sum, e) => sum + (e.completedAt!.getTime() - e.createdAt.getTime()) / 86400000, 0) / completedWithTime.length)
    : 0

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const e of allEnrollments) statusCounts[e.status] = (statusCounts[e.status] || 0) + 1

  const pendingReview = statusCounts["pending_review"] || statusCounts["signed"] || 0

  // BG check stats
  const bgChecks = await prisma.onboardingEnrollment.groupBy({
    by: ["bgCheckStatus"],
    where: { bgCheckStatus: { not: null } },
    _count: true,
  })
  const bgStats: Record<string, number> = {}
  for (const r of bgChecks) bgStats[r.bgCheckStatus || "unknown"] = r._count

  return NextResponse.json({
    total, last30d, last7d, completionRate, avgDays, pendingReview,
    statusCounts, bgStats,
    recentEnrollments: allEnrollments.filter(e => e.createdAt >= thirtyDaysAgo).length,
  })
}
