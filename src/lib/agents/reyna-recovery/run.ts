/**
 * Main runner for the Reyna Recovery agent.
 * Called by daily cron + manual trigger from UI.
 */

import type { AgentRunResult } from "../types"
import { selectCandidates } from "./select-candidates"
import { generateMessage, getOfferForTier, resolveStaffName } from "./generate-message"

const DEFAULT_CONFIG = {
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
  } as Record<string, string>,
}

export async function runReynaRecovery(): Promise<AgentRunResult> {
  const { prisma } = await import("@/lib/prisma")

  // Find or create Agent record
  let agent = await prisma.agent.findUnique({ where: { name: "reyna_recovery" } })
  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        name: "reyna_recovery",
        displayName: "Reyna Recovery",
        description: "Identifies high-value lapsed clients and drafts personalized recovery SMS for owner approval.",
        status: "active",
        config: DEFAULT_CONFIG,
        schedule: "0 10 * * *",
      },
    })
  }

  const config = { ...DEFAULT_CONFIG, ...(agent.config as Record<string, unknown>) }
  const offerByValueTier = (config.offerByValueTier || DEFAULT_CONFIG.offerByValueTier) as Record<string, string>

  // Create AgentRun
  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      status: "running",
    },
  })

  const errors: string[] = []
  let draftsCreated = 0

  try {
    // Select candidates
    const candidates = await selectCandidates({
      dailyDraftCap: (config.dailyDraftCap as number) || 30,
      antiSpamDays: (config.antiSpamDays as number) || 30,
      targetTiers: (config.targetTiers as string[]) || DEFAULT_CONFIG.targetTiers,
      targetValueTiers: (config.targetValueTiers as string[]) || DEFAULT_CONFIG.targetValueTiers,
    })

    // Compute proposed send time: tomorrow at configured hour
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours((config.proposedSendHour as number) || 9, (config.proposedSendMinute as number) || 30, 0, 0)

    // Generate drafts for each candidate
    for (const candidate of candidates) {
      try {
        const staffName = await resolveStaffName(candidate.favoriteStaffMemberId)
        const offer = getOfferForTier(candidate.valueTier || "AVERAGE", offerByValueTier)
        const daysSince = candidate.lastVisitAt
          ? Math.floor((Date.now() - candidate.lastVisitAt.getTime()) / 86400000)
          : 999

        const messageBody = await generateMessage({
          firstName: candidate.firstName || "Friend",
          daysSinceLastVisit: daysSince,
          favoriteServiceCategory: candidate.favoriteServiceCategory,
          favoriteStaffName: staffName,
          valueTier: candidate.valueTier || "AVERAGE",
          vipTier: candidate.vipTier || "LAPSED",
          proposedOffer: offer,
        })

        const reasoning = [
          `${candidate.vipTier} + ${candidate.valueTier}`,
          `last visit ${daysSince} days ago`,
          `churn risk ${candidate.churnRiskScore?.toFixed(2) || "N/A"}`,
          `$${candidate.lifetimeSpend.toFixed(0)} lifetime spend`,
          `${candidate.totalVisits} visits`,
          staffName ? `prefers ${staffName}` : null,
        ].filter(Boolean).join(", ")

        await prisma.agentDraft.create({
          data: {
            agentId: agent.id,
            runId: run.id,
            clientId: candidate.id,
            reasoning,
            priority: candidate.priority,
            channel: "sms",
            messageBody,
            proposedOffer: offer,
            proposedSendAt: tomorrow,
            status: "pending",
          },
        })

        draftsCreated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Client ${candidate.id}: ${msg}`)
      }
    }

    // Update run
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        candidatesEvaluated: candidates.length,
        draftsCreated,
        errorsEncountered: errors.length,
        errorMessage: errors.length > 0 ? errors.join("\n") : null,
      },
    })

    // Update agent stats
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        totalRuns: { increment: 1 },
        totalDrafted: { increment: draftsCreated },
        lastRunAt: new Date(),
      },
    })

    return { candidatesEvaluated: candidates.length, draftsCreated, errors }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: msg },
    })
    return { candidatesEvaluated: 0, draftsCreated: 0, errors: [msg] }
  }
}
