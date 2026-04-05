import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SquareClient, SquareEnvironment } from "square"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { locationId, customerId, lineItems, tipAmount, sourceId, bookingId, note } = await req.json()

    if (!sourceId || !lineItems?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    // Create order
    const orderRes = await square.orders.create({
      order: {
        locationId,
        customerId: customerId || undefined,
        lineItems: lineItems.map((item: { name: string; price: number; catalogObjectId?: string }) => ({
          name: item.name,
          quantity: "1",
          basePriceMoney: {
            amount: BigInt(Math.round(item.price * 100)),
            currency: "USD",
          },
          ...(item.catalogObjectId ? { catalogObjectId: item.catalogObjectId } : {}),
        })),
        ...(bookingId ? { referenceId: bookingId } : {}),
      },
      idempotencyKey: randomUUID(),
    })

    const order = orderRes.order
    if (!order?.id) return NextResponse.json({ error: "Failed to create order" }, { status: 500 })

    // Process payment
    const totalAmount = Number(order.totalMoney?.amount || 0)
    const tipAmt = Math.round((tipAmount || 0) * 100)

    const paymentRes = await square.payments.create({
      sourceId,
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
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentId: paymentRes.payment?.id,
      totalCharged: (totalAmount + tipAmt) / 100,
      receipt: paymentRes.payment?.receiptUrl,
    })
  } catch (error: unknown) {
    console.error("Checkout error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
