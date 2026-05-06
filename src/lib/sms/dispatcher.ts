import type { AudienceFilter } from "@/lib/audience/types"
import { buildAudience } from "@/lib/audience/build"
import { personalizeBody, segmentCount } from "./personalize"

const COST_PER_SEGMENT = 0.0079 // Twilio A2P 10DLC rate

export async function dispatchSMSCampaign(messageId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma")

  const message = await prisma.marketingMessage.findUnique({ where: { id: messageId } })
  if (!message) throw new Error("Message not found")

  const filter = message.audienceFilter as AudienceFilter
  const audience = await buildAudience(filter, "SMS")

  if (audience.length === 0) {
    await prisma.marketingMessage.update({
      where: { id: messageId },
      data: { status: "FAILED", completedAt: new Date() },
    })
    return
  }

  // Create recipient rows
  const recipientData = audience.map(client => {
    const body = personalizeBody(message.body, client)
    const segments = segmentCount(body)
    return {
      messageId,
      clientId: client.id,
      channel: "SMS" as const,
      destination: client.phone!,
      personalizedBody: body,
      segmentCount: segments,
      status: "QUEUED" as const,
    }
  })

  // Batch insert recipients
  await prisma.messageRecipient.createMany({ data: recipientData, skipDuplicates: true })

  // Calculate cost estimate
  const totalSegments = recipientData.reduce((sum, r) => sum + r.segmentCount, 0)
  const estimatedCost = Math.round(totalSegments * COST_PER_SEGMENT * 100) / 100

  await prisma.marketingMessage.update({
    where: { id: messageId },
    data: {
      status: "SENDING",
      recipientCount: audience.length,
      estimatedCost,
      startedAt: new Date(),
    },
  })
}
