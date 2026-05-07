import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")

  const agent = await prisma.agent.findUnique({ where: { name: "reyna_recovery" } })
  if (!agent) return NextResponse.json({ agent: null, drafts: [], runs: [] })

  const drafts = await prisma.agentDraft.findMany({
    where: { agentId: agent.id },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      client: {
        select: {
          id: true, firstName: true, lastName: true, phone: true,
          vipTier: true, valueTier: true, lifetimeSpend: true,
          lastVisitAt: true, totalVisits: true,
        },
      },
    },
  })

  const runs = await prisma.agentRun.findMany({
    where: { agentId: agent.id },
    orderBy: { startedAt: "desc" },
    take: 10,
  })

  // Weekly stats
  const weekAgo = new Date(Date.now() - 7 * 86400000)
  const weeklyApproved = await prisma.agentDraft.count({ where: { agentId: agent.id, status: "approved", reviewedAt: { gte: weekAgo } } })
  const weeklySent = await prisma.agentDraft.count({ where: { agentId: agent.id, status: "sent", sentAt: { gte: weekAgo } } })
  const weeklyConverted = await prisma.agentDraft.count({ where: { agentId: agent.id, status: "converted", convertedAt: { gte: weekAgo } } })
  const pendingCount = await prisma.agentDraft.count({ where: { agentId: agent.id, status: "pending" } })

  return NextResponse.json({ agent, drafts, runs, stats: { pendingCount, weeklyApproved, weeklySent, weeklyConverted } })
}
