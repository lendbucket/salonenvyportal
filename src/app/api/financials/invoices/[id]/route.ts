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
    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error("Invoice GET error:", error)
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 })
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

    const existing = await prisma.invoice.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(body.clientName && { clientName: body.clientName }),
        ...(body.clientEmail !== undefined && { clientEmail: body.clientEmail }),
        ...(body.clientPhone !== undefined && { clientPhone: body.clientPhone }),
        ...(body.lineItems && { lineItems: body.lineItems }),
        ...(body.subtotal !== undefined && { subtotal: parseFloat(body.subtotal) }),
        ...(body.taxAmount !== undefined && { taxAmount: parseFloat(body.taxAmount) }),
        ...(body.total !== undefined && { total: parseFloat(body.total) }),
        ...(body.status && { status: body.status }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.paidAt !== undefined && { paidAt: body.paidAt ? new Date(body.paidAt) : null }),
        ...(body.sentAt !== undefined && { sentAt: body.sentAt ? new Date(body.sentAt) : null }),
        ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    })

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error("Invoice PUT error:", error)
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 })
  }
}
