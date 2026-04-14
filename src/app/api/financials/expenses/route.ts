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
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "25", 10)
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const locationId = searchParams.get("locationId")

    const where: Record<string, unknown> = {}
    if (locationId) where.locationId = locationId
    if (category) where.category = category
    if (startDate && endDate) {
      where.date = {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${endDate}T23:59:59Z`),
      }
    }
    if (search) {
      where.OR = [
        { vendor: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ])

    return NextResponse.json({
      expenses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Expenses GET error:", error)
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 })
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
    const { locationId, date, vendor, description, amount, category, subcategory, paymentMethod, isRecurring, recurringFrequency, taxDeductible, notes } = body

    if (!locationId || !date || !vendor || !description || !amount || !category) {
      return NextResponse.json({ error: "Missing required fields: locationId, date, vendor, description, amount, category" }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        locationId,
        date: new Date(date),
        vendor,
        description,
        amount: parseFloat(amount),
        category,
        subcategory: subcategory || null,
        paymentMethod: paymentMethod || null,
        isRecurring: isRecurring || false,
        recurringFrequency: recurringFrequency || null,
        taxDeductible: taxDeductible !== undefined ? taxDeductible : true,
        notes: notes || null,
        createdBy: user.id as string,
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error("Expenses POST error:", error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}
