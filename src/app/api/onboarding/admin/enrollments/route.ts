import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const status = req.nextUrl.searchParams.get("status")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status && status !== "all") where.status = status

  const enrollments = await prisma.onboardingEnrollment.findMany({
    where,
    include: { location: true },
    orderBy: { createdAt: "desc" },
  })

  const pendingCount = await prisma.onboardingEnrollment.count({ where: { status: { in: ["pending_review", "signed"] } } })

  return NextResponse.json({ enrollments, pendingCount })
}
