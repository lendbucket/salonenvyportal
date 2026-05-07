import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"

const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "cancel", "end", "quit", "stopall"])
const START_KEYWORDS = new Set(["start", "yes", "join", "subscribe", "unstop"])
const HELP_KEYWORDS = new Set(["help", "info"])

function twiml(body?: string): NextResponse {
  const xml = body
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } })
}

function verifyTwilioSignature(req: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false
  const sig = req.headers.get("x-twilio-signature")
  if (!sig) return false
  const url = `${process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"}/api/twilio/webhook/inbound`
  const params = new URLSearchParams(body)
  const sorted = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const data = url + sorted.map(([k, v]) => k + v).join("")
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64")
  return sig === expected
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return phone.startsWith("+") ? phone : `+${digits}`
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyTwilioSignature(req, rawBody)) {
    return twiml() // Return valid TwiML even on auth failure to prevent retries
  }

  try {
    const { prisma } = await import("@/lib/prisma")
    const params = new URLSearchParams(rawBody)
    const from = params.get("From") || ""
    const messageBody = (params.get("Body") || "").trim().toLowerCase()
    const normalized = normalizePhone(from)
    const last10 = normalized.replace(/\D/g, "").slice(-10)

    // Find client by phone
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { phone: normalized },
          { phone: `+1${last10}` },
          { phone: last10 },
          { phone: { endsWith: last10 } },
        ],
      },
    })

    if (!client) {
      // Unknown number — still save to inbox for visibility
      const unknownSid = params.get("MessageSid") || ""
      if (unknownSid) {
        await prisma.inboundMessage.create({
          data: {
            channel: "sms", fromNumber: normalized, toNumber: params.get("To") || "",
            body: (params.get("Body") || "").trim(),
            twilioMessageSid: unknownSid, twilioAccountSid: params.get("AccountSid") || null,
            status: "unread",
          },
        }).catch(() => {})
      }
      return twiml()
    }

    if (STOP_KEYWORDS.has(messageBody)) {
      await prisma.client.update({
        where: { id: client.id },
        data: { smsMarketingConsent: false, smsOptedOutAt: new Date() },
      })
      await prisma.optInRecord.create({
        data: { clientId: client.id, channel: "SMS", action: "OPT_OUT", method: "STOP_KEYWORD", source: "twilio_webhook" },
      })
      // Persist to inbox as actioned
      const stopSid = params.get("MessageSid") || ""
      if (stopSid) {
        await prisma.inboundMessage.create({
          data: {
            channel: "sms", fromNumber: normalized, toNumber: params.get("To") || "",
            clientId: client.id, body: (params.get("Body") || "").trim(),
            twilioMessageSid: stopSid, twilioAccountSid: params.get("AccountSid") || null,
            status: "actioned", intent: "stop",
          },
        }).catch(() => {})
      }
      return twiml() // Let Twilio's built-in STOP reply through
    }

    if (START_KEYWORDS.has(messageBody)) {
      await prisma.client.update({
        where: { id: client.id },
        data: { smsMarketingConsent: true, smsOptedOutAt: null },
      })
      await prisma.optInRecord.create({
        data: { clientId: client.id, channel: "SMS", action: "RE_OPT_IN", method: "START_KEYWORD", source: "twilio_webhook" },
      })
      return twiml("You're re-subscribed to Salon Envy messages. Reply STOP anytime to opt out.")
    }

    if (HELP_KEYWORDS.has(messageBody)) {
      return twiml("Salon Envy: For help, call (888) 996-2793 or visit salonenvyusa.com. Reply STOP to opt out. Msg & data rates may apply.")
    }

    // General reply — correlate to recent campaign if possible
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentRecipient = await prisma.messageRecipient.findFirst({
      where: { clientId: client.id, sentAt: { gte: sevenDaysAgo } },
      orderBy: { sentAt: "desc" },
    })
    if (recentRecipient) {
      await prisma.messageEvent.create({
        data: { recipientId: recentRecipient.id, type: "REPLY_RECEIVED", payload: { body: messageBody } },
      })
    }
    await prisma.client.update({ where: { id: client.id }, data: { smsLastEngagedAt: new Date() } })

    // Save inbound message for inbox visibility
    const messageSid = params.get("MessageSid") || ""
    const toNumber = params.get("To") || ""
    const numMedia = parseInt(params.get("NumMedia") || "0", 10)
    const originalBody = (params.get("Body") || "").trim()

    if (messageSid) {
      await prisma.inboundMessage.create({
        data: {
          channel: "sms",
          fromNumber: normalized,
          toNumber,
          clientId: client.id,
          replyToRecipientId: recentRecipient?.id ?? null,
          body: originalBody,
          numMediaItems: numMedia,
          mediaUrls: [],
          twilioMessageSid: messageSid,
          twilioAccountSid: params.get("AccountSid") || null,
          status: "unread",
        },
      }).catch(() => {}) // Ignore duplicate twilioMessageSid
    }

    return twiml() // No auto-reply for general messages
  } catch (err) {
    console.error("[twilio-inbound] Error:", err instanceof Error ? err.message : err)
    return twiml() // Always return 200 to prevent Twilio retry storms
  }
}
