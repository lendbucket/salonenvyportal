import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateSystemAlerts } from "@/lib/alertEngine"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as Record<string, unknown>
  const userId = user.id as string
  const role = user.role as string
  const userLocationId = user.locationId as string | undefined

  // Refresh system alerts
  await generateSystemAlerts()

  // Build where clause based on role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (role !== "OWNER") {
    where.OR = [{ locationId: null }, ...(userLocationId ? [{ locationId: userLocationId }] : [])]
  }
  // Filter out expired alerts
  where.OR = where.OR
    ? [{ AND: [{ OR: where.OR }, { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] }]
    : undefined
  if (!where.OR) {
    where.AND = [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }]
  }

  const alerts = await prisma.adminAlert.findMany({
    where: role !== "OWNER"
      ? { AND: [{ OR: [{ locationId: null }, ...(userLocationId ? [{ locationId: userLocationId }] : [])] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] }
      : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: {
      location: { select: { name: true } },
      createdBy: { select: { name: true } },
      reads: { select: { userId: true } },
      _count: { select: { reads: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  // Get total staff count for read percentages
  const totalStaff = await prisma.staffMember.count({ where: { isActive: true } })

  const enriched = alerts.map(a => ({
    id: a.id,
    type: a.type,
    title: a.title,
    body: a.body,
    severity: a.severity,
    locationName: a.location?.name || null,
    locationId: a.locationId,
    createdByName: a.createdBy?.name || null,
    expiresAt: a.expiresAt,
    createdAt: a.createdAt,
    readCount: a._count.reads,
    totalStaff,
    isRead: a.reads.some(r => r.userId === userId),
  }))

  const unreadCount = enriched.filter(a => !a.isRead).length

  return NextResponse.json({ alerts: enriched, unreadCount })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as Record<string, unknown>
  const role = user.role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { title, body, severity, locationId, expiresAt } = await req.json()
  if (!title || !body) return NextResponse.json({ error: "Title and body required" }, { status: 400 })

  const alert = await prisma.adminAlert.create({
    data: {
      type: "broadcast",
      title,
      body,
      severity: severity || "info",
      locationId: locationId || null,
      createdById: user.id as string,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  })

  logAction({ action: AUDIT_ACTIONS.ALERT_CREATED, entity: "AdminAlert", entityId: alert.id, userId: user.id as string, userEmail: user.email as string, userRole: role, metadata: { title, severity, locationId } })
  return NextResponse.json({ alert })
}
