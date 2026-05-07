/**
 * Select recovery candidates using the tier matrix.
 * Returns up to dailyDraftCap candidates ranked by priority.
 *
 * Priority matrix:
 * 1: AT_RISK + BIG_SPENDER
 * 2: LAPSED + BIG_SPENDER
 * 3: AT_RISK + VALUABLE
 * 4: DEAD + BIG_SPENDER
 * 5: LAPSED + VALUABLE
 * 6: AT_RISK + AVERAGE
 * 7: LAPSED + AVERAGE
 * 8: DEAD + VALUABLE
 *
 * Excludes: NEVER, ACTIVE, VIP, LOW_VALUE x DEAD, no phone, opted out, drafted in last N days
 */

interface CandidateRow {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  vipTier: string | null
  valueTier: string | null
  lifetimeSpend: number
  totalVisits: number
  lastVisitAt: Date | null
  daysBetweenVisits: number | null
  favoriteStaffMemberId: string | null
  favoriteServiceCategory: string | null
  churnRiskScore: number | null
  engagementScore: number | null
  priority: number
}

const TIER_MATRIX: [string, string, number][] = [
  ["AT_RISK", "BIG_SPENDER", 1],
  ["LAPSED", "BIG_SPENDER", 2],
  ["AT_RISK", "VALUABLE", 3],
  ["DEAD", "BIG_SPENDER", 4],
  ["LAPSED", "VALUABLE", 5],
  ["AT_RISK", "AVERAGE", 6],
  ["LAPSED", "AVERAGE", 7],
  ["DEAD", "VALUABLE", 8],
]

export async function selectCandidates(config: {
  dailyDraftCap: number
  antiSpamDays: number
  targetTiers: string[]
  targetValueTiers: string[]
}): Promise<CandidateRow[]> {
  const { prisma } = await import("@/lib/prisma")

  // Build the tier combinations to target
  const validCombos = TIER_MATRIX.filter(
    ([vip, val]) => config.targetTiers.includes(vip) && config.targetValueTiers.includes(val),
  )

  if (validCombos.length === 0) return []

  // Get recently-drafted client IDs to exclude (anti-spam)
  const recentCutoff = new Date(Date.now() - config.antiSpamDays * 86400000)
  const recentDrafts = await prisma.agentDraft.findMany({
    where: {
      agentId: { not: undefined },
      createdAt: { gte: recentCutoff },
    },
    select: { clientId: true },
    distinct: ["clientId"],
  })
  const excludeClientIds = new Set(recentDrafts.map(d => d.clientId))

  // Query eligible clients matching ANY of the tier combinations
  const vipTiers = [...new Set(validCombos.map(c => c[0]))]
  const valueTiers = [...new Set(validCombos.map(c => c[1]))]

  const clients = await prisma.client.findMany({
    where: {
      vipTier: { in: vipTiers },
      valueTier: { in: valueTiers },
      phone: { not: null },
      smsMarketingConsent: true,
      smsOptedOutAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      vipTier: true,
      valueTier: true,
      lifetimeSpend: true,
      totalVisits: true,
      lastVisitAt: true,
      daysBetweenVisits: true,
      favoriteStaffMemberId: true,
      favoriteServiceCategory: true,
      churnRiskScore: true,
      engagementScore: true,
    },
  })

  // Filter to valid tier combos + exclude recently drafted + assign priority
  const priorityMap = new Map(validCombos.map(([v, val, p]) => [`${v}:${val}`, p]))

  const candidates: CandidateRow[] = []
  for (const c of clients) {
    if (excludeClientIds.has(c.id)) continue
    const key = `${c.vipTier}:${c.valueTier}`
    const priority = priorityMap.get(key)
    if (priority === undefined) continue
    candidates.push({ ...c, priority })
  }

  // Sort by priority ASC, then lifetimeSpend DESC
  candidates.sort((a, b) => a.priority - b.priority || b.lifetimeSpend - a.lifetimeSpend)

  return candidates.slice(0, config.dailyDraftCap)
}
