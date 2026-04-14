import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const maxDuration = 30

// POST — create a Financial Connections session
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json().catch(() => ({}))
    console.log("[stripe-fc] Creating session for:", body.locationId)

    const fcSession = await stripe.financialConnections.sessions.create({
      account_holder: { type: "customer", customer: body.stripeCustomerId || undefined },
      permissions: ["balances", "transactions"],
      filters: { countries: ["US"] },
    })

    console.log("[stripe-fc] Session created:", fcSession.id)
    return NextResponse.json({ clientSecret: fcSession.client_secret, sessionId: fcSession.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[stripe-fc] Error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT — sync transactions from connected account
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 })

  try {
    const { financialAccountId, stripeAccountId } = await req.json()
    const { prisma } = await import("@/lib/prisma")

    const transactions = await stripe.financialConnections.transactions.list({ account: stripeAccountId, limit: 100 })

    let synced = 0
    for (const txn of transactions.data) {
      await prisma.bankTransaction.upsert({
        where: { stripeTransactionId: txn.id },
        create: {
          financialAccountId,
          stripeTransactionId: txn.id,
          date: new Date((txn as unknown as { transacted_at: number }).transacted_at * 1000),
          description: txn.description || "",
          amount: txn.amount / 100,
          category: (txn as unknown as { category?: string }).category || "other",
          isReconciled: false,
        },
        update: {
          description: txn.description || "",
          amount: txn.amount / 100,
          category: (txn as unknown as { category?: string }).category || "other",
        },
      })
      synced++
    }

    return NextResponse.json({ success: true, synced })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[stripe-fc] Sync error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
