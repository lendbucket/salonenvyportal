import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ fromNumber: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const { fromNumber } = await params
  const decoded = decodeURIComponent(fromNumber)

  await prisma.blockedNumber.upsert({
    where: { phoneNumber: decoded },
    create: { phoneNumber: decoded, blockedById: userId, reason: "Blocked from inbox" },
    update: {},
  })

  // Archive all messages from this number
  await prisma.inboundMessage.updateMany({
    where: { fromNumber: decoded },
    data: { isFromBlockedNumber: true, status: "archived" },
  })

  return NextResponse.json({ success: true })
}
