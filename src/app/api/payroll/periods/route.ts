import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as Record<string, unknown>
  if (user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const periods = await prisma.payrollPeriod.findMany({
    orderBy: { startDate: "desc" },
    include: { markedBy: { select: { name: true } }, location: { select: { name: true } } },
  })

  return NextResponse.json({ periods })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as Record<string, unknown>
  if (user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { start, end, locationId } = await req.json()
  if (!start || !end) return NextResponse.json({ error: "start and end required" }, { status: 400 })

  const startDate = new Date(`${start}T00:00:00-06:00`)
  const endDate = new Date(`${end}T23:59:59-06:00`)

  // Upsert — find existing period with same dates or create new
  const existing = await prisma.payrollPeriod.findFirst({
    where: { startDate, endDate },
  })

  if (existing) {
    const updated = await prisma.payrollPeriod.update({
      where: { id: existing.id },
      data: { markedPaidAt: new Date(), markedPaidBy: user.id as string },
    })
    logAction({ action: AUDIT_ACTIONS.PAYROLL_MARKED_PAID, entity: "PayrollPeriod", entityId: updated.id, userId: user.id as string, userEmail: user.email as string, userRole: user.role as string, metadata: { start, end } })
    return NextResponse.json({ period: updated })
  }

  const period = await prisma.payrollPeriod.create({
    data: {
      startDate,
      endDate,
      locationId: locationId || null,
      markedPaidAt: new Date(),
      markedPaidBy: user.id as string,
    },
  })

  logAction({ action: AUDIT_ACTIONS.PAYROLL_MARKED_PAID, entity: "PayrollPeriod", entityId: period.id, userId: user.id as string, userEmail: user.email as string, userRole: user.role as string, metadata: { start, end } })
  return NextResponse.json({ period })
}
