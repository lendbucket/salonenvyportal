import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/twilio"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Find all notified entries whose hold window has expired
  const expiredEntries = await prisma.waitlistEntry.findMany({
    where: {
      notificationStatus: "notified",
      notificationExpiry: { lt: now },
    },
  })

  let expiredCount = 0
  let notifiedCount = 0

  for (const entry of expiredEntries) {
    // Mark as expired
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: {
        notificationStatus: "expired",
        status: "expired",
        updatedAt: now,
      },
    })
    expiredCount++

    // Find next waiting entry for same location + date + stylist
    const nextEntry = await prisma.waitlistEntry.findFirst({
      where: {
        locationId: entry.locationId,
        requestedDate: entry.requestedDate,
        requestedStylist: entry.requestedStylist,
        status: "waiting",
        notificationStatus: null,
      },
      orderBy: { createdAt: "asc" },
    })

    if (nextEntry && nextEntry.customerPhone) {
      const token = generateToken()
      const dateStr = entry.requestedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
      const timeStr = entry.requestedDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
      const expiry = new Date(now.getTime() + 15 * 60 * 1000)

      const message =
        `Hi ${nextEntry.customerName}! A spot just opened at Salon Envy on ${dateStr} at ${timeStr}. ` +
        `Book now (15 min hold): https://portal.salonenvyusa.com/waitlist/accept?token=${token} ` +
        `\u2014 Reply STOP to opt out.`

      await sendSMS(nextEntry.customerPhone, message)

      await prisma.waitlistEntry.update({
        where: { id: nextEntry.id },
        data: {
          notifiedAt: now,
          notificationExpiry: expiry,
          notificationStatus: "notified",
          notificationToken: token,
          status: "contacted",
          updatedAt: now,
        },
      })
      notifiedCount++
    }
  }

  return NextResponse.json({
    success: true,
    expired: expiredCount,
    notified: notifiedCount,
    timestamp: now.toISOString(),
  })
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let token = ""
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}
