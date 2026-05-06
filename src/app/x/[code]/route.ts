import { NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { prisma } = await import("@/lib/prisma")

  const link = await prisma.shortLink.findUnique({ where: { code } })
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (link.expiresAt && link.expiresAt < new Date()) return NextResponse.json({ error: "Link expired" }, { status: 410 })

  const ip = _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
  const ua = _req.headers.get("user-agent") || null
  const ref = _req.headers.get("referer") || null

  // Fire-and-forget click tracking — don't block redirect
  prisma.linkClick.create({
    data: { shortLinkId: link.id, recipientId: link.recipientId, ipAddress: ip, userAgent: ua, referer: ref },
  }).then(() => {
    if (link.recipientId) {
      return prisma.messageRecipient.findUnique({ where: { id: link.recipientId }, select: { clientId: true } })
        .then(r => { if (r) return prisma.client.update({ where: { id: r.clientId }, data: { smsLastEngagedAt: new Date() } }) })
    }
  }).catch(() => {})

  return NextResponse.redirect(link.destinationUrl, 302)
}
