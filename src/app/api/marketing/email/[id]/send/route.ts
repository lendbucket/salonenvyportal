import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { dispatchEmailCampaign } from "@/lib/email/dispatcher"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return NextResponse.json({ error: "Campaign cannot be sent from current status" }, { status: 400 })
  }

  try {
    await dispatchEmailCampaign(id)
    const updated = await prisma.emailCampaign.findUnique({ where: { id } })
    return NextResponse.json({ campaign: updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed" }, { status: 500 })
  }
}
