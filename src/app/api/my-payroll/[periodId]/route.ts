import { NextRequest, NextResponse } from "next/server"
import { requireStylistContext } from "@/lib/auth/get-stylist-context"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  let ctx
  try {
    ctx = await requireStylistContext()
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!ctx.squareTeamMemberId) {
    return NextResponse.json({ error: "No team member linked" }, { status: 404 })
  }

  const { periodId } = await params
  const { prisma } = await import("@/lib/prisma")

  const entry = await prisma.payrollEntry.findFirst({
    where: {
      periodId,
      teamMemberId: ctx.squareTeamMemberId,
    },
    include: { period: true },
  })

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    periodId: entry.periodId,
    periodStart: entry.period.periodStart.toISOString(),
    periodEnd: entry.period.periodEnd.toISOString(),
    status: entry.period.status,
    paidAt: entry.period.paidAt?.toISOString() ?? null,
    teamMemberName: entry.teamMemberName,
    locationId: entry.locationId,
    serviceCount: entry.serviceCount,
    serviceSubtotal: entry.serviceSubtotal,
    commission: entry.commission,
    tips: entry.tips,
    totalPayout: entry.totalPayout,
    stylistName: ctx.fullName,
    stylistEmail: ctx.email,
  })
}
