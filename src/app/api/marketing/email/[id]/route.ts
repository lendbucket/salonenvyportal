import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
  })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const recipients = await prisma.emailRecipient.findMany({
    where: { campaignId: id },
    orderBy: { sentAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      status: true,
      sentAt: true,
      deliveredAt: true,
      openedAt: true,
      clickedAt: true,
      bouncedAt: true,
      complainedAt: true,
      unsubscribedAt: true,
      failedReason: true,
    },
  })

  const events = await prisma.emailEvent.findMany({
    where: { campaignId: id },
    orderBy: { occurredAt: "desc" },
    take: 500,
    select: {
      id: true,
      type: true,
      metadata: true,
      occurredAt: true,
    },
  })

  return NextResponse.json({ campaign, recipients, events })
}
