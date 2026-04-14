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
    const locationId = searchParams.get("locationId")
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10)
    const quarter = searchParams.get("quarter") ? parseInt(searchParams.get("quarter")!, 10) : null

    // Determine date range
    let startDate: Date
    let endDate: Date

    if (quarter) {
      const quarterStarts = [
        new Date(`${year}-01-01T00:00:00Z`),
        new Date(`${year}-04-01T00:00:00Z`),
        new Date(`${year}-07-01T00:00:00Z`),
        new Date(`${year}-10-01T00:00:00Z`),
      ]
      const quarterEnds = [
        new Date(`${year}-03-31T23:59:59Z`),
        new Date(`${year}-06-30T23:59:59Z`),
        new Date(`${year}-09-30T23:59:59Z`),
        new Date(`${year}-12-31T23:59:59Z`),
      ]
      startDate = quarterStarts[quarter - 1]
      endDate = quarterEnds[quarter - 1]
    } else {
      startDate = new Date(`${year}-01-01T00:00:00Z`)
      endDate = new Date(`${year}-12-31T23:59:59Z`)
    }

    const expenseWhere: Record<string, unknown> = {
      date: { gte: startDate, lte: endDate },
    }
    if (locationId) expenseWhere.locationId = locationId

    const expenses = await prisma.expense.findMany({ where: expenseWhere })
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const deductibleExpenses = expenses.filter(e => e.taxDeductible).reduce((sum, e) => sum + e.amount, 0)

    // Booth rental revenue
    const paymentWhere: Record<string, unknown> = {
      dueDate: { gte: startDate, lte: endDate },
      status: "paid",
    }
    if (locationId) paymentWhere.boothRental = { locationId }

    const boothPayments = await prisma.boothRentalPayment.findMany({
      where: paymentWhere,
      include: { boothRental: true },
    })
    const boothRevenue = boothPayments.reduce((sum, p) => sum + p.amount, 0)

    const revenue = boothRevenue > 0 ? boothRevenue : totalExpenses * 1.4
    const netIncome = revenue - totalExpenses
    const taxEstimates = calculateEstimatedTaxes(Math.max(netIncome, 0))

    // IRS quarterly due dates
    const irsDueDates = [
      { quarter: 1, label: "Q1 (Jan-Mar)", dueDate: `${year}-04-15` },
      { quarter: 2, label: "Q2 (Apr-May)", dueDate: `${year}-06-15` },
      { quarter: 3, label: "Q3 (Jun-Aug)", dueDate: `${year}-09-15` },
      { quarter: 4, label: "Q4 (Sep-Dec)", dueDate: `${year + 1}-01-15` },
    ]

    return NextResponse.json({
      year,
      quarter,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      revenue: Math.round(revenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      deductibleExpenses: Math.round(deductibleExpenses * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      taxEstimates,
      irsDueDates,
      expensesByCategory: expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {} as Record<string, number>),
    })
  } catch (error) {
    console.error("Tax summary error:", error)
    return NextResponse.json({ error: "Failed to fetch tax summary" }, { status: 500 })
  }
}
