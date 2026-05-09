import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"

/**
 * Resend webhook handler for email engagement tracking.
 * Verifies Svix signatures and processes:
 * email.sent, email.delivered, email.opened, email.clicked,
 * email.bounced, email.complained, email.unsubscribed
 */

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || ""

type ResendEvent = {
  type: string
  created_at: string
  data: {
    email_id?: string
    from?: string
    to?: string[]
    subject?: string
    click?: { link?: string; timestamp?: string }
    bounce?: { type?: string; message?: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
}

async function verifyWebhook(req: NextRequest): Promise<ResendEvent> {
  const body = await req.text()
  const svixId = req.headers.get("svix-id") || ""
  const svixTimestamp = req.headers.get("svix-timestamp") || ""
  const svixSignature = req.headers.get("svix-signature") || ""

  if (!WEBHOOK_SECRET) {
    throw new Error("RESEND_WEBHOOK_SECRET not configured")
  }

  const wh = new Webhook(WEBHOOK_SECRET)
  const payload = wh.verify(body, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  }) as ResendEvent

  return payload
}

export async function POST(req: NextRequest) {
  let event: ResendEvent
  try {
    event = await verifyWebhook(req)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")

  const emailId = event.data.email_id
  if (!emailId) {
    return NextResponse.json({ received: true })
  }

  // Find the recipient by resendMessageId
  const recipient = await prisma.emailRecipient.findUnique({
    where: { resendMessageId: emailId },
  })

  // If no recipient found (e.g. test email or untracked send), just log the event
  if (!recipient) {
    return NextResponse.json({ received: true })
  }

  const now = new Date()
  const eventType = event.type.replace("email.", "") // "email.sent" → "sent"

  // Update recipient status + timestamp
  switch (eventType) {
    case "sent":
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: "sent", sentAt: now },
      })
      break

    case "delivered":
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: "delivered", deliveredAt: now },
      })
      // Update campaign delivered count
      await prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { totalDelivered: { increment: 1 } },
      })
      break

    case "opened":
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: "opened", openedAt: recipient.openedAt || now },
      })
      // Update contact engagement
      if (recipient.emailContactId) {
        await prisma.emailContact.update({
          where: { id: recipient.emailContactId },
          data: { totalOpened: { increment: 1 }, lastOpenedAt: now },
        })
      }
      // Update campaign opened count
      await prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { totalOpened: { increment: 1 } },
      })
      break

    case "clicked":
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: "clicked", clickedAt: recipient.clickedAt || now },
      })
      if (recipient.emailContactId) {
        await prisma.emailContact.update({
          where: { id: recipient.emailContactId },
          data: { totalClicked: { increment: 1 }, lastClickedAt: now },
        })
      }
      await prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { totalClicked: { increment: 1 } },
      })
      break

    case "bounced": {
      const isHardBounce = event.data.bounce?.type === "hard" || event.data.bounce?.type === "permanent"
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: "bounced", bouncedAt: now },
      })
      if (recipient.emailContactId) {
        await prisma.emailContact.update({
          where: { id: recipient.emailContactId },
          data: {
            totalBounced: { increment: 1 },
            bounceCount: { increment: 1 },
            ...(isHardBounce ? { isHardBounced: true, isOptedIn: false, optedOutAt: now, optOutReason: "hard_bounce" } : {}),
          },
        })
      }
      await prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { totalBounced: { increment: 1 } },
      })
      break
    }

    case "complained":
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: "complained", complainedAt: now },
      })
      if (recipient.emailContactId) {
        await prisma.emailContact.update({
          where: { id: recipient.emailContactId },
          data: {
            totalComplained: { increment: 1 },
            isOptedIn: false,
            optedOutAt: now,
            optOutReason: "spam_complaint",
          },
        })
      }
      await prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { totalComplained: { increment: 1 } },
      })
      break

    case "unsubscribed":
      await prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: "unsubscribed", unsubscribedAt: now },
      })
      if (recipient.emailContactId) {
        await prisma.emailContact.update({
          where: { id: recipient.emailContactId },
          data: {
            totalUnsubscribed: { increment: 1 },
            isOptedIn: false,
            optedOutAt: now,
            optOutReason: "unsubscribed",
          },
        })
      }
      await prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { totalUnsubscribed: { increment: 1 } },
      })
      break
  }

  // Insert EmailEvent row for audit trail
  await prisma.emailEvent.create({
    data: {
      campaignId: recipient.campaignId,
      emailContactId: recipient.emailContactId || null,
      resendMessageId: emailId,
      type: eventType,
      metadata: event.data.click ? { link: event.data.click.link || "" } : event.data.bounce ? { bounceType: event.data.bounce.type || "", message: event.data.bounce.message || "" } : undefined,
      occurredAt: now,
    },
  })

  return NextResponse.json({ received: true })
}
