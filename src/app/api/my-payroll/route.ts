import { NextResponse } from "next/server"
import { requireStylistContext } from "@/lib/auth/get-stylist-context"
import { getCurrentPayPeriod } from "@/lib/payrollUtils"

export async function GET() {
  let ctx
  try {
    ctx = await requireStylistContext()
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!ctx.squareTeamMemberId) {
    return NextResponse.json({ current: null, history: [], ytd: { services: 0, subtotal: 0, commission: 0, tips: 0, total: 0 } })
  }

  const { prisma } = await import("@/lib/prisma")

  const entries = await prisma.payrollEntry.findMany({
    where: { teamMemberId: ctx.squareTeamMemberId },
    include: { period: true },
    orderBy: { period: { periodStart: "desc" } },
  })

  const currentPeriod = getCurrentPayPeriod()
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)

  let current = null
  const history: Array<{
    periodId: string
    periodStart: string
    periodEnd: string
    serviceCount: number
    serviceSubtotal: number
    commission: number
    tips: number
    totalPayout: number
    status: string
    paidAt: string | null
  }> = []

  let ytdServices = 0
  let ytdSubtotal = 0
  let ytdCommission = 0
  let ytdTips = 0

  for (const entry of entries) {
    const periodStart = entry.period.periodStart
    const periodEnd = entry.period.periodEnd

    const record = {
      periodId: entry.periodId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      serviceCount: entry.serviceCount,
      serviceSubtotal: entry.serviceSubtotal,
      commission: entry.commission,
      tips: entry.tips,
      totalPayout: entry.totalPayout,
      status: entry.period.status,
      paidAt: entry.period.paidAt?.toISOString() ?? null,
    }

    // Check if this entry is in the current pay period
    if (periodStart.getTime() === currentPeriod.start.getTime() && periodEnd.getTime() === currentPeriod.end.getTime()) {
      current = record
    }

    history.push(record)

    // YTD calculation — include if periodStart is in current calendar year
    if (periodStart >= yearStart) {
      ytdServices += entry.serviceCount
      ytdSubtotal += entry.serviceSubtotal
      ytdCommission += entry.commission
      ytdTips += entry.tips
    }
  }

  return NextResponse.json({
    current,
    history,
    ytd: {
      services: ytdServices,
      subtotal: Math.round(ytdSubtotal * 100) / 100,
      commission: Math.round(ytdCommission * 100) / 100,
      tips: Math.round(ytdTips * 100) / 100,
      total: Math.round((ytdCommission + ytdTips) * 100) / 100,
    },
  })
}
