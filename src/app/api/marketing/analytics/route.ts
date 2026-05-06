import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")
  const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const dateTo = to ? new Date(to) : new Date()

  const campaigns = await prisma.marketingMessage.findMany({
    where: { status: { in: ["SENT", "SENDING"] }, createdAt: { gte: dateFrom, lte: dateTo } },
    include: { _count: { select: { recipients: true } } },
  })

  const recipientStats = await prisma.messageRecipient.groupBy({
    by: ["status"],
    where: { message: { createdAt: { gte: dateFrom, lte: dateTo } } },
    _count: true,
  })

  const totalSent = recipientStats.reduce((s, r) => s + r._count, 0)
  const delivered = recipientStats.find(r => r.status === "DELIVERED")?._count || 0
  const failed = recipientStats.find(r => r.status === "FAILED")?._count || 0

  const totalSpent = campaigns.reduce((s, c) => s + c.actualCost, 0)
  const totalClicks = await prisma.linkClick.count({ where: { clickedAt: { gte: dateFrom, lte: dateTo } } })
  const totalOptOuts = await prisma.optInRecord.count({ where: { action: "OPT_OUT", createdAt: { gte: dateFrom, lte: dateTo } } })
  const totalOptIns = await prisma.optInRecord.count({ where: { action: { in: ["OPT_IN", "RE_OPT_IN"] }, createdAt: { gte: dateFrom, lte: dateTo } } })

  const deliveryRate = totalSent > 0 ? Math.round((delivered / totalSent) * 1000) / 10 : 0
  const clickRate = delivered > 0 ? Math.round((totalClicks / delivered) * 1000) / 10 : 0
  const costPerClick = totalClicks > 0 ? Math.round((totalSpent / totalClicks) * 100) / 100 : 0

  // Audience health — opted in over time (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const optInHistory = await prisma.optInRecord.findMany({
    where: { createdAt: { gte: ninetyDaysAgo } },
    select: { action: true, method: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const currentOptedIn = await prisma.client.count({ where: { smsMarketingConsent: true, smsOptedOutAt: null } })

  return NextResponse.json({
    kpis: {
      totalCampaigns: campaigns.length,
      totalSent,
      totalSpent: Math.round(totalSpent * 100) / 100,
      deliveryRate,
      clickRate,
      totalOptOuts,
      netGrowth: totalOptIns - totalOptOuts,
      costPerClick,
    },
    campaigns: campaigns.map(c => ({
      id: c.id, category: c.category, channel: c.channel, body: c.body?.slice(0, 60),
      recipientCount: c.recipientCount, actualCost: c.actualCost, createdAt: c.createdAt,
    })),
    audienceHealth: { currentOptedIn, optInHistory },
  })
}
