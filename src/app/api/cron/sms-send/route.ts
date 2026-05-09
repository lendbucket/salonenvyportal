import { NextRequest, NextResponse } from "next/server"
import { replaceLinksInBody } from "@/lib/sms/replace-links"

export const maxDuration = 60

const SOFT_DEADLINE_MS = 50_000
const BATCH_LIMIT = 60 // ~1 per second for 60s

export async function GET(req: NextRequest) {
  // KILL SWITCH — set PORTAL_KILL_SWITCH=true in Vercel env vars to disable
  if (process.env.PORTAL_KILL_SWITCH === "true") {
    return NextResponse.json({ disabled: true, reason: "kill_switch_active" }, { status: 200 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")

  // Find oldest SENDING message with queued recipients
  const message = await prisma.marketingMessage.findFirst({
    where: {
      status: "SENDING",
      recipients: { some: { status: "QUEUED" } },
    },
    orderBy: { startedAt: "asc" },
  })

  if (!message) return NextResponse.json({ idle: true })

  const startTime = Date.now()
  let sent = 0
  let failed = 0

  // Fetch queued recipients batch
  const recipients = await prisma.messageRecipient.findMany({
    where: { messageId: message.id, status: "QUEUED" },
    include: { client: { select: { smsMarketingConsent: true, smsOptedOutAt: true } } },
    take: BATCH_LIMIT,
  })

  const twilio = await import("twilio")
  const twilioClient = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  for (const recipient of recipients) {
    if (Date.now() - startTime > SOFT_DEADLINE_MS) break

    // Late-stage opt-out check
    if (!recipient.client.smsMarketingConsent || recipient.client.smsOptedOutAt) {
      await prisma.messageRecipient.update({
        where: { id: recipient.id },
        data: { status: "OPTED_OUT_PRE_SEND" },
      })
      await prisma.messageEvent.create({
        data: { recipientId: recipient.id, type: "OPT_OUT" },
      })
      continue
    }

    try {
      // Replace links with senvy.us trackers
      const bodyWithLinks = await replaceLinksInBody(recipient.personalizedBody, recipient.id, message.id)

      // Send via Twilio
      const statusCallbackUrl = `${process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"}/api/twilio/webhook/status`
      const twilioMsg = await twilioClient.messages.create({
        from: fromNumber!,
        to: recipient.destination,
        body: bodyWithLinks,
        statusCallback: statusCallbackUrl,
        ...(message.mmsImageUrl ? { mediaUrl: [message.mmsImageUrl] } : {}),
      })

      await prisma.messageRecipient.update({
        where: { id: recipient.id },
        data: { twilioSid: twilioMsg.sid, status: "SENT", sentAt: new Date() },
      })
      await prisma.messageEvent.create({
        data: { recipientId: recipient.id, type: "SENT" },
      })
      sent++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await prisma.messageRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", failedAt: new Date(), errorMessage: msg },
      })
      await prisma.messageEvent.create({
        data: { recipientId: recipient.id, type: "FAILED", payload: { error: msg } },
      })
      failed++
    }
  }

  // Check if campaign is done
  const remaining = await prisma.messageRecipient.count({ where: { messageId: message.id, status: "QUEUED" } })
  if (remaining === 0) {
    await prisma.marketingMessage.update({
      where: { id: message.id },
      data: { status: "SENT", completedAt: new Date() },
    })
  }

  return NextResponse.json({ messageId: message.id, sent, failed, remaining })
}
