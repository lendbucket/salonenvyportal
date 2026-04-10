import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const locationId = req.nextUrl.searchParams.get("locationId") || "CC"
  const entries = await prisma.waitlistEntry.findMany({
    where: { locationId, status: { in: ["waiting", "contacted"] } },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const entry = await prisma.waitlistEntry.create({
    data: {
      locationId: body.locationId || "CC",
      customerName: body.customerName,
      customerPhone: body.customerPhone || "",
      customerEmail: body.customerEmail || null,
      requestedDate: body.requestedDate ? new Date(body.requestedDate) : new Date(),
      requestedStylist: body.requestedStylist || null,
      requestedService: body.requestedService || null,
      notes: body.notes || null,
      status: "waiting",
    },
  })
  return NextResponse.json({ entry })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const entry = await prisma.waitlistEntry.update({
    where: { id: body.id },
    data: { status: body.status, updatedAt: new Date() },
  })
  return NextResponse.json({ entry })
}
