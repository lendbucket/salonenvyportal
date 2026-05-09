import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // KILL SWITCH — set PORTAL_KILL_SWITCH=true in Vercel env vars to disable
  if (process.env.PORTAL_KILL_SWITCH === "true") {
    return NextResponse.json({ disabled: true, reason: "kill_switch_active" }, { status: 200 })
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()

  try {
    // Seed agent if it doesn't exist (first-run auto-seed)
    let agent = await prisma.agent.findUnique({ where: { name: "reyna_recovery" } })
    if (!agent) {
      agent = await prisma.agent.create({
        data: {
          name: "reyna_recovery",
          displayName: "Reyna Recovery",
          description: "Identifies high-value lapsed clients and drafts personalized recovery SMS for owner approval.",
          status: "paused",
          config: {
            dailyDraftCap: 30,
            proposedSendHour: 9,
            proposedSendMinute: 30,
            antiSpamDays: 30,
            targetTiers: ["AT_RISK", "LAPSED", "DEAD"],
            targetValueTiers: ["BIG_SPENDER", "VALUABLE", "AVERAGE"],
            offerByValueTier: {
              BIG_SPENDER: "20% off any service this week",
              VALUABLE: "15% off your next service",
              AVERAGE: "10% off your next visit",
            },
          },
          schedule: "0 10 * * *",
        },
      })
      return NextResponse.json({ ok: true, seeded: true, status: "paused" })
    }

    // Fast-exit if agent is paused or suspended
    if (agent.status !== "active") {
      return NextResponse.json({ ok: true, idle: true, status: agent.status })
    }

    // Run the agent
    const { runReynaRecovery } = await import("@/lib/agents/reyna-recovery/run")
    const result = await runReynaRecovery()
    return NextResponse.json({ ok: true, ...result })
  } finally {
    await prisma.$disconnect()
  }
}
