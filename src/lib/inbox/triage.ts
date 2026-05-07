/**
 * AI triage for inbound SMS messages.
 * Classifies intent: booking_request | question | compliment | complaint | stop | other
 */

export async function triageUnclassifiedMessages(): Promise<{ classified: number; errors: number }> {
  const { prisma } = await import("@/lib/prisma")

  const messages = await prisma.inboundMessage.findMany({
    where: { intent: null, status: { not: "actioned" } },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: { id: true, body: true, replyToRecipientId: true },
  })

  if (messages.length === 0) return { classified: 0, errors: 0 }

  let classified = 0
  let errors = 0

  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic()

  for (const msg of messages) {
    try {
      // Find outbound context if available
      let outboundBody = ""
      if (msg.replyToRecipientId) {
        const recipient = await prisma.messageRecipient.findUnique({
          where: { id: msg.replyToRecipientId },
          select: { personalizedBody: true },
        })
        if (recipient?.personalizedBody) outboundBody = recipient.personalizedBody
      }

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        system: "Classify the intent of this SMS reply to a salon marketing message. Return ONLY one of: booking_request, question, compliment, complaint, stop, other. Nothing else.",
        messages: [{
          role: "user",
          content: outboundBody
            ? `Original outbound: "${outboundBody}"\nClient reply: "${msg.body}"`
            : `Client message: "${msg.body}"`,
        }],
      })

      const intent = response.content[0].type === "text" ? response.content[0].text.trim().toLowerCase() : "other"
      const validIntents = ["booking_request", "question", "compliment", "complaint", "stop", "other"]
      const finalIntent = validIntents.includes(intent) ? intent : "other"

      await prisma.inboundMessage.update({
        where: { id: msg.id },
        data: { intent: finalIntent, intentConfidence: 0.85 },
      })
      classified++
    } catch {
      errors++
    }
  }

  return { classified, errors }
}
