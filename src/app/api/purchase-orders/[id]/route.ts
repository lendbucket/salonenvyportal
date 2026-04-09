import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { action } = body

  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } })
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (action === "submit") {
    if (po.status !== "draft") return NextResponse.json({ error: "Can only submit draft POs" }, { status: 400 })
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "pending" },
      include: { items: true, location: true },
    })
    return NextResponse.json({ order: updated })
  }

  if (action === "approve") {
    if (role !== "OWNER") return NextResponse.json({ error: "Only owners can approve" }, { status: 403 })
    if (po.status !== "pending") return NextResponse.json({ error: "Can only approve pending POs" }, { status: 400 })
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "approved", approvedById: userId, approvedAt: new Date() },
      include: { items: true, location: true },
    })
    logAction({ action: AUDIT_ACTIONS.PO_APPROVED, entity: "PurchaseOrder", entityId: id, userId, userRole: role, locationId: po.locationId })
    return NextResponse.json({ order: updated })
  }

  if (action === "ordered") {
    if (po.status !== "approved") return NextResponse.json({ error: "Can only mark approved POs as ordered" }, { status: 400 })
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "ordered", orderedAt: new Date() },
      include: { items: true, location: true },
    })
    return NextResponse.json({ order: updated })
  }

  if (action === "received") {
    if (po.status !== "ordered") return NextResponse.json({ error: "Can only receive ordered POs" }, { status: 400 })

    // Increment inventory quantities for items that have inventoryItemId
    for (const item of po.items) {
      if (item.inventoryItemId) {
        await prisma.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            quantityOnHand: { increment: item.quantityOrdered },
            lastRestocked: new Date(),
          },
        })
        // Update low stock flag
        const inv = await prisma.inventoryItem.findUnique({ where: { id: item.inventoryItemId } })
        if (inv) {
          await prisma.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { isLowStock: inv.quantityOnHand <= inv.reorderThreshold },
          })
        }
      }
      // Mark item as fully received
      await prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { quantityReceived: item.quantityOrdered },
      })
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "received", receivedAt: new Date() },
      include: { items: true, location: true },
    })
    return NextResponse.json({ order: updated })
  }

  if (action === "cancel") {
    if (po.status === "received") return NextResponse.json({ error: "Cannot cancel received POs" }, { status: 400 })
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "cancelled" },
      include: { items: true, location: true },
    })
    return NextResponse.json({ order: updated })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
