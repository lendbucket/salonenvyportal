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

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 })
    }

    const model = await prisma.businessModel.findUnique({ where: { locationId } })
    return NextResponse.json({ model })
  } catch (error) {
    console.error("Business model GET error:", error)
    return NextResponse.json({ error: "Failed to fetch business model" }, { status: 500 })
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
    const { locationId, modelType, commissionRate, salesTaxRate, boothRentalRate, suiteRentalRate, w2PayrollEnabled, fiscalYearStart, notes } = body

    if (!locationId || !modelType) {
      return NextResponse.json({ error: "Missing required fields: locationId, modelType" }, { status: 400 })
    }

    const model = await prisma.businessModel.upsert({
      where: { locationId },
      update: {
        modelType,
        ...(commissionRate !== undefined && { commissionRate: parseFloat(commissionRate) }),
        ...(salesTaxRate !== undefined && { salesTaxRate: parseFloat(salesTaxRate) }),
        ...(boothRentalRate !== undefined && { boothRentalRate: parseFloat(boothRentalRate) }),
        ...(suiteRentalRate !== undefined && { suiteRentalRate: parseFloat(suiteRentalRate) }),
        ...(w2PayrollEnabled !== undefined && { w2PayrollEnabled }),
        ...(fiscalYearStart !== undefined && { fiscalYearStart: parseInt(fiscalYearStart, 10) }),
        ...(notes !== undefined && { notes }),
      },
      create: {
        locationId,
        modelType,
        commissionRate: commissionRate ? parseFloat(commissionRate) : 0.40,
        salesTaxRate: salesTaxRate ? parseFloat(salesTaxRate) : 0.0825,
        boothRentalRate: boothRentalRate ? parseFloat(boothRentalRate) : null,
        suiteRentalRate: suiteRentalRate ? parseFloat(suiteRentalRate) : null,
        w2PayrollEnabled: w2PayrollEnabled || false,
        fiscalYearStart: fiscalYearStart ? parseInt(fiscalYearStart, 10) : 1,
        notes: notes || null,
      },
    })

    return NextResponse.json({ model })
  } catch (error) {
    console.error("Business model POST error:", error)
    return NextResponse.json({ error: "Failed to upsert business model" }, { status: 500 })
  }
}
