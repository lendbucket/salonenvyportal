import { NextResponse } from "next/server"
import { SquareClient, SquareEnvironment } from "square"

export async function GET() {
  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    // Test: list locations
    const locResponse = await square.locations.list()
    const locations = locResponse.locations?.map(l => ({
      id: l.id,
      name: l.name,
      status: l.status,
    }))

    // Test: get payments from last 7 days
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const paymentsPage = await square.payments.list({
      beginTime: weekAgo.toISOString(),
      endTime: now.toISOString(),
      limit: 10,
    })

    const payments = paymentsPage.data?.map(p => ({
      id: p.id,
      amount: Number(p.amountMoney?.amount || 0) / 100,
      teamMemberId: (p as Record<string, unknown>).teamMemberId,
      status: p.status,
      createdAt: p.createdAt,
    }))

    return NextResponse.json({
      success: true,
      locations,
      recentPayments: payments || [],
      paymentCount: payments?.length || 0,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      success: false,
      error: msg,
      details: String(error),
    })
  }
}
