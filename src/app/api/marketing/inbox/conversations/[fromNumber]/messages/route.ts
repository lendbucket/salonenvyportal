import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fromNumber: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const { fromNumber } = await params
  const decoded = decodeURIComponent(fromNumber)

  // Inbound messages from this number
  const inbound = await prisma.inboundMessage.findMany({
    where: { fromNumber: decoded },
    orderBy: { receivedAt: "asc" },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, vipTier: true, valueTier: true, lifetimeSpend: true, lastVisitAt: true, totalVisits: true } },
    },
  })

  // Outbound messages to this number (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const last10 = decoded.replace(/\D/g, "").slice(-10)
  const outbound = await prisma.messageRecipient.findMany({
    where: {
      destination: { endsWith: last10 },
      sentAt: { gte: thirtyDaysAgo },
    },
    orderBy: { sentAt: "asc" },
    select: { id: true, personalizedBody: true, sentAt: true, status: true, destination: true },
  })

  // Merge into timeline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeline: any[] = [
    ...inbound.map(m => ({ type: "inbound", id: m.id, body: m.body, timestamp: m.receivedAt, status: m.status, intent: m.intent, replyDraft: m.replyDraft, client: m.client })),
    ...outbound.map(m => ({ type: "outbound", id: m.id, body: m.personalizedBody, timestamp: m.sentAt, status: m.status })),
  ]
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const client = inbound[0]?.client || null
  return NextResponse.json({ timeline, client, fromNumber: decoded })
}
