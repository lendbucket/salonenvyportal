import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string

  let renewal = await prisma.tdlrLicenseRenewal.findUnique({ where: { userId } })
  if (!renewal) {
    renewal = await prisma.tdlrLicenseRenewal.create({
      data: { userId, ceHoursRequired: 8, ceHoursCompleted: 0 },
    })
  }
  return NextResponse.json({ renewal })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const body = await req.json()

  const renewal = await prisma.tdlrLicenseRenewal.upsert({
    where: { userId },
    update: { ...body, updatedAt: new Date() },
    create: { userId, ceHoursRequired: 8, ceHoursCompleted: 0, ...body },
  })
  return NextResponse.json({ renewal })
}
