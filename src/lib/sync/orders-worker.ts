import { PrismaClient } from "@prisma/client"

const SOFT_DEADLINE_MS = 35_000
const SQ_BASE = "https://connect.squareup.com/v2"
const LOCATIONS = ["LTJSA6QR1HGW6", "LXJYXDXWR0XZF"]
const MONTHS_BACK = 24

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cents2dollars(m: any): number { return m?.amount ? m.amount / 100 : 0 }

function categorizeService(name: string): string {
  const n = name.toLowerCase()
  if (n.includes("color") || n.includes("highlight") || n.includes("balayage") || n.includes("toner") || n.includes("gloss")) return "color"
  if (n.includes("cut") || n.includes("haircut") || n.includes("trim") || n.includes("style") || n.includes("blowout")) return "cut"
  if (n.includes("treatment") || n.includes("mask") || n.includes("keratin") || n.includes("botox") || n.includes("olaplex")) return "treatment"
  return "other"
}

interface CursorState {
  monthOffset: number
  locationCursors: Record<string, string | null>
  completedMonths: number[]
}

export async function processOrdersSyncBatch(jobId: string): Promise<{ done: boolean; processed: number; cursor: CursorState | null }> {
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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const searchBody: Record<string, any> = {
            location_ids: [locationId],
            query: { filter: { date_time_filter: { closed_at: { start_at: startOfRange.toISOString(), end_at: endOfRange.toISOString() } } }, sort: { sort_field: "CLOSED_AT", sort_order: "DESC" } },
            limit: 100,
          }
          if (locCursor) searchBody.cursor = locCursor

          const res = await fetch(`${SQ_BASE}/orders/search`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2025-04-16", "Content-Type": "application/json" }, body: JSON.stringify(searchBody) })
          if (!res.ok) throw new Error(`Square Orders API ${res.status}: ${(await res.text()).slice(0, 200)}`)

          const data = await res.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orders: any[] = data.orders || []
          const nextCursor: string | null = data.cursor || null

          // Upsert orders in chunks
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ops: any[] = []
          for (const o of orders) {
            let clientId: string | null = null
            if (o.customer_id) {
              const c = await prisma.client.findUnique({ where: { squareCustomerId: o.customer_id }, select: { id: true } })
              clientId = c?.id ?? null
            }
            ops.push(prisma.squareOrder.upsert({
              where: { squareOrderId: o.id },
              create: { squareOrderId: o.id, squareLocationId: o.location_id, squareCustomerId: o.customer_id || null, clientId, state: o.state, source: o.source?.name || null, totalAmount: cents2dollars(o.total_money), totalTaxAmount: cents2dollars(o.total_tax_money), totalTipAmount: cents2dollars(o.total_tip_money), totalDiscountAmount: cents2dollars(o.total_discount_money), totalServiceCharge: cents2dollars(o.total_service_charge_money), netAmountDue: cents2dollars(o.net_amount_due_money), closedAt: o.closed_at ? new Date(o.closed_at) : null, createdAtSquare: new Date(o.created_at), updatedAtSquare: new Date(o.updated_at) },
              update: { clientId, state: o.state, totalAmount: cents2dollars(o.total_money), totalTaxAmount: cents2dollars(o.total_tax_money), totalTipAmount: cents2dollars(o.total_tip_money), totalDiscountAmount: cents2dollars(o.total_discount_money), closedAt: o.closed_at ? new Date(o.closed_at) : null, updatedAtSquare: new Date(o.updated_at), syncedAt: new Date() },
            }))
          }
          for (let i = 0; i < ops.length; i += 25) await prisma.$transaction(ops.slice(i, i + 25))

          // Upsert line items
          for (const o of orders) {
            if (!o.line_items?.length) continue
            const dbOrder = await prisma.squareOrder.findUnique({ where: { squareOrderId: o.id }, select: { id: true } })
            if (!dbOrder) continue
            await prisma.orderLineItem.deleteMany({ where: { orderId: dbOrder.id } })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const liOps: any[] = []
            for (const li of o.line_items) {
              liOps.push(prisma.orderLineItem.create({ data: { orderId: dbOrder.id, squareCatalogObjectId: li.catalog_object_id || null, squareCategoryId: li.category_id || null, name: li.name || "Unnamed", variationName: li.variation_name || null, quantity: parseInt(li.quantity || "1", 10), basePriceAmount: cents2dollars(li.base_price_money), totalPriceAmount: cents2dollars(li.total_money), totalDiscountAmount: cents2dollars(li.total_discount_money), totalTaxAmount: cents2dollars(li.total_tax_money), serviceCategory: categorizeService(li.name || ""), squareTeamMemberId: null } }))
            }
            for (let i = 0; i < liOps.length; i += 25) await prisma.$transaction(liOps.slice(i, i + 25))
          }

          processedThisInvocation += orders.length
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
        const isTransient = code === "P1001" || code === "P1008" || code === "P2021" || msg.includes("Square Orders API 5")
        console.error("[orders-sync] Error:", msg)
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
