import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, rejectionNote } = body
  const userId = session.user.id
  const userRole = session.user.role

  if (action === "submit") {
    const schedule = await prisma.schedule.update({
      where: { id },
      data: { status: "pending", submittedAt: new Date() },
    })
    return NextResponse.json({ schedule })
  }

  if (action === "approve" && userRole === "OWNER") {
    const schedule = await prisma.schedule.update({
      where: { id },
      data: { status: "approved", approvedAt: new Date(), approvedById: userId },
    })
    return NextResponse.json({ schedule })
  }

  if (action === "reject" && userRole === "OWNER") {
    const schedule = await prisma.schedule.update({
      where: { id },
      data: { status: "rejected", rejectedAt: new Date(), rejectionNote },
    })
    return NextResponse.json({ schedule })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.schedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
