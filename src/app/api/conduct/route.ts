import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string

  // Stylists can only see their own records
  if (role === "STYLIST") {
    const staffMember = await prisma.staffMember.findUnique({ where: { userId } })
    if (!staffMember) return NextResponse.json({ records: [] })

    const records = await prisma.conductRecord.findMany({
      where: { staffMemberId: staffMember.id },
      include: { staffMember: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ records })
  }

  // Managers see their location, owners see all
  const locationId = (session.user as any).locationId as string | undefined
  const where = role === "MANAGER" && locationId
    ? { staffMember: { locationId } }
    : {}

  const records = await prisma.conductRecord.findMany({
    where,
    include: { staffMember: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ records })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { staffMemberId, severity, category, title, description, actionTaken, followUpDate } = body
  if (!staffMemberId || !severity || !category || !title || !description) {
    return NextResponse.json({ error: "staffMemberId, severity, category, title, and description are required" }, { status: 400 })
  }

  const userId = (session.user as any).id as string

  const record = await prisma.conductRecord.create({
    data: {
      staffMemberId,
      issuedById: userId,
      severity,
      category,
      title,
      description,
      actionTaken: actionTaken || null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
    include: { staffMember: true },
  })

  logAction({ action: AUDIT_ACTIONS.CONDUCT_RECORD_CREATED, entity: "ConductRecord", entityId: record.id, userId })
  return NextResponse.json({ record }, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { id } = body
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const record = await prisma.conductRecord.update({
    where: { id },
    data: {
      isAcknowledged: true,
      acknowledgedAt: new Date(),
    },
    include: { staffMember: true },
  })

  return NextResponse.json({ record })
}
