import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as Record<string, unknown>
    if (user.role !== "OWNER" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("locationId")

    const where: Record<string, unknown> = {}
    if (locationId) where.locationId = locationId

    const rentals = await prisma.boothRental.findMany({
      where,
      include: { payments: { orderBy: { dueDate: "desc" } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ rentals })
  } catch (error) {
    console.error("Booth rentals GET error:", error)
    return NextResponse.json({ error: "Failed to fetch booth rentals" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as Record<string, unknown>
    if (user.role !== "OWNER" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { locationId, renterName, renterEmail, renterPhone, boothNumber, rentalType, weeklyRate, monthlyRate, startDate, endDate, depositAmount, notes } = body

    if (!locationId || !renterName || !rentalType || !startDate) {
      return NextResponse.json({ error: "Missing required fields: locationId, renterName, rentalType, startDate" }, { status: 400 })
    }

    const rental = await prisma.boothRental.create({
      data: {
        locationId,
        renterName,
        renterEmail: renterEmail || null,
        renterPhone: renterPhone || null,
        boothNumber: boothNumber || null,
        rentalType,
        weeklyRate: weeklyRate ? parseFloat(weeklyRate) : null,
        monthlyRate: monthlyRate ? parseFloat(monthlyRate) : null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        depositAmount: depositAmount ? parseFloat(depositAmount) : null,
        notes: notes || null,
      },
    })

    return NextResponse.json({ rental }, { status: 201 })
  } catch (error) {
    console.error("Booth rentals POST error:", error)
    return NextResponse.json({ error: "Failed to create booth rental" }, { status: 500 })
  }
}
