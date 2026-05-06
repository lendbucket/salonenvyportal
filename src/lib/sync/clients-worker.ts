import { PrismaClient } from "@prisma/client"

const BATCH_SIZE = 100
const UPSERT_CHUNK = 25
const SOFT_DEADLINE_MS = 50_000
const MAX_ERRORS = 5
const SQ_BASE = "https://connect.squareup.com/v2"

function parseBirthday(birthday: string | null | undefined): Date | null {
  if (!birthday) return null
  const parts = birthday.split("-")
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export async function processClientsSyncBatch(jobId: string): Promise<{
  done: boolean
  processed: number
  cursor: string | null
}> {
  // Fresh PrismaClient per invocation — prevents connection pool corruption
  const prisma = new PrismaClient()
  const deadline = Date.now() + SOFT_DEADLINE_MS

  try {
    const job = await prisma.syncJob.findUnique({ where: { id: jobId } })
    if (!job || job.status !== "running") {
      return { done: true, processed: 0, cursor: null }
    }

    await prisma.syncJob.update({ where: { id: jobId }, data: { lastTickAt: new Date() } })

    let cursor: string | null = job.cursor
    let processedThisInvocation = 0
    let pagesThisInvocation = 0

    while (true) {
      // Check deadline BEFORE fetching next page
      if (Date.now() > deadline) {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            cursor,
            totalProcessed: { increment: processedThisInvocation },
            pagesProcessed: { increment: pagesThisInvocation },
            lastTickAt: new Date(),
          },
        })
        return { done: false, processed: processedThisInvocation, cursor }
      }

      // Remember the cursor BEFORE this page — if processing fails, we retry from here
      const cursorBeforePage = cursor

      try {
        // Fetch one Square page
        let url = `${SQ_BASE}/customers?limit=${BATCH_SIZE}`
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "Square-Version": "2025-04-16",
          },
        })

        if (!res.ok) {
          const body = await res.text().catch(() => "")
          throw new Error(`Square API ${res.status}: ${body.slice(0, 200)}`)
        }

        const data = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customers: any[] = data.customers || []
        const nextCursor: string | null = data.cursor || null
        const now = new Date()

        // Build upsert operations for the full page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const operations: any[] = []
        for (const c of customers) {
          if (!c.id) continue
          const addr = c.address
          const upsertData = {
            squareCustomerId: c.id,
            firstName: c.given_name || null,
            lastName: c.family_name || null,
            email: c.email_address || null,
            phone: c.phone_number || null,
            squareNote: c.note || null,
            addressLine1: addr?.address_line_1 || null,
            addressLine2: addr?.address_line_2 || null,
            addressCity: addr?.locality || null,
            addressState: addr?.administrative_district_level_1 || null,
            addressZip: addr?.postal_code || null,
            addressCountry: addr?.country || null,
            birthday: parseBirthday(c.birthday),
            squareReferenceId: c.reference_id || null,
            emailUnsubscribed: c.preferences?.email_unsubscribed ?? null,
            squareGroupIds: c.group_ids || [],
            lastSyncedAt: now,
          }

          operations.push(
            prisma.client.upsert({
              where: { squareCustomerId: c.id },
              create: { ...upsertData, createdAt: c.created_at ? new Date(c.created_at) : now },
              update: upsertData,
            })
          )
        }

        // Execute in chunks of 25 via $transaction
        for (let i = 0; i < operations.length; i += UPSERT_CHUNK) {
          await prisma.$transaction(operations.slice(i, i + UPSERT_CHUNK))
        }

        // Page fully processed — advance cursor
        processedThisInvocation += customers.length
        pagesThisInvocation += 1
        cursor = nextCursor

        if (!nextCursor) {
          // Sync complete
          await prisma.syncJob.update({
            where: { id: jobId },
            data: {
              status: "completed",
              cursor: null,
              totalProcessed: { increment: processedThisInvocation },
              pagesProcessed: { increment: pagesThisInvocation },
              lastTickAt: new Date(),
              completedAt: new Date(),
            },
          })
          return { done: true, processed: processedThisInvocation, cursor: null }
        }

        // Save checkpoint — cursor now points to next page
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            cursor,
            totalProcessed: { increment: processedThisInvocation },
            pagesProcessed: { increment: pagesThisInvocation },
            lastTickAt: new Date(),
          },
        })
        // Reset counters after checkpoint — next increment starts from 0
        processedThisInvocation = 0
        pagesThisInvocation = 0

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const code = (err as { code?: string }).code
        const isTransient = code === "P1001" || code === "P1008" || code === "P2021" || msg.includes("Square API 5")

        console.error(`[clients-sync] Error processing page: ${msg}`)

        // Increment error count — save state with cursor at LAST SUCCESSFUL position
        try {
          const currentJob = await prisma.syncJob.findUnique({ where: { id: jobId }, select: { errorCount: true } })
          const newErrorCount = (currentJob?.errorCount || 0) + 1
          const shouldFail = !isTransient && newErrorCount >= MAX_ERRORS

          await prisma.syncJob.update({
            where: { id: jobId },
            data: {
              cursor: cursorBeforePage, // Rewind to before the failed page
              totalProcessed: { increment: processedThisInvocation },
              pagesProcessed: { increment: pagesThisInvocation },
              lastTickAt: new Date(),
              errorCount: newErrorCount,
              errorMessage: msg.slice(0, 500),
              status: shouldFail ? "failed" : "running",
            },
          })

          return { done: shouldFail, processed: processedThisInvocation, cursor: cursorBeforePage }
        } catch (saveErr) {
          // Even the error-save failed — log and bail
          console.error("[clients-sync] Failed to save error state:", saveErr instanceof Error ? saveErr.message : saveErr)
          return { done: false, processed: processedThisInvocation, cursor: cursorBeforePage }
        }
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}
