import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/twilio"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Find all scheduled review requests that are due to be sent
  const pendingRequests = await prisma.reviewRequest.findMany({
    where: {
      status: "scheduled",
      sendAt: { lte: now },
    },
  })

  let sentCount = 0
  let failedCount = 0

  for (const request of pendingRequests) {
    if (!request.clientPhone) {
      // No phone number, mark as failed
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: "failed" },
      })
      failedCount++
      continue
    }

    const stylistDisplay = request.stylistName || "your stylist"

    const message =
      `Hi ${request.clientName}! Thank you for visiting Salon Envy today. ` +
      `How was your experience with ${stylistDisplay}? ` +
      `Rate us: https://portal.salonenvyusa.com/review/${request.id} ` +
      `\u2014 Reply STOP to opt out.`

    const smsResult = await sendSMS(request.clientPhone, message)

    if (smsResult.success) {
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: {
          status: "sent",
          sentAt: now,
        },
      })
      sentCount++
    } else {
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: "failed" },
      })
      failedCount++
    }
  }

  return NextResponse.json({
    success: true,
    sent: sentCount,
    failed: failedCount,
    total: pendingRequests.length,
    timestamp: now.toISOString(),
  })
}
