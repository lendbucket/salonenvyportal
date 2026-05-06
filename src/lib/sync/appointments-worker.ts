import { PrismaClient } from "@prisma/client"

const SOFT_DEADLINE_MS = 35_000
const SQ_BASE = "https://connect.squareup.com/v2"
const LOCATIONS = ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"]
const MONTHS_BACK = 24

interface CursorState {
  monthOffset: number
  locationCursors: Record<string, string | null>
  completedMonths: number[]
}

export async function processAppointmentsSyncBatch(jobId: string): Promise<{ done: boolean; processed: number; cursor: CursorState | null }> {
  const prisma = new PrismaClient()
  const startTime = Date.now()

  try {
    const job = await prisma.syncJob.findUnique({ where: { id: jobId } })
    if (!job || job.status !== "running") return { done: true, processed: 0, cursor: null }

    await prisma.syncJob.update({ where: { id: jobId }, data: { lastTickAt: new Date() } })

    const cursorState: CursorState = job.cursor ? JSON.parse(job.cursor) : { monthOffset: 0, locationCursors: { LTJSA6QR1HGW6: null, LXJYXDXWR0XZF: null }, completedMonths: [] }
    let processedThisInvocation = 0
    let pagesThisInvocation = 0

    while (true) {
      if (Date.now() - startTime > SOFT_DEADLINE_MS) {
        await prisma.syncJob.update({ where: { id: jobId }, data: { cursor: JSON.stringify(cursorState), totalProcessed: { increment: processedThisInvocation }, pagesProcessed: { increment: pagesThisInvocation }, lastTickAt: new Date() } })
        return { done: false, processed: processedThisInvocation, cursor: cursorState }
      }

      if (cursorState.monthOffset >= MONTHS_BACK) {
        await prisma.syncJob.update({ where: { id: jobId }, data: { status: "completed", cursor: null, totalProcessed: { increment: processedThisInvocation }, pagesProcessed: { increment: pagesThisInvocation }, lastTickAt: new Date(), completedAt: new Date() } })
        return { done: true, processed: processedThisInvocation, cursor: null }
      }

      const now = new Date()
      const endOfRange = new Date(now.getFullYear(), now.getMonth() - cursorState.monthOffset + 1, 0, 23, 59, 59)
      const startOfRange = new Date(now.getFullYear(), now.getMonth() - cursorState.monthOffset, 1, 0, 0, 0)

      try {
        for (const locationId of LOCATIONS) {
          if (Date.now() - startTime > SOFT_DEADLINE_MS) break

          const locCursor = cursorState.locationCursors[locationId]
          if (locCursor === "DONE") continue

          const url = new URL(`${SQ_BASE}/bookings`)
          url.searchParams.set("location_id", locationId)
          url.searchParams.set("start_at_min", startOfRange.toISOString())
          url.searchParams.set("start_at_max", endOfRange.toISOString())
          url.searchParams.set("limit", "100")
          if (locCursor) url.searchParams.set("cursor", locCursor)

          const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
              "Square-Version": "2025-04-16",
              "Content-Type": "application/json",
            },
          })
          if (!res.ok) throw new Error(`Square Bookings API ${res.status}: ${(await res.text()).slice(0, 200)}`)

          const data = await res.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bookings: any[] = data.bookings || []
          const nextCursor: string | null = data.cursor || null

          // Upsert bookings in chunks of 25
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ops: any[] = []
          for (const b of bookings) {
            let clientId: string | null = null
            if (b.customer_id) {
              const c = await prisma.client.findUnique({ where: { squareCustomerId: b.customer_id }, select: { id: true } })
              clientId = c?.id ?? null
            }

            const segment = b.appointment_segments?.[0]
            const squareTeamMemberId = segment?.team_member_id || null
            const durationMinutes = segment?.duration_minutes || null
            const serviceVariationIds = b.appointment_segments?.map((s: { service_variation_id?: string }) => s.service_variation_id).filter(Boolean) || []

            // Lookup staffMemberId from squareTeamMemberId
            let staffMemberId: string | null = null
            if (squareTeamMemberId) {
              const staff = await prisma.staffMember.findFirst({ where: { squareTeamMemberId }, select: { id: true } })
              staffMemberId = staff?.id ?? null
            }

            ops.push(prisma.squareAppointment.upsert({
              where: { squareBookingId: b.id },
              create: {
                squareBookingId: b.id,
                squareLocationId: b.location_id || locationId,
                squareCustomerId: b.customer_id || null,
                clientId,
                squareTeamMemberId,
                staffMemberId,
                status: b.status,
                startAt: new Date(b.start_at),
                durationMinutes,
                serviceVariationIds: serviceVariationIds.length > 0 ? serviceVariationIds : undefined,
                customerNote: b.customer_note || null,
                sellerNote: b.seller_note || null,
                source: b.source || null,
                createdAtSquare: new Date(b.created_at),
                updatedAtSquare: new Date(b.updated_at),
              },
              update: {
                clientId,
                squareTeamMemberId,
                staffMemberId,
                status: b.status,
                startAt: new Date(b.start_at),
                durationMinutes,
                serviceVariationIds: serviceVariationIds.length > 0 ? serviceVariationIds : undefined,
                customerNote: b.customer_note || null,
                sellerNote: b.seller_note || null,
                updatedAtSquare: new Date(b.updated_at),
                syncedAt: new Date(),
              },
            }))
          }
          for (let i = 0; i < ops.length; i += 25) await prisma.$transaction(ops.slice(i, i + 25))

          processedThisInvocation += bookings.length
          pagesThisInvocation += 1
          cursorState.locationCursors[locationId] = nextCursor ? nextCursor : "DONE"
        }

        const allDone = Object.values(cursorState.locationCursors).every(c => c === "DONE")
        if (allDone) {
          cursorState.completedMonths.push(cursorState.monthOffset)
          cursorState.monthOffset += 1
          cursorState.locationCursors = { LTJSA6QR1HGW6: null, LXJYXDXWR0XZF: null }
        }

        // Checkpoint
        await prisma.syncJob.update({ where: { id: jobId }, data: { cursor: JSON.stringify(cursorState), totalProcessed: { increment: processedThisInvocation }, pagesProcessed: { increment: pagesThisInvocation }, lastTickAt: new Date() } })
        processedThisInvocation = 0; pagesThisInvocation = 0

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const code = (err as { code?: string }).code
        const isTransient = code === "P1001" || code === "P1008" || code === "P2021" || msg.includes("Square Bookings API 5")
        console.error("[appointments-sync] Error:", msg)
        try {
          const currentJob = await prisma.syncJob.findUnique({ where: { id: jobId }, select: { errorCount: true } })
          const newErr = (currentJob?.errorCount || 0) + 1
          await prisma.syncJob.update({ where: { id: jobId }, data: { cursor: JSON.stringify(cursorState), totalProcessed: { increment: processedThisInvocation }, pagesProcessed: { increment: pagesThisInvocation }, lastTickAt: new Date(), errorCount: newErr, errorMessage: msg.slice(0, 500), status: !isTransient && newErr >= 5 ? "failed" : "running" } })
        } catch { /* bail */ }
        return { done: false, processed: processedThisInvocation, cursor: cursorState }
      }
    }
  } finally { await prisma.$disconnect() }
}
