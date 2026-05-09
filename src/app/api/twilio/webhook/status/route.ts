import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"

function verifyTwilioSignature(req: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false
  const sig = req.headers.get("x-twilio-signature")
  if (!sig) return false
  const url = `${process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"}/api/twilio/webhook/status`
  const params = new URLSearchParams(body)
  const sorted = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const data = url + sorted.map(([k, v]) => k + v).join("")
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64")
  return sig === expected
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyTwilioSignature(req, rawBody)) {
    return new NextResponse("", { status: 200 })
  }

  try {
    const { prisma } = await import("@/lib/prisma")
    const params = new URLSearchParams(rawBody)
    const messageSid = params.get("MessageSid")
    const messageStatus = (params.get("MessageStatus") || "").toLowerCase()
    const errorCode = params.get("ErrorCode")
    const errorMessage = params.get("ErrorMessage")
    const price = params.get("Price")

    if (!messageSid) return new NextResponse("", { status: 200 })

    const recipient = await prisma.messageRecipient.findFirst({ where: { twilioSid: messageSid } })
    if (!recipient) return new NextResponse("", { status: 200 })

    const now = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    switch (messageStatus) {
      case "queued":
        updateData.status = "QUEUED"
        break
      case "sent":
        updateData.status = "SENT"
        updateData.sentAt = now
        break
      case "delivered":
        updateData.status = "DELIVERED"
        updateData.deliveredAt = now
        break
      case "undelivered":
      case "failed":
        updateData.status = "FAILED"
        updateData.failedAt = now
        updateData.errorCode = errorCode
        updateData.errorMessage = errorMessage
        break
      default:
        break
    }

    if (price) {
      const costValue = Math.abs(parseFloat(price))
      if (!isNaN(costValue)) {
        updateData.cost = costValue
        // Increment parent message actualCost
        await prisma.marketingMessage.update({
          where: { id: recipient.messageId },
          data: { actualCost: { increment: costValue } },
        })
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.messageRecipient.update({ where: { id: recipient.id }, data: updateData })
    }

    await prisma.messageEvent.create({
      data: { recipientId: recipient.id, type: messageStatus.toUpperCase(), payload: { messageSid, errorCode, errorMessage, price } },
    })

    return new NextResponse("", { status: 200 })
  } catch (err) {
    console.error("[twilio-status] Error:", err instanceof Error ? err.message : err)
    return new NextResponse("", { status: 200 })
  }
}
