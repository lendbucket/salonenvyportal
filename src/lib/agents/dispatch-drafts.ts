/**
 * Dispatches approved agent drafts via the existing SMS pipeline.
 * Runs every 15 minutes via cron. Finds approved drafts where
 * proposedSendAt <= NOW(), creates MarketingMessage + MessageRecipient,
 * and hands off to the sms-send cron for actual delivery.
 */

export async function dispatchApprovedDrafts(): Promise<{ dispatched: number; errors: string[] }> {
  const { prisma } = await import("@/lib/prisma")

  const now = new Date()
  const drafts = await prisma.agentDraft.findMany({
    where: {
      status: "approved",
      proposedSendAt: { lte: now },
      channel: "sms",
    },
    include: {
      client: { select: { id: true, phone: true, firstName: true, smsMarketingConsent: true, smsOptedOutAt: true } },
      agent: { select: { id: true } },
    },
    take: 60,
  })

  if (drafts.length === 0) return { dispatched: 0, errors: [] }

  const errors: string[] = []
  let dispatched = 0

  for (const draft of drafts) {
    try {
      // Late-stage opt-out check
      if (!draft.client.smsMarketingConsent || draft.client.smsOptedOutAt || !draft.client.phone) {
        await prisma.agentDraft.update({
          where: { id: draft.id },
          data: { status: "bounced" },
        })
        continue
      }

      // Create a MarketingMessage for tracking (one per draft, single recipient)
      const message = await prisma.marketingMessage.create({
        data: {
          channel: "SMS",
          category: "RETENTION",
          status: "SENDING",
          body: draft.messageBody,
          audienceFilter: { type: "MANUAL", clientIds: [draft.clientId] },
          recipientCount: 1,
          estimatedCost: 0.0079, // 1 segment estimate
          createdBy: "agent:reyna_recovery",
          startedAt: now,
        },
      })

      // Create the recipient record (sms-send cron picks this up)
      await prisma.messageRecipient.create({
        data: {
          messageId: message.id,
          clientId: draft.clientId,
          channel: "SMS",
          destination: draft.client.phone,
          personalizedBody: draft.messageBody,
          segmentCount: Math.ceil(draft.messageBody.length / 160),
          status: "QUEUED",
        },
      })

      // Update draft status
      await prisma.agentDraft.update({
        where: { id: draft.id },
        data: { status: "sent", sentAt: now, marketingMessageId: message.id },
      })

      // Bump agent counters
      await prisma.agent.update({
        where: { id: draft.agent.id },
        data: { totalSent: { increment: 1 } },
      })

      dispatched++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Draft ${draft.id}: ${msg}`)
    }
  }

  return { dispatched, errors }
}
