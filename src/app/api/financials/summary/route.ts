import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateEstimatedTaxes } from "@/lib/financial-constants"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as Record<string, unknown>
    if (user.role !== "OWNER" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const locationId = searchParams.get("locationId")

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
    }

    const start = new Date(`${startDate}T00:00:00Z`)
    const end = new Date(`${endDate}T23:59:59Z`)

    const expenseWhere: Record<string, unknown> = {
      date: { gte: start, lte: end },
    }
    if (locationId) expenseWhere.locationId = locationId

    const expenses = await prisma.expense.findMany({ where: expenseWhere })
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

    const paymentWhere: Record<string, unknown> = {
      dueDate: { gte: start, lte: end },
      status: "paid",
    }
    if (locationId) {
      paymentWhere.boothRental = { locationId }
    }

    const boothPayments = await prisma.boothRentalPayment.findMany({
      where: paymentWhere,
      include: { boothRental: true },
    })
    const boothRevenue = boothPayments.reduce((sum, p) => sum + p.amount, 0)

    // Revenue placeholder — booth rental income + estimate from expenses ratio
    const revenue = boothRevenue > 0 ? boothRevenue : totalExpenses * 1.4
    const netIncome = revenue - totalExpenses

    const taxEstimates = calculateEstimatedTaxes(Math.max(netIncome, 0))

    return NextResponse.json({
      period: { startDate, endDate },
      revenue: Math.round(revenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      boothRevenue: Math.round(boothRevenue * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      expenseCount: expenses.length,
      taxEstimates,
      expensesByCategory: expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {} as Record<string, number>),
    })
  } catch (error) {
    console.error("Financial summary error:", error)
    return NextResponse.json({ error: "Failed to fetch financial summary" }, { status: 500 })
  }
}
