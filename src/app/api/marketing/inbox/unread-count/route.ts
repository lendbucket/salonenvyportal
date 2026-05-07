import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const revalidate = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ count: 0 })

  const { prisma } = await import("@/lib/prisma")
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)

  const count = await prisma.inboundMessage.count({
    where: { status: "unread", receivedAt: { gte: thirtyDaysAgo } },
  })

  return NextResponse.json({ count })
}
