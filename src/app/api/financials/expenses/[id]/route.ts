import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as Record<string, unknown>
    if (user.role !== "OWNER" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const expense = await prisma.expense.findUnique({ where: { id } })
    if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

    return NextResponse.json({ expense })
  } catch (error) {
    console.error("Expense GET error:", error)
    return NextResponse.json({ error: "Failed to fetch expense" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as Record<string, unknown>
    if (user.role !== "OWNER" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(body.date && { date: new Date(body.date) }),
        ...(body.vendor && { vendor: body.vendor }),
        ...(body.description && { description: body.description }),
        ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
        ...(body.category && { category: body.category }),
        ...(body.subcategory !== undefined && { subcategory: body.subcategory }),
        ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
        ...(body.isRecurring !== undefined && { isRecurring: body.isRecurring }),
        ...(body.recurringFrequency !== undefined && { recurringFrequency: body.recurringFrequency }),
        ...(body.taxDeductible !== undefined && { taxDeductible: body.taxDeductible }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    })

    return NextResponse.json({ expense })
  } catch (error) {
    console.error("Expense PUT error:", error)
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = session.user as Record<string, unknown>
    if (user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden — OWNER only" }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

    await prisma.expense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Expense DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 })
  }
}
