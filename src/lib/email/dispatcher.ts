import type { AudienceFilter } from "@/lib/audience/types"
import { buildAudience } from "@/lib/audience/build"
import { renderEmail } from "./render"
import { sendTransactionalEmail } from "./resend-client"

const TRANSACTIONAL_THRESHOLD = 100

/**
 * Dispatch an email campaign.
 * - For small lists (<100): sends individual transactional emails via Resend
 * - For large lists: uses Resend Broadcasts API
 * Only sends to EmailContacts that are opted in and not hard-bounced.
 */
export async function dispatchEmailCampaign(campaignId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma")

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error("Campaign not found")

  const filter = campaign.audienceFilter as AudienceFilter
  const audience = await buildAudience(filter, "EMAIL")

  if (audience.length === 0) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed" },
    })
    return
  }

  // Look up EmailContacts for these clients — only opted-in, not hard-bounced
  const clientIds = audience.map(c => c.id)
  const emailContacts = await prisma.emailContact.findMany({
    where: {
      clientId: { in: clientIds },
      isOptedIn: true,
      isHardBounced: false,
    },
    select: {
      id: true,
      clientId: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  })

  if (emailContacts.length === 0) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed" },
    })
    return
  }

  // Render the template with default props (personalization done per-recipient for transactional)
  const templateData = (campaign.templateData || {}) as Record<string, unknown>
  const baseProps = {
    bodyText: templateData.bodyText as string | undefined,
    imageUrl: templateData.imageUrl as string | undefined,
    ctaText: templateData.ctaText as string | undefined,
    ctaUrl: templateData.ctaUrl as string | undefined,
    offerCode: templateData.offerCode as string | undefined,
    expiresAt: templateData.expiresAt as string | undefined,
    logoUrl: templateData.logoUrl as string | undefined,
    previewText: campaign.preheader || undefined,
  }

  // Create EmailRecipient rows
  const recipientData = emailContacts.map(contact => ({
    campaignId,
    emailContactId: contact.id,
    email: contact.email,
    status: "queued" as const,
  }))

  await prisma.emailRecipient.createMany({ data: recipientData, skipDuplicates: true })

  // Update campaign status
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "sending",
      recipientCount: emailContacts.length,
      sentAt: new Date(),
    },
  })

  // Cache rendered HTML on campaign
  const { html: renderedHtml } = await renderEmail(campaign.templateKey, {
    ...baseProps,
    firstName: "Friend",
  })
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { htmlContent: renderedHtml },
  })

  const fromAddress = `${campaign.fromName} <${campaign.fromEmail}>`

  if (emailContacts.length < TRANSACTIONAL_THRESHOLD) {
    // Small list: send individual transactional emails
    let sentCount = 0
    let failedCount = 0

    for (const contact of emailContacts) {
      try {
        const { html, text } = await renderEmail(campaign.templateKey, {
          ...baseProps,
          firstName: contact.firstName || "Friend",
        })

        const messageId = await sendTransactionalEmail({
          from: fromAddress,
          to: contact.email,
          subject: campaign.subject,
          html,
          text,
          replyTo: campaign.replyTo || undefined,
        })

        await prisma.emailRecipient.updateMany({
          where: { campaignId, emailContactId: contact.id },
          data: { status: "sent", sentAt: new Date(), resendMessageId: messageId },
        })

        await prisma.emailContact.update({
          where: { id: contact.id },
          data: { totalSent: { increment: 1 }, lastSentAt: new Date() },
        })

        sentCount++
      } catch {
        await prisma.emailRecipient.updateMany({
          where: { campaignId, emailContactId: contact.id },
          data: { status: "failed", failedAt: new Date(), failedReason: "Send failed" },
        })
        failedCount++
      }
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: failedCount === emailContacts.length ? "failed" : "sent",
        totalSent: sentCount,
      },
    })
  } else {
    // Large list: use Resend Broadcasts API
    // Create audience on-the-fly, add contacts, create broadcast, send
    const { createAudience, addContactToAudience, createBroadcast, sendBroadcast } = await import("./resend-client")

    const audienceName = `Campaign: ${campaign.name} (${new Date().toISOString().slice(0, 10)})`
    const audienceId = await createAudience(audienceName)

    // Add contacts to audience
    for (const contact of emailContacts) {
      try {
        const resendContactId = await addContactToAudience(audienceId, {
          email: contact.email,
          firstName: contact.firstName || undefined,
          lastName: contact.lastName || undefined,
        })
        // Store resend contact/audience IDs if not already set
        if (!contact.id) continue
        await prisma.emailContact.update({
          where: { id: contact.id },
          data: {
            resendContactId: resendContactId,
            resendAudienceId: audienceId,
            totalSent: { increment: 1 },
            lastSentAt: new Date(),
          },
        }).catch(() => {}) // Skip if resendContactId conflicts (already exists)
      } catch {
        // Continue adding other contacts
      }
    }

    // Create and send broadcast
    const { html } = await renderEmail(campaign.templateKey, {
      ...baseProps,
      firstName: "{{FIRST_NAME|Friend}}",
    })

    const broadcastId = await createBroadcast({
      audienceId,
      from: fromAddress,
      subject: campaign.subject,
      replyTo: campaign.replyTo || undefined,
      html,
      name: campaign.name,
    })

    if (campaign.scheduledFor) {
      await sendBroadcast(broadcastId, campaign.scheduledFor.toISOString())
    } else {
      await sendBroadcast(broadcastId)
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        resendBroadcastId: broadcastId,
        status: campaign.scheduledFor ? "scheduled" : "sent",
        totalSent: emailContacts.length,
      },
    })

    // Mark all recipients as sent
    await prisma.emailRecipient.updateMany({
      where: { campaignId, status: "queued" },
      data: { status: "sent", sentAt: new Date() },
    })
  }
}
