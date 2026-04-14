import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — list all connected financial accounts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const accounts = await prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { transactions: { take: 5, orderBy: { date: "desc" } } },
    })
    return NextResponse.json({ accounts })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed", accounts: [] }, { status: 500 })
  }
}

// POST — save connected bank accounts from Stripe Financial Connections
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { accounts, locationId } = await req.json()
    const saved = []

    for (const acct of accounts || []) {
      const record = await prisma.financialAccount.create({
        data: {
          locationId: locationId || "default",
          accountName: acct.display_name || acct.institution_name || "Bank Account",
          accountType: acct.subcategory || acct.category || "checking",
          bankName: acct.institution_name || null,
          lastFour: acct.last4 || null,
          stripeFinancialId: acct.id || null,
          balance: acct.balance?.current ? acct.balance.current / 100 : null,
          balanceUpdatedAt: new Date(),
        },
      })
      saved.push(record)
    }

    return NextResponse.json({ saved, count: saved.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save accounts" }, { status: 500 })
  }
}
