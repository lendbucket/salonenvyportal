import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"
import { CC_LOCATION_ID, SA_LOCATION_ID } from "@/lib/staff"

export const maxDuration = 60

function getSquare() {
  return new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production })
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return "***"
  return `${local[0]}***@${domain}`
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return `***-***-${digits.slice(-4)}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = session.user as Record<string, unknown>
  const role = user.role as string
  const search = req.nextUrl.searchParams.get("q") || ""
  const page = parseInt(req.nextUrl.searchParams.get("page") || "0")
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "200")

  try {
    // Fetch from local DB first (fast)
    const where = search ? {
      OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search } },
      ],
    } : {}

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { lastVisitAt: "desc" },
        skip: page * limit,
        take: limit,
        include: { formulas: { take: 1, orderBy: { createdAt: "desc" } } },
      }),
      prisma.client.count({ where }),
    ])

    const isStylist = role === "STYLIST"
    const result = clients.map(c => ({
      id: c.id,
      squareCustomerId: c.squareCustomerId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: isStylist && c.email ? maskEmail(c.email) : c.email,
      phone: isStylist && c.phone ? maskPhone(c.phone) : c.phone,
      totalVisits: c.totalVisits,
      totalSpend: c.totalSpend,
      lastVisitAt: c.lastVisitAt,
      firstVisitAt: c.firstVisitAt,
      hasFormula: c.formulas.length > 0,
      cardOnFile: c.cardOnFile,
    }))

    const totalPages = Math.ceil(total / limit)
    return NextResponse.json({ clients: result, total, page, limit, totalPages, hasMore: (page + 1) * limit < total })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed", clients: [] }, { status: 500 })
  }
}
