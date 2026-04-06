import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const QUARTER_DUE_DATES: Record<number, { month: number; day: number }> = {
  1: { month: 3, day: 15 },  // April 15
  2: { month: 5, day: 15 },  // June 15
  3: { month: 8, day: 15 },  // September 15
  4: { month: 0, day: 15 },  // January 15 of NEXT year
}

function getDueDate(year: number, quarter: number): Date {
  const cfg = QUARTER_DUE_DATES[quarter]
  const y = quarter === 4 ? year + 1 : year
  return new Date(y, cfg.month, cfg.day)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const taxYear = new Date().getFullYear()

  // Fetch existing or create all 4 quarters
  const existing = await prisma.quarterlyPayment.findMany({
    where: { userId, taxYear },
    orderBy: { quarter: "asc" },
  })

  if (existing.length === 4) {
    return NextResponse.json({ payments: existing })
  }

  // Calculate estimated amount from receipts + mileage
  const receipts = await prisma.taxReceipt.findMany({
    where: { userId, taxYear, isDeductible: true },
  })
  const mileage = await prisma.mileageLog.findMany({
    where: { userId, taxYear },
  })
  const totalDeductions =
    receipts.reduce((s, r) => s + (r.amount || 0), 0) +
    mileage.reduce((s, m) => s + m.amount, 0)
  const estimatedIncome = 75000
  const taxableIncome = Math.max(0, estimatedIncome - totalDeductions)
  const seTax = taxableIncome * 0.9235 * 0.153
  const fedTax = taxableIncome * 0.12
  const quarterlyAmount = (seTax + fedTax) / 4

  const payments = []
  for (let q = 1; q <= 4; q++) {
    const found = existing.find((p) => p.quarter === q)
    if (found) {
      payments.push(found)
    } else {
      const created = await prisma.quarterlyPayment.create({
        data: {
          userId,
          taxYear,
          quarter: q,
          dueDate: getDueDate(taxYear, q),
          estimatedAmount: Math.round(quarterlyAmount),
          status: getDueDate(taxYear, q) < new Date() ? "overdue" : "upcoming",
        },
      })
      payments.push(created)
    }
  }

  return NextResponse.json({ payments })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const body = await request.json()
  const { quarter, actualAmount, confirmationNum } = body as {
    quarter: number
    actualAmount: number
    confirmationNum?: string
  }

  if (!quarter || !actualAmount) {
    return NextResponse.json({ error: "quarter and actualAmount required" }, { status: 400 })
  }

  const taxYear = new Date().getFullYear()

  const payment = await prisma.quarterlyPayment.update({
    where: { userId_taxYear_quarter: { userId, taxYear, quarter } },
    data: {
      actualAmount,
      confirmationNum: confirmationNum || null,
      paidAt: new Date(),
      status: "paid",
    },
  })

  return NextResponse.json({ payment })
}
