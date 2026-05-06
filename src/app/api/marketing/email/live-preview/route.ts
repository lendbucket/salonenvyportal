import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { renderEmail } from "@/lib/email/render"

/**
 * Live preview — renders email template with provided props, returns HTML.
 * Used by the composer for real-time preview.
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
