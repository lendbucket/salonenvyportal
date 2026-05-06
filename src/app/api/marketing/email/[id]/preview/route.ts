import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { renderEmail } from "@/lib/email/render"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // If cached HTML exists, return it
  if (campaign.htmlContent) {
    return new NextResponse(campaign.htmlContent, {
      headers: { "Content-Type": "text/html" },
    })
  }

  const templateData = (campaign.templateData || {}) as Record<string, unknown>
  const { html } = await renderEmail(campaign.templateKey, {
    firstName: "Sarah",
    bodyText: templateData.bodyText as string | undefined,
    imageUrl: templateData.imageUrl as string | undefined,
    ctaText: templateData.ctaText as string | undefined,
    ctaUrl: templateData.ctaUrl as string | undefined,
    offerCode: templateData.offerCode as string | undefined,
    expiresAt: templateData.expiresAt as string | undefined,
    logoUrl: templateData.logoUrl as string | undefined,
    previewText: campaign.preheader || undefined,
  })

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  })
}

/**
 * Live preview — accepts template data in POST body, renders on-the-fly
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const templateKey = body.templateKey || "promo"

  try {
    const { html } = await renderEmail(templateKey, {
      firstName: body.firstName || "Sarah",
      bodyText: body.bodyText,
      imageUrl: body.imageUrl,
      ctaText: body.ctaText,
      ctaUrl: body.ctaUrl,
      offerCode: body.offerCode,
      expiresAt: body.expiresAt,
      logoUrl: body.logoUrl,
      previewText: body.preheader,
    })

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Render failed" }, { status: 500 })
  }
}
