import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_ATTEMPTS = 3

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")

  const events = await prisma.hrisSyncEvent.findMany({
    where: { status: "pending", attemptsMade: { lt: MAX_ATTEMPTS } },
    include: { integration: true },
    take: 50,
    orderBy: { createdAt: "asc" },
  })

  if (events.length === 0) return NextResponse.json({ ok: true, idle: true })

  let succeeded = 0
  let failed = 0

  for (const event of events) {
    try {
      if (event.integration.provider === "custom_webhook" && event.integration.webhookUrl) {
        const { sendWebhook } = await import("@/lib/hris/providers/custom-webhook")
        const result = await sendWebhook(
          event.integration.webhookUrl,
          event.payload as Record<string, unknown>,
          event.integration.apiKey || undefined,
        )

        if (result.success) {
          await prisma.hrisSyncEvent.update({
            where: { id: event.id },
            data: { status: "success", successAt: new Date(), attemptsMade: { increment: 1 }, lastAttemptAt: new Date() },
          })
          await prisma.hrisIntegration.update({
            where: { id: event.integrationId },
            data: { totalSyncs: { increment: 1 }, lastSyncAt: new Date() },
          })
          succeeded++
        } else {
          const attempts = event.attemptsMade + 1
          await prisma.hrisSyncEvent.update({
            where: { id: event.id },
            data: {
              status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
              attemptsMade: attempts,
              lastAttemptAt: new Date(),
              failureReason: result.error,
            },
          })
          if (attempts >= MAX_ATTEMPTS) {
            await prisma.hrisIntegration.update({
              where: { id: event.integrationId },
              data: { totalErrors: { increment: 1 }, lastErrorAt: new Date(), lastErrorMsg: result.error },
            })
          }
          failed++
        }
      } else {
        // Provider not implemented yet — mark as failed
        await prisma.hrisSyncEvent.update({
          where: { id: event.id },
          data: { status: "failed", failureReason: `Provider "${event.integration.provider}" not yet implemented`, attemptsMade: { increment: 1 }, lastAttemptAt: new Date() },
        })
        failed++
      }
    } catch (err) {
      await prisma.hrisSyncEvent.update({
        where: { id: event.id },
        data: { status: "failed", failureReason: err instanceof Error ? err.message : "Unknown error", attemptsMade: { increment: 1 }, lastAttemptAt: new Date() },
      })
      failed++
    }
  }

  return NextResponse.json({ ok: true, processed: events.length, succeeded, failed })
}
