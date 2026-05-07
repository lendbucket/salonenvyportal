import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ fromNumber: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const { fromNumber } = await params
  const decoded = decodeURIComponent(fromNumber)
  const body = await req.json()
  const messageText = body.message as string
  if (!messageText) return NextResponse.json({ error: "Message required" }, { status: 400 })

  // Send via Twilio
  const twilio = await import("twilio")
  const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const msg = await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: decoded,
    body: messageText,
  })

  // Mark all unread messages from this number as actioned
  await prisma.inboundMessage.updateMany({
    where: { fromNumber: decoded, status: "unread" },
    data: { status: "actioned", repliedById: userId, repliedAt: new Date() },
  })

  return NextResponse.json({ success: true, twilioSid: msg.sid })
}
