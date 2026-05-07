import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const status = req.nextUrl.searchParams.get("status") || "all"
  const intent = req.nextUrl.searchParams.get("intent")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status === "unread") where.status = "unread"
  else if (status === "archived") where.status = "archived"
  if (intent) where.intent = intent

  // Get latest message per fromNumber (conversation grouping)
  const messages = await prisma.inboundMessage.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: 200,
    include: {
      client: {
        select: {
          id: true, firstName: true, lastName: true, phone: true,
          vipTier: true, valueTier: true, lifetimeSpend: true, lastVisitAt: true,
        },
      },
    },
  })

  // Group by fromNumber, take latest message per conversation
  const convMap = new Map<string, typeof messages[0]>()
  for (const m of messages) {
    if (!convMap.has(m.fromNumber)) convMap.set(m.fromNumber, m)
  }

  const conversations = Array.from(convMap.values())
  return NextResponse.json({ conversations })
}
