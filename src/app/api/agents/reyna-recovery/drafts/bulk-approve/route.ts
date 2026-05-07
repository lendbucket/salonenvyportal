import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const body = await req.json()

  // Support: { ids: string[] } or { maxPriority: number } or { all: true }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { status: "pending", agent: { name: "reyna_recovery" } }

  if (body.ids && Array.isArray(body.ids)) {
    where.id = { in: body.ids }
  } else if (body.maxPriority) {
    where.priority = { lte: body.maxPriority }
  }
  // If body.all === true, approve all pending (where stays as-is)

  const result = await prisma.agentDraft.updateMany({
    where,
    data: { status: "approved", reviewedById: userId, reviewedAt: new Date() },
  })

  // Update agent counter
  if (result.count > 0) {
    const agent = await prisma.agent.findUnique({ where: { name: "reyna_recovery" } })
    if (agent) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { totalApproved: { increment: result.count } },
      })
    }
  }

  return NextResponse.json({ approved: result.count })
}
