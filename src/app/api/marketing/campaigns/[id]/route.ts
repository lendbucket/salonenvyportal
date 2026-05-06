import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { dispatchSMSCampaign } from "@/lib/sms/dispatcher"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params
  const campaign = await prisma.marketingMessage.findUnique({
    where: { id },
    include: {
      recipients: { orderBy: { createdAt: "desc" }, take: 200, select: { id: true, destination: true, status: true, sentAt: true, deliveredAt: true, cost: true, segmentCount: true, client: { select: { firstName: true, lastName: true } } } },
      _count: { select: { recipients: true } },
    },
  })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const statusCounts = await prisma.messageRecipient.groupBy({ by: ["status"], where: { messageId: id }, _count: true })
  return NextResponse.json({ campaign, statusCounts })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params
  const body = await req.json()

  // Handle send action
  if (body.action === "send") {
    const campaign = await prisma.marketingMessage.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      return NextResponse.json({ error: "Campaign cannot be sent from current status" }, { status: 400 })
    }
    await dispatchSMSCampaign(id)
    const updated = await prisma.marketingMessage.findUnique({ where: { id } })
    return NextResponse.json({ campaign: updated })
  }

  // Handle cancel action
  if (body.action === "cancel") {
    await prisma.marketingMessage.update({ where: { id }, data: { status: "CANCELLED" } })
    return NextResponse.json({ success: true })
  }

  // Regular update (draft editing)
  const campaign = await prisma.marketingMessage.update({
    where: { id },
    data: {
      body: body.body,
      subject: body.subject,
      category: body.category,
      channel: body.channel,
      mmsImageUrl: body.mmsImageUrl,
      audienceFilter: body.audienceFilter,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
    },
  })
  return NextResponse.json({ campaign })
}
