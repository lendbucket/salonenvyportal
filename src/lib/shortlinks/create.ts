const CHARS = "abcdefghjkmnpqrstuvwxyz23456789" // no 0, O, I, l, 1
const CODE_LENGTH = 6
const MAX_RETRIES = 5

function generateCode(): string {
  let code = ""
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

export async function createShortLink(params: {
  destinationUrl: string
  campaignId?: string
  recipientId?: string
  expiresAt?: Date
}): Promise<{ code: string; fullUrl: string }> {
  const { prisma } = await import("@/lib/prisma")

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode()
    try {
      await prisma.shortLink.create({
        data: {
          code,
          destinationUrl: params.destinationUrl,
          campaignId: params.campaignId || null,
          recipientId: params.recipientId || null,
          expiresAt: params.expiresAt || null,
        },
      })
      return { code, fullUrl: `https://senvy.us/x/${code}` }
    } catch {
      // Unique constraint violation — retry with new code
      if (attempt === MAX_RETRIES - 1) throw new Error("Failed to generate unique short link code after max retries")
    }
  }
  throw new Error("Failed to generate unique short link code")
}
