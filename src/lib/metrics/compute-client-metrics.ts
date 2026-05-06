import type { PrismaClient } from "@prisma/client"

const DAY_MS = 24 * 60 * 60 * 1000

export async function computeMetricsForClient(clientId: string, prisma: PrismaClient) {
  // Aggregate orders
  const orders = await prisma.squareOrder.findMany({
    where: { clientId },
    select: { totalAmount: true, state: true, closedAt: true },
  })

  const completedOrders = orders.filter(o => o.state === "COMPLETED")
  const lifetimeSpend = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0)
  const totalVisits = completedOrders.length
  const averageTicket = totalVisits > 0 ? lifetimeSpend / totalVisits : 0

  const closedDates = completedOrders.map(o => o.closedAt).filter(Boolean) as Date[]
  const lastOrderAt = closedDates.length > 0 ? new Date(Math.max(...closedDates.map(d => d.getTime()))) : null
  const firstOrderAt = closedDates.length > 0 ? new Date(Math.min(...closedDates.map(d => d.getTime()))) : null

  // Aggregate appointments
  const appointments = await prisma.squareAppointment.findMany({
    where: { clientId },
    select: { status: true, startAt: true, squareTeamMemberId: true },
  })

  const totalNoShows = appointments.filter(a => a.status === "NO_SHOW").length
  const totalCancellations = appointments.filter(a => a.status === "CANCELLED_BY_CUSTOMER" || a.status === "CANCELLED_BY_SELLER").length

  const acceptedAppts = appointments.filter(a => a.status === "ACCEPTED")
  const acceptedDates = acceptedAppts.map(a => a.startAt)
  const lastAcceptedAppt = acceptedDates.length > 0 ? new Date(Math.max(...acceptedDates.map(d => d.getTime()))) : null
  const firstApptAt = acceptedDates.length > 0 ? new Date(Math.min(...acceptedDates.map(d => d.getTime()))) : null

  const lastVisitAt = lastOrderAt && lastAcceptedAppt
    ? new Date(Math.max(lastOrderAt.getTime(), lastAcceptedAppt.getTime()))
    : lastOrderAt || lastAcceptedAppt || null

  const firstVisitAt = firstOrderAt && firstApptAt
    ? new Date(Math.min(firstOrderAt.getTime(), firstApptAt.getTime()))
    : firstOrderAt || firstApptAt || null

  // Days between visits
  let daysBetweenVisits: number | null = null
  if (totalVisits >= 2 && lastVisitAt && firstVisitAt) {
    daysBetweenVisits = (lastVisitAt.getTime() - firstVisitAt.getTime()) / DAY_MS / (totalVisits - 1)
  }

  // Predicted next visit
  let predictedNextVisitAt: Date | null = null
  if (daysBetweenVisits && lastVisitAt) {
    predictedNextVisitAt = new Date(lastVisitAt.getTime() + daysBetweenVisits * DAY_MS)
  }

  // Favorite staff member (mode)
  const teamMemberIds = appointments.map(a => a.squareTeamMemberId).filter(Boolean) as string[]
  let favoriteStaffMemberId: string | null = null
  if (teamMemberIds.length > 0) {
    const counts: Record<string, number> = {}
    for (const id of teamMemberIds) counts[id] = (counts[id] || 0) + 1
    favoriteStaffMemberId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  // VIP Tier
  const now = Date.now()
  const daysSinceLastVisit = lastVisitAt ? (now - lastVisitAt.getTime()) / DAY_MS : Infinity
  const daysSinceFirst = firstVisitAt ? (now - firstVisitAt.getTime()) / DAY_MS : Infinity

  let vipTier: string
  if (daysSinceLastVisit > 90) {
    vipTier = "DEAD"
  } else if (daysSinceLastVisit > 60) {
    vipTier = "LAPSED"
  } else if (daysSinceLastVisit > 30) {
    vipTier = "AT_RISK"
  } else if (daysSinceFirst < 30 && totalVisits <= 2) {
    vipTier = "NEW"
  } else if (lifetimeSpend > 500 && daysSinceLastVisit < 30) {
    vipTier = "VIP"
  } else {
    vipTier = "REGULAR"
  }

  // Engagement score 0-100
  const recencyScore = daysSinceLastVisit <= 7 ? 30 : daysSinceLastVisit <= 14 ? 25 : daysSinceLastVisit <= 30 ? 20 : daysSinceLastVisit <= 60 ? 10 : 0
  const cadenceScore = daysBetweenVisits ? (daysBetweenVisits <= 21 ? 30 : daysBetweenVisits <= 35 ? 25 : daysBetweenVisits <= 50 ? 15 : 5) : 0
  const spendScore = lifetimeSpend >= 1000 ? 20 : lifetimeSpend >= 500 ? 15 : lifetimeSpend >= 200 ? 10 : lifetimeSpend > 0 ? 5 : 0

  // SMS engagement — check if opted in and recently engaged
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { smsMarketingConsent: true, smsLastEngagedAt: true } })
  let smsScore = 0
  if (client?.smsMarketingConsent) {
    smsScore = 10
    if (client.smsLastEngagedAt && (now - client.smsLastEngagedAt.getTime()) / DAY_MS < 30) smsScore = 20
  }

  const engagementScore = Math.min(100, recencyScore + cadenceScore + spendScore + smsScore)

  // Churn risk score 0-1
  let churnRiskScore: number
  if (daysSinceLastVisit < 30) churnRiskScore = 0
  else if (daysSinceLastVisit < 60) churnRiskScore = 0.3
  else if (daysSinceLastVisit < 90) churnRiskScore = 0.6
  else if (daysSinceLastVisit < 180) churnRiskScore = 0.85
  else churnRiskScore = 0.95

  // Update client
  await prisma.client.update({
    where: { id: clientId },
    data: {
      lifetimeSpend,
      totalVisits,
      totalNoShows,
      totalCancellations,
      averageTicket,
      lastOrderAt,
      lastVisitAt,
      firstVisitAt,
      daysBetweenVisits,
      predictedNextVisitAt,
      favoriteStaffMemberId,
      vipTier,
      engagementScore,
      churnRiskScore,
      metricsLastComputedAt: new Date(),
    },
  })
}
