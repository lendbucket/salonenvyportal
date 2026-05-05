import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CC_LOCATION_ID, SA_LOCATION_ID, ALL_STAFF } from "@/lib/staff"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId, role } = session.user as { id: string; role: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locationId = (session.user as any).locationId as string | undefined

    const where: Record<string, unknown> = {}

    if (role === "STYLIST") {
      const staffMember = await prisma.staffMember.findFirst({
        where: { userId },
      })
      if (!staffMember) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
      }
      where.staffMemberId = staffMember.squareTeamMemberId ?? staffMember.id
    } else if (role === "MANAGER") {
      // MANAGER sees bonuses for staff at their location
      if (locationId) {
        // Find the location's Square location ID to determine which staff belong
        const location = await prisma.location.findUnique({
          where: { id: locationId },
        })
        const squareLocationId = location?.squareLocationId
        const locationName = squareLocationId === CC_LOCATION_ID ? "Corpus Christi"
          : squareLocationId === SA_LOCATION_ID ? "San Antonio"
          : null

        if (locationName) {
          const locationStaffIds = ALL_STAFF
            .filter((s) => s.location === locationName)
            .map((s) => s.id)
          where.staffMemberId = { in: locationStaffIds }
        }
      }
    }
    // OWNER sees all — no additional filter

    const bonuses = await prisma.performanceBonus.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ bonuses })
  } catch (error) {
    console.error("GET /api/performance/bonuses error:", error)
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

    if (role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden — OWNER only" }, { status: 403 })
    }

    const body = await req.json()
    const { staffMemberId, amount, reason, period, periodStart, periodEnd } = body

    if (!staffMemberId || !amount || !reason || !period || !periodStart || !periodEnd) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 })
    }

    const start = new Date(periodStart)
    const end = new Date(periodEnd)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json({ error: "periodEnd must be after periodStart" }, { status: 400 })
    }

    const bonus = await prisma.performanceBonus.create({
      data: {
        staffMemberId,
        amount,
        reason,
        period,
        periodStart: start,
        periodEnd: end,
        status: "pending",
        approvedBy: userId,
        approvedAt: new Date(),
      },
    })

    return NextResponse.json({ bonus }, { status: 201 })
  } catch (error) {
    console.error("POST /api/performance/bonuses error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId, role } = session.user as { id: string; role: string }

    if (role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden — OWNER only" }, { status: 403 })
    }

    const body = await req.json()
    const { id, status, notes } = body

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 })
    }

    const validStatuses = ["pending", "approved", "paid", "cancelled"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const existing = await prisma.performanceBonus.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Bonus not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { status }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    if (status === "approved") {
      updateData.approvedBy = userId
      updateData.approvedAt = new Date()
    }

    if (status === "paid") {
      updateData.paidAt = new Date()
    }

    const bonus = await prisma.performanceBonus.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ bonus })
  } catch (error) {
    console.error("PATCH /api/performance/bonuses error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
