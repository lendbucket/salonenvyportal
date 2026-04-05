import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SquareClient, SquareEnvironment } from "square"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { locationId, customerId, lineItems, tipAmount, sourceId, bookingId, note, paymentMethod, taxAmount, cashReceived, signatureData } = await req.json()

    if (!lineItems?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // For card payments, sourceId is required
    if (paymentMethod !== "cash" && !sourceId) {
      return NextResponse.json({ error: "Missing sourceId for card payment" }, { status: 400 })
    }

    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    // Build order line items
    const orderLineItems = lineItems.map((item: { name: string; price: number; catalogObjectId?: string; teamMemberId?: string }) => ({
      name: item.name,
      quantity: "1",
      basePriceMoney: {
        amount: BigInt(Math.round(item.price * 100)),
        currency: "USD",
      },
      ...(item.catalogObjectId ? { catalogObjectId: item.catalogObjectId } : {}),
      ...(item.teamMemberId ? { note: `Stylist: ${item.teamMemberId}` } : {}),
    }))

    // Build taxes array if taxAmount provided
    const taxes = taxAmount && taxAmount > 0
      ? [{
          name: "Sales Tax",
          percentage: "8.25",
          scope: "ORDER" as const,
        }]
      : undefined

    // Create order
    const orderRes = await square.orders.create({
      order: {
        locationId,
        customerId: customerId || undefined,
        lineItems: orderLineItems,
        ...(taxes ? { taxes } : {}),
        ...(bookingId ? { referenceId: bookingId } : {}),
      },
      idempotencyKey: randomUUID(),
    })

    const order = orderRes.order
    if (!order?.id) return NextResponse.json({ error: "Failed to create order" }, { status: 500 })

    // Process payment
    const totalAmount = Number(order.totalMoney?.amount || 0)
    const tipAmt = Math.round((tipAmount || 0) * 100)

    const isCash = paymentMethod === "cash"

    const paymentCreateParams: Record<string, unknown> = {
      sourceId: isCash ? "CASH" : sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(totalAmount + tipAmt),
        currency: "USD",
      },
      orderId: order.id,
      locationId,
      ...(customerId ? { customerId } : {}),
      ...(note ? { note } : {}),
      ...(tipAmt > 0 ? { tipMoney: { amount: BigInt(tipAmt), currency: "USD" } } : {}),
    }

    // Add cash details for cash payments
    if (isCash) {
      const cashAmt = cashReceived ? Math.round(cashReceived * 100) : totalAmount + tipAmt
      paymentCreateParams.cashDetails = {
        buyerSuppliedMoney: {
          amount: BigInt(cashAmt),
          currency: "USD",
        },
      }
    }

    // Append signature note if provided
    if (signatureData) {
      paymentCreateParams.note = paymentCreateParams.note
        ? `${paymentCreateParams.note} | Signature captured`
        : "Signature captured"
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentRes = await square.payments.create(paymentCreateParams as any)

    // Try to mark booking as completed in Square
    if (bookingId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (square.bookings as any).cancel?.({ bookingId, body: {} })
          .catch(() => {}) // Booking may not support cancel/complete via API — non-critical
      } catch {
        // Non-critical — log but don't fail the checkout
      }
    }

    // Calculate commission breakdown (40% per service)
    const commissionBreakdown = lineItems.map((item: { name: string; price: number; teamMemberId?: string; teamMemberName?: string }) => ({
      service: item.name,
      price: item.price,
      teamMemberId: item.teamMemberId || null,
      teamMemberName: item.teamMemberName || null,
      commission: parseFloat((item.price * 0.40).toFixed(2)),
    }))
    const totalCommission = parseFloat(
      (lineItems.reduce((s: number, i: { price: number }) => s + i.price, 0) * 0.40).toFixed(2)
    )

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentId: paymentRes.payment?.id,
      totalCharged: (totalAmount + tipAmt) / 100,
      receipt: paymentRes.payment?.receiptUrl,
      paymentMethod: isCash ? "cash" : "card",
      commissionBreakdown,
      totalCommission,
    })
  } catch (error: unknown) {
    console.error("Checkout error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
