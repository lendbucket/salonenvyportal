import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params

  const msg = await prisma.inboundMessage.findUnique({
    where: { id },
    include: { client: { select: { firstName: true, vipTier: true, valueTier: true, lifetimeSpend: true, lastVisitAt: true } } },
  })
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Find the outbound message they replied to
  let outboundContext = ""
  if (msg.replyToRecipientId) {
    const recipient = await prisma.messageRecipient.findUnique({
      where: { id: msg.replyToRecipientId },
      select: { personalizedBody: true },
    })
    if (recipient?.personalizedBody) outboundContext = `\nOriginal outbound message: "${recipient.personalizedBody}"`
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic()

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: `You draft SMS replies for Salon Envy, a hair salon in Texas. Keep replies under 160 characters. Be warm, professional, and helpful. If the client wants to book, direct them to salonenvyusa.com/book or call (361) 444-1535. Never use emoji. End with "- Salon Envy" signature.`,
    messages: [{
      role: "user",
      content: `Client "${msg.client?.firstName || "Customer"}" (${msg.client?.vipTier || "unknown"} tier, $${msg.client?.lifetimeSpend?.toFixed(0) || "0"} lifetime) texted: "${msg.body}"${outboundContext}\n\nDraft a reply:`,
    }],
  })

  const reply = response.content[0].type === "text" ? response.content[0].text.trim() : ""

  // Save draft on the message
  await prisma.inboundMessage.update({ where: { id }, data: { replyDraft: reply } })

  return NextResponse.json({ draft: reply })
}
