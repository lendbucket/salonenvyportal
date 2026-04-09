import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  const locationId = (session.user as any).locationId as string | undefined

  const where = role === "MANAGER" && locationId ? { locationId } : {}

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: { items: true, location: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ orders })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { locationId, supplier, notes, items } = body
  if (!locationId || !supplier || !items?.length) {
    return NextResponse.json({ error: "locationId, supplier, and items are required" }, { status: 400 })
  }

  const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`
  const userId = (session.user as any).id as string

  let totalAmount = 0
  const itemData = (items as any[]).map((it: any) => {
    const cost = (it.quantityOrdered || 0) * (it.costPerUnit || 0)
    totalAmount += cost
    return {
      inventoryItemId: it.inventoryItemId || null,
      brand: it.brand || "",
      productName: it.productName || "",
      shadeOrVolume: it.shadeOrVolume || null,
      unitType: it.unitType || null,
      quantityOrdered: it.quantityOrdered || 0,
      costPerUnit: it.costPerUnit || 0,
      totalCost: cost,
    }
  })

  const order = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      locationId,
      supplier,
      notes: notes || null,
      createdById: userId,
      totalAmount,
      items: { create: itemData },
    },
    include: { items: true, location: true },
  })

  logAction({ action: AUDIT_ACTIONS.PO_CREATED, entity: "PurchaseOrder", entityId: order.id, userId: (session!.user as Record<string, unknown>).id as string, userEmail: (session!.user as Record<string, unknown>).email as string, userRole: (session!.user as Record<string, unknown>).role as string, locationId: order.locationId })
  return NextResponse.json({ order }, { status: 201 })
}
