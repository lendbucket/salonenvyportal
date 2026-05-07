/**
 * Conversion tracking for agent drafts.
 * Checks if clients who received agent SMS made payments within 14 days.
 * Attributes revenue back to the agent for ROI tracking.
 */

export async function trackConversions(): Promise<{ checked: number; converted: number; revenue: number }> {
  const { prisma } = await import("@/lib/prisma")

  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000)

  // Find sent drafts within the attribution window that haven't been checked
  const drafts = await prisma.agentDraft.findMany({
    where: {
      status: "sent",
      sentAt: { gte: fourteenDaysAgo },
      convertedAt: null,
    },
    select: {
      id: true,
      clientId: true,
      agentId: true,
      sentAt: true,
    },
  })

  if (drafts.length === 0) return { checked: 0, converted: 0, revenue: 0 }

  let converted = 0
  let totalRevenue = 0

  for (const draft of drafts) {
    if (!draft.sentAt) continue

    // Check if client made a payment after the SMS was sent
    const payment = await prisma.squarePayment.findFirst({
      where: {
        clientId: draft.clientId,
        createdAtSquare: { gt: draft.sentAt },
        status: "COMPLETED",
      },
      orderBy: { createdAtSquare: "asc" },
      select: { totalAmount: true, refundedAmount: true, createdAtSquare: true },
    })

    if (payment) {
      const revenue = payment.totalAmount - (payment.refundedAmount || 0)

      await prisma.agentDraft.update({
        where: { id: draft.id },
        data: {
          status: "converted",
          convertedAt: payment.createdAtSquare,
          conversionRevenue: revenue,
        },
      })

      await prisma.agent.update({
        where: { id: draft.agentId },
        data: {
          totalRecovered: { increment: 1 },
          revenueAttributed: { increment: revenue },
        },
      })

      converted++
      totalRevenue += revenue
    }
  }

  return { checked: drafts.length, converted, revenue: totalRevenue }
}
