import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const q = req.nextUrl.searchParams.get("q")?.trim() || ""
  if (q.length < 2) return NextResponse.json({ clients: [] })

  const { prisma } = await import("@/lib/prisma")

  const clients = await prisma.client.findMany({
    where: {
      smsMarketingConsent: true,
      smsOptedOutAt: null,
      phone: { not: null },
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, lastVisitAt: true, smsLastEngagedAt: true },
    orderBy: [{ smsLastEngagedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 20,
  })

  return NextResponse.json({ clients })
}
