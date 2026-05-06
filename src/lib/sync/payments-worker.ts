import { PrismaClient } from "@prisma/client"

const SOFT_DEADLINE_MS = 25_000
const SQ_BASE = "https://connect.squareup.com/v2"
const LOCATIONS = ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"]
const MONTHS_BACK = 24

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cents2dollars(m: any): number { return m?.amount ? m.amount / 100 : 0 }

function pastDeadline(startTime: number): boolean { return Date.now() - startTime > SOFT_DEADLINE_MS }

interface CursorState {
  monthOffset: number
  locationCursors: Record<string, string | null>
  completedMonths: number[]
}

export async function processPaymentsSyncBatch(jobId: string): Promise<{ done: boolean; processed: number; cursor: CursorState | null }> {
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
      if (pastDeadline(startTime)) {
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
          if (pastDeadline(startTime)) break

          const locCursor = cursorState.locationCursors[locationId]
          if (locCursor === "DONE") continue

          const params = new URLSearchParams({
            location_id: locationId,
            begin_time: startOfRange.toISOString(),
            end_time: endOfRange.toISOString(),
            limit: "100",
          })
          if (locCursor) params.set("cursor", locCursor)

          const res = await fetch(`${SQ_BASE}/payments?${params.toString()}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
              "Square-Version": "2024-12-18",
              "Content-Type": "application/json",
            },
          })
          if (!res.ok) throw new Error(`Square Payments API ${res.status}: ${(await res.text()).slice(0, 200)}`)

          const data = await res.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payments: any[] = data.payments || []
          const nextCursor: string | null = data.cursor || null

          // Deadline check after fetch
          if (pastDeadline(startTime)) break

          // Upsert payments in chunks of 25
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ops: any[] = []
          for (const p of payments) {
            if (pastDeadline(startTime)) break

            // Lookup clientId from squareCustomerId
            let clientId: string | null = null
            if (p.customer_id) {
              const c = await prisma.client.findUnique({ where: { squareCustomerId: p.customer_id }, select: { id: true } })
              clientId = c?.id ?? null
            }

            // Lookup staffMemberId from employee_id or team_member_id
            let staffMemberId: string | null = null
            const empId = p.employee_id || p.team_member_id || null
            if (empId) {
              const sm = await prisma.staffMember.findUnique({ where: { squareTeamMemberId: empId }, select: { id: true } })
              staffMemberId = sm?.id ?? null
            }

            ops.push(prisma.squarePayment.upsert({
              where: { squarePaymentId: p.id },
              create: {
                squarePaymentId: p.id,
                squareLocationId: p.location_id,
                squareCustomerId: p.customer_id || null,
                clientId,
                squareOrderId: p.order_id || null,
                amount: cents2dollars(p.amount_money),
                tipAmount: cents2dollars(p.tip_money),
                taxAmount: cents2dollars(p.tax_money),
                totalAmount: cents2dollars(p.total_money),
                refundedAmount: cents2dollars(p.refunded_money),
                sourceType: p.source_type || "UNKNOWN",
                cardBrand: p.card_details?.card?.card_brand || null,
                cardLast4: p.card_details?.card?.last_4 || null,
                cardEntryMethod: p.card_details?.entry_method || null,
                status: p.status,
                receiptNumber: p.receipt_number || null,
                receiptUrl: p.receipt_url || null,
                employeeId: empId,
                staffMemberId,
                createdAtSquare: new Date(p.created_at),
                updatedAtSquare: new Date(p.updated_at),
              },
              update: {
                clientId,
                squareOrderId: p.order_id || null,
                totalAmount: cents2dollars(p.total_money),
                tipAmount: cents2dollars(p.tip_money),
                refundedAmount: cents2dollars(p.refunded_money),
                status: p.status,
                staffMemberId,
                updatedAtSquare: new Date(p.updated_at),
                syncedAt: new Date(),
              },
            }))
          }
          for (let i = 0; i < ops.length; i += 25) {
            if (pastDeadline(startTime)) break
            await prisma.$transaction(ops.slice(i, i + 25))
          }

          processedThisInvocation += payments.length
          pagesThisInvocation += 1
          cursorState.locationCursors[locationId] = nextCursor ? nextCursor : "DONE"

          // Checkpoint after EACH successful Square page
          await prisma.syncJob.update({ where: { id: jobId }, data: { cursor: JSON.stringify(cursorState), totalProcessed: { increment: processedThisInvocation }, pagesProcessed: { increment: pagesThisInvocation }, lastTickAt: new Date() } })
          processedThisInvocation = 0
          pagesThisInvocation = 0
        }

        const allDone = Object.values(cursorState.locationCursors).every(c => c === "DONE")
        if (allDone) {
          cursorState.completedMonths.push(cursorState.monthOffset)
          cursorState.monthOffset += 1
          cursorState.locationCursors = { LTJSA6QR1HGW6: null, LXJYXDXWR0XZF: null }
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const code = (err as { code?: string }).code
        const isTransient = code === "P1001" || code === "P1008" || code === "P2021" || msg.includes("Square Payments API 5")
        console.error("[payments-sync] Error:", msg)
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
