import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { renderEmail } from "@/lib/email/render"
import { sendTransactionalEmail } from "@/lib/email/resend-client"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const userEmail = (session.user as Record<string, unknown>).email as string
  if (!userEmail) return NextResponse.json({ error: "No email on your account" }, { status: 400 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  const templateData = (campaign.templateData || {}) as Record<string, unknown>
  const { html, text } = await renderEmail(campaign.templateKey, {
    firstName: "Test User",
    bodyText: templateData.bodyText as string | undefined,
    imageUrl: templateData.imageUrl as string | undefined,
    ctaText: templateData.ctaText as string | undefined,
    ctaUrl: templateData.ctaUrl as string | undefined,
    offerCode: templateData.offerCode as string | undefined,
    expiresAt: templateData.expiresAt as string | undefined,
    logoUrl: templateData.logoUrl as string | undefined,
    previewText: campaign.preheader || undefined,
  })

  try {
    await sendTransactionalEmail({
      from: `${campaign.fromName} <${campaign.fromEmail}>`,
      to: userEmail,
      subject: `[TEST] ${campaign.subject}`,
      html,
      text,
      replyTo: campaign.replyTo || undefined,
    })

    const masked = userEmail.replace(/(.{2}).*(@.*)/, "$1***$2")
    return NextResponse.json({ success: true, sentTo: masked })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed" }, { status: 500 })
  }
}
