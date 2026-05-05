import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId, role } = session.user as { id: string; role: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locationId = (session.user as any).locationId as string | undefined
    const period = req.nextUrl.searchParams.get("period") // weekly | monthly

    const where: Record<string, unknown> = { status: { not: "paused" } }

    if (period) {
      where.period = period
    }

    if (role === "STYLIST") {
      // Look up staffMember to get squareTeamMemberId
      const staffMember = await prisma.staffMember.findFirst({
        where: { userId },
      })
      if (!staffMember) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
      }
      where.staffMemberId = staffMember.squareTeamMemberId ?? staffMember.id
    } else if (role === "MANAGER") {
      if (locationId) {
        where.locationId = locationId
      }
    }
    // OWNER sees all — no additional filter

    const goals = await prisma.performanceGoal.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ goals })
  } catch (error) {
    console.error("GET /api/performance/goals error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId, role } = session.user as { id: string; role: string }

    if (role === "STYLIST") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const {
      staffMemberId,
      locationId,
      goalType,
      targetValue,
      bonusAmount,
      bonusType,
      period,
      periodStart,
      periodEnd,
    } = body

    if (!staffMemberId || !locationId || !goalType || !targetValue || !period || !periodStart || !periodEnd) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (typeof targetValue !== "number" || targetValue <= 0) {
      return NextResponse.json({ error: "targetValue must be greater than 0" }, { status: 400 })
    }

    const start = new Date(periodStart)
    const end = new Date(periodEnd)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json({ error: "periodEnd must be after periodStart" }, { status: 400 })
    }

    // MANAGER can only create goals for their own location
    if (role === "MANAGER") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userLocationId = (session.user as any).locationId
      if (userLocationId && userLocationId !== locationId) {
        return NextResponse.json({ error: "Managers can only create goals for their own location" }, { status: 403 })
      }
    }

    const goal = await prisma.performanceGoal.create({
      data: {
        staffMemberId,
        locationId,
        goalType,
        targetValue,
        bonusAmount: bonusAmount ?? null,
        bonusType: bonusType ?? null,
        period,
        periodStart: start,
        periodEnd: end,
        createdBy: userId,
      },
    })

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    console.error("POST /api/performance/goals error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
