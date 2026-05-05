const BATCH_SIZE = 100
const UPSERT_CHUNK = 25
const SOFT_DEADLINE_MS = 50_000 // 50s — leaves 10s headroom under Vercel's 60s
const MAX_ERRORS = 5
const SQ = "https://connect.squareup.com/v2"

async function sqGet(path: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${SQ}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-04-16",
    },
  })
  return r.json() as Promise<Record<string, unknown>>
}

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
  const { prisma } = await import("@/lib/prisma")
  const startTime = Date.now()

  const job = await prisma.syncJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== "running") {
    return { done: true, processed: 0, cursor: null }
  }

  await prisma.syncJob.update({ where: { id: jobId }, data: { lastTickAt: new Date() } })

  let currentCursor: string | null = job.cursor
  let totalProcessed = job.totalProcessed
  let pagesProcessed = job.pagesProcessed
  let errorCount = job.errorCount

  while (true) {
    // Check soft deadline before fetching next page
    if (Date.now() - startTime > SOFT_DEADLINE_MS) {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { cursor: currentCursor, totalProcessed, pagesProcessed, lastTickAt: new Date() },
      })
      return { done: false, processed: totalProcessed - job.totalProcessed, cursor: currentCursor }
    }

    try {
      // Fetch one page using raw REST API with explicit cursor
      let url = `/customers?limit=${BATCH_SIZE}`
      if (currentCursor) url += `&cursor=${encodeURIComponent(currentCursor)}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await sqGet(url) as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customers: any[] = response.customers || []
      const nextCursor: string | null = response.cursor || null
      const now = new Date()

      // Batch upserts in chunks
      for (let i = 0; i < customers.length; i += UPSERT_CHUNK) {
        const chunk = customers.slice(i, i + UPSERT_CHUNK)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const operations: any[] = []

        for (const c of chunk) {
          if (!c.id) continue
          const addr = c.address
          const data = {
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
              create: {
                ...data,
                createdAt: c.created_at ? new Date(c.created_at) : now,
              },
              update: data,
            })
          )
        }

        if (operations.length > 0) {
          await prisma.$transaction(operations)
        }
      }

      totalProcessed += customers.length
      pagesProcessed += 1
      currentCursor = nextCursor

      if (!currentCursor) {
        // Sync complete
        await prisma.syncJob.update({
          where: { id: jobId },
          data: { status: "completed", completedAt: new Date(), totalProcessed, pagesProcessed, cursor: null, lastTickAt: new Date() },
        })
        return { done: true, processed: totalProcessed - job.totalProcessed, cursor: null }
      }

      // Save checkpoint after each page
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { cursor: currentCursor, totalProcessed, pagesProcessed, lastTickAt: new Date() },
      })

    } catch (err: unknown) {
      errorCount++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[clients-sync] Error on page ${pagesProcessed + 1}: ${msg}`)

      if (errorCount >= MAX_ERRORS) {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: { status: "failed", errorMessage: msg, errorCount, lastTickAt: new Date() },
        })
        return { done: true, processed: totalProcessed - job.totalProcessed, cursor: currentCursor }
      }

      // Save state and let cron retry next minute
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { errorCount, errorMessage: msg, cursor: currentCursor, totalProcessed, pagesProcessed, lastTickAt: new Date() },
      })
      return { done: false, processed: totalProcessed - job.totalProcessed, cursor: currentCursor }
    }
  }
}
