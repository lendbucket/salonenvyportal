/**
 * Generate personalized recovery SMS using Anthropic API.
 */

interface MessageInput {
  firstName: string
  daysSinceLastVisit: number
  favoriteServiceCategory: string | null
  favoriteStaffName: string | null
  valueTier: string
  vipTier: string
  proposedOffer: string
}

const SYSTEM_PROMPT = `You are writing personalized salon recovery SMS messages for Salon Envy. The message must:
- Be 110-140 characters total (SMS limit, leave room for 'Reply STOP')
- Use the client's first name
- Reference their preferred stylist by first name when known
- Match warmth tone — friendly, not pushy
- Include ONE specific offer (the proposed offer text)
- End with a booking link: salonenvyusa.com/book
- DO NOT use exclamation marks except sparingly (max 1)
- DO NOT use 'we miss you' (overused)
- DO NOT mention the client's lifetime spend
- DO NOT include emoji
- Do not start the message with 'Hi' or 'Hello' — be more direct
Return ONLY the message text, no quotes or explanation.`

export async function generateMessage(input: MessageInput): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic()

  const userPrompt = `Write a recovery SMS for:
- Name: ${input.firstName}
- Days since last visit: ${input.daysSinceLastVisit}
- Favorite service: ${input.favoriteServiceCategory || "general salon services"}
- Preferred stylist: ${input.favoriteStaffName || "our team"}
- Value tier: ${input.valueTier}
- Recovery urgency: ${input.vipTier === "AT_RISK" ? "moderate — still recoverable" : input.vipTier === "LAPSED" ? "high — slipping away" : "last chance — nearly lost"}
- Offer to include: ${input.proposedOffer}`

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  })

  const text = response.content[0]
  if (text.type !== "text") throw new Error("Unexpected response type")
  return text.text.trim()
}

/**
 * Determine the offer based on value tier and agent config.
 */
export function getOfferForTier(
  valueTier: string,
  offerConfig: Record<string, string>,
): string {
  return offerConfig[valueTier] || "10% off your next visit"
}

/**
 * Resolve a staff member ID to their first name.
 */
export async function resolveStaffName(staffMemberId: string | null): Promise<string | null> {
  if (!staffMemberId) return null
  const { prisma } = await import("@/lib/prisma")
  const staff = await prisma.staffMember.findFirst({
    where: { squareTeamMemberId: staffMemberId },
    select: { fullName: true },
  })
  return staff?.fullName?.split(" ")[0] || null
}
