import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 30

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Find all recurring monthly expenses
  const templates = await prisma.expense.findMany({
    where: { isRecurring: true, recurringFrequency: "monthly" },
    distinct: ["vendor", "locationId", "category"],
    orderBy: { createdAt: "desc" },
  })

  let created = 0
  for (const t of templates) {
    // Check if expense already exists for this month
    const existing = await prisma.expense.findFirst({
      where: {
        vendor: t.vendor,
        locationId: t.locationId,
        category: t.category,
        date: { gte: monthStart },
        notes: { contains: "Auto-created" },
      },
    })
    if (existing) continue

    await prisma.expense.create({
      data: {
        locationId: t.locationId,
        date: monthStart,
        vendor: t.vendor,
        description: t.description,
        amount: t.amount,
        category: t.category,
        subcategory: t.subcategory,
        paymentMethod: t.paymentMethod,
        isRecurring: false,
        taxDeductible: t.taxDeductible,
        notes: "Auto-created from recurring expense",
        createdBy: "system",
      },
    })
    created++
  }

  console.log(`[recurring-expenses] Created ${created} expenses for ${monthStart.toISOString().slice(0, 7)}`)
  return NextResponse.json({ created, month: monthStart.toISOString().slice(0, 7) })
}
