import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q") || ""
  if (q.length < 2) return NextResponse.json({ clients: [] })

  try {
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      orderBy: { lastVisitAt: "desc" },
    })

    return NextResponse.json({
      clients: clients.map(c => ({
        id: c.id,
        squareCustomerId: c.squareCustomerId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        cardOnFile: c.cardOnFile,
        totalVisits: c.totalVisits,
        lastVisitAt: c.lastVisitAt,
      })),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed", clients: [] }, { status: 500 })
  }
}
