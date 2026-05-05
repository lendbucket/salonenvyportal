import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId, role } = session.user as { id: string; role: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locationId = (session.user as any).locationId as string | undefined
    const { id } = await params

    const goal = await prisma.performanceGoal.findUnique({
      where: { id },
    })

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    // Access control
    if (role === "STYLIST") {
      const staffMember = await prisma.staffMember.findFirst({
        where: { userId },
      })
      const myStaffId = staffMember?.squareTeamMemberId ?? staffMember?.id
      if (goal.staffMemberId !== myStaffId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (role === "MANAGER") {
      if (locationId && goal.locationId !== locationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Calculate progress percentage
    const progress = goal.targetValue > 0
      ? Math.min(Math.round((goal.currentValue / goal.targetValue) * 100 * 100) / 100, 100)
      : 0

    return NextResponse.json({
      goal: {
        ...goal,
        progress,
        isComplete: goal.currentValue >= goal.targetValue,
      },
    })
  } catch (error) {
    console.error("GET /api/performance/goals/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role } = session.user as { id: string; role: string }

    if (role === "STYLIST") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.performanceGoal.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    // MANAGER can only update goals for their own location
    if (role === "MANAGER") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locationId = (session.user as any).locationId
      if (locationId && existing.locationId !== locationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Build update data — only allow specific fields
    const updateData: Record<string, unknown> = {}
    if (body.goalType !== undefined) updateData.goalType = body.goalType
    if (body.targetValue !== undefined) {
      if (typeof body.targetValue !== "number" || body.targetValue <= 0) {
        return NextResponse.json({ error: "targetValue must be greater than 0" }, { status: 400 })
      }
      updateData.targetValue = body.targetValue
    }
    if (body.currentValue !== undefined) updateData.currentValue = body.currentValue
    if (body.bonusAmount !== undefined) updateData.bonusAmount = body.bonusAmount
    if (body.bonusType !== undefined) updateData.bonusType = body.bonusType
    if (body.status !== undefined) updateData.status = body.status
    if (body.notifyOnHit !== undefined) updateData.notifyOnHit = body.notifyOnHit

    if (body.periodStart !== undefined || body.periodEnd !== undefined) {
      const newStart = body.periodStart ? new Date(body.periodStart) : existing.periodStart
      const newEnd = body.periodEnd ? new Date(body.periodEnd) : existing.periodEnd
      if (newEnd <= newStart) {
        return NextResponse.json({ error: "periodEnd must be after periodStart" }, { status: 400 })
      }
      if (body.periodStart) updateData.periodStart = newStart
      if (body.periodEnd) updateData.periodEnd = newEnd
    }

    const goal = await prisma.performanceGoal.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ goal })
  } catch (error) {
    console.error("PUT /api/performance/goals/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role } = session.user as { id: string; role: string }

    if (role === "STYLIST") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.performanceGoal.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    // MANAGER can only soft-delete goals for their own location
    if (role === "MANAGER") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locationId = (session.user as any).locationId
      if (locationId && existing.locationId !== locationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Soft delete — set status to paused
    const goal = await prisma.performanceGoal.update({
      where: { id },
      data: { status: "paused" },
    })

    return NextResponse.json({ goal })
  } catch (error) {
    console.error("DELETE /api/performance/goals/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
