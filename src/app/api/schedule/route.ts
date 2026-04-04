import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const locationId = req.nextUrl.searchParams.get("locationId")
  const weekStart = req.nextUrl.searchParams.get("weekStart")

  const schedules = await prisma.schedule.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      ...(weekStart ? { weekStart: new Date(weekStart) } : {}),
    },
    include: {
      shifts: { include: { staffMember: true } },
      location: true,
    },
    orderBy: { weekStart: "desc" },
    take: 10,
  })

  return NextResponse.json({ schedules })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { locationId, weekStart, weekEnd, notes } = await req.json()

  const schedule = await prisma.schedule.create({
    data: {
      locationId,
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd),
      status: "draft",
      createdById: session.user.id,
      notes,
    },
  })

  return NextResponse.json({ schedule })
}
