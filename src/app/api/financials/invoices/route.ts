import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TEXAS_SALES_TAX_RATE } from "@/lib/financial-constants"

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
    const status = searchParams.get("status")
    const locationId = searchParams.get("locationId")

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (locationId) where.locationId = locationId

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({
      invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Invoices GET error:", error)
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
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
    const { locationId, clientName, clientEmail, clientPhone, lineItems, dueDate, notes } = body

    if (!locationId || !clientName || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "Missing required fields: locationId, clientName, lineItems" }, { status: 400 })
    }

    // Auto-generate invoice number: SE-{LOC}-{YEAR}-{SEQ}
    const locCode = locationId.includes("LTJSA") ? "CC" : "SA"
    const year = new Date().getFullYear()
    const prefix = `SE-${locCode}-${year}-`

    const lastInvoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
    })

    let seq = 1
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0", 10)
      seq = lastSeq + 1
    }
    const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`

    // Calculate totals
    const subtotal = lineItems.reduce((sum: number, item: { amount: number; quantity?: number }) => {
      return sum + (item.amount * (item.quantity || 1))
    }, 0)
    const taxAmount = Math.round(subtotal * TEXAS_SALES_TAX_RATE * 100) / 100
    const total = Math.round((subtotal + taxAmount) * 100) / 100

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        locationId,
        clientName,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        lineItems,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount,
        total,
        status: "draft",
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        createdBy: user.id as string,
      },
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error("Invoices POST error:", error)
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
  }
}
