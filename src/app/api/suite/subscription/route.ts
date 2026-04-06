import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string

  // Owners always have access
  if (role === "OWNER") {
    // Also return subscriber stats for owners
    const totalSubscribers = await prisma.suiteSubscription.count({ where: { status: "active" } })
    const monthlyRevenue = await prisma.suiteSubscription.aggregate({
      where: { status: "active" },
      _sum: { price: true },
    })
    return NextResponse.json({
      hasAccess: true,
      isOwner: true,
      subscription: null,
      stats: {
        totalSubscribers,
        monthlyRevenue: monthlyRevenue._sum.price || 0,
      },
    })
  }

  const subscription = await prisma.suiteSubscription.findUnique({ where: { userId } })
  return NextResponse.json({
    hasAccess: subscription?.status === "active",
    isOwner: false,
    subscription,
    stats: null,
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const body = await request.json()
  const { plan } = body as { plan: "monthly" | "annual" }

  const price = plan === "annual" ? 399 : 40

  const subscription = await prisma.suiteSubscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      price,
      status: "active",
    },
    update: {
      plan,
      price,
      status: "active",
    },
  })

  return NextResponse.json({ subscription })
}
