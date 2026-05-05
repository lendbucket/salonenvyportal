import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

export type StylistContext = {
  userId: string
  staffMemberId: string
  squareTeamMemberId: string | null
  locationId: string
  fullName: string
  email: string | null
}

export async function getStylistContext(): Promise<StylistContext | null> {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const user = session.user as Record<string, unknown> | undefined
  if (!user) return null
  if (user.role !== "STYLIST") return null

  const userId = user.id as string

  const { prisma } = await import("@/lib/prisma")
  const staffMember = await prisma.staffMember.findFirst({
    where: { userId },
  })
  if (!staffMember) return null

  return {
    userId,
    staffMemberId: staffMember.id,
    squareTeamMemberId: staffMember.squareTeamMemberId,
    locationId: staffMember.locationId,
    fullName: staffMember.fullName,
    email: staffMember.email,
  }
}

export async function requireStylistContext(): Promise<StylistContext> {
  const ctx = await getStylistContext()
  if (!ctx) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return ctx
}
