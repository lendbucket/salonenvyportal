import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"
import { LOCATION_IDS } from "@/lib/square-metrics"
import { calculateEstimatedTaxes } from "@/lib/financial-constants"

export const maxDuration = 30

function getSquare() {
  return new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as Record<string, unknown>
    if (user.role !== "OWNER" && user.role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const locationId = searchParams.get("locationId")

    if (!startDate || !endDate) return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 })

    const startAt = new Date(`${startDate}T00:00:00`).toISOString()
    const endAt = new Date(`${endDate}T23:59:59`).toISOString()

    // Fetch Square revenue data
    const square = getSquare()
    let grossSales = 0, salesTax = 0, tips = 0, discounts = 0, cardCount = 0, cashCount = 0, cardTotal = 0, cashTotal = 0

    try {
      const ordersRes = await square.orders.search({
        locationIds: [...LOCATION_IDS],
        query: {
          filter: {
            dateTimeFilter: { closedAt: { startAt, endAt } },
            stateFilter: { states: ["COMPLETED"] },
          },
          sort: { sortField: "CLOSED_AT", sortOrder: "DESC" },
        },
        limit: 500,
      })

      for (const o of (ordersRes.orders || [])) {
        const total = Number(o.totalMoney?.amount || 0) / 100
        const tax = Number(o.totalTaxMoney?.amount || 0) / 100
        const tip = Number(o.totalTipMoney?.amount || 0) / 100
        const disc = Number(o.totalDiscountMoney?.amount || 0) / 100
        grossSales += total
        salesTax += tax
        tips += tip
        discounts += disc

        // Payment method from tenders
        const tender = o.tenders?.[0]
        if (tender?.type === "CASH") { cashCount++; cashTotal += total }
        else { cardCount++; cardTotal += total }
      }
    } catch (sqErr) {
      console.error("[financials] Square error:", sqErr instanceof Error ? sqErr.message : sqErr)
    }

    const netSales = grossSales - salesTax - tips
    const squareFees = Math.round((cardTotal * 0.026 + cardCount * 0.10) * 100) / 100

    // Expenses from DB
    const expenseWhere: Record<string, unknown> = { date: { gte: new Date(startAt), lte: new Date(endAt) } }
    if (locationId) expenseWhere.locationId = locationId
    const expenses = await prisma.expense.findMany({ where: expenseWhere })
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + squareFees

    // Booth rental income
    const boothPayments = await prisma.boothRentalPayment.findMany({
      where: { dueDate: { gte: new Date(startAt), lte: new Date(endAt) }, status: "paid" },
      include: { boothRental: true },
    })
    const boothRevenue = boothPayments.reduce((sum, p) => sum + p.amount, 0)

    const totalRevenue = netSales + boothRevenue
    const netIncome = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 1000) / 10 : 0
    const taxEstimates = calculateEstimatedTaxes(Math.max(netIncome, 0))
    const avgTicket = (cardCount + cashCount) > 0 ? Math.round(netSales / (cardCount + cashCount) * 100) / 100 : 0

    return NextResponse.json({
      period: { startDate, endDate },
      revenue: {
        gross: Math.round(grossSales * 100) / 100,
        net: Math.round(netSales * 100) / 100,
        salesTax: Math.round(salesTax * 100) / 100,
        tips: Math.round(tips * 100) / 100,
        discounts: Math.round(discounts * 100) / 100,
        squareFees,
        byPaymentMethod: { card: Math.round(cardTotal * 100) / 100, cash: Math.round(cashTotal * 100) / 100 },
        boothRevenue: Math.round(boothRevenue * 100) / 100,
        avgTicket,
        checkoutCount: cardCount + cashCount,
      },
      expenses: {
        total: Math.round(totalExpenses * 100) / 100,
        count: expenses.length,
        byCategory: expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc }, {} as Record<string, number>),
      },
      calculated: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        grossProfit: Math.round((netSales - (totalExpenses * 0.3)) * 100) / 100,
        netIncome: Math.round(netIncome * 100) / 100,
        profitMargin,
        taxEstimates,
      },
    })
  } catch (error) {
    console.error("[financials] Summary error:", error)
    return NextResponse.json({ error: "Failed to fetch financial summary" }, { status: 500 })
  }
}
