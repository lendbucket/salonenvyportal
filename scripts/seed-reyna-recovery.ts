/**
 * Seeds the Reyna Recovery agent record with default configuration.
 * Idempotent — running twice does nothing on second run (upserts by name).
 *
 * Run: npm run seed:reyna-recovery
 */

import { PrismaClient } from "@prisma/client"

async function main() {
  const prisma = new PrismaClient()

  try {
    const existing = await prisma.agent.findUnique({ where: { name: "reyna_recovery" } })

    if (existing) {
      console.log(`Agent "reyna_recovery" already exists (id: ${existing.id}, status: ${existing.status})`)
      console.log("No changes made. Use the dashboard to modify settings.")
      return
    }

    const agent = await prisma.agent.create({
      data: {
        name: "reyna_recovery",
        displayName: "Reyna Recovery",
        description: "Identifies high-value lapsed clients and drafts personalized recovery SMS for owner approval. Targets AT_RISK and LAPSED clients with BIG_SPENDER, VALUABLE, or AVERAGE value tiers. Daily cap: 30 drafts.",
        status: "paused",
        schedule: "0 10 * * *",
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
      },
    })

    console.log(`Agent "reyna_recovery" seeded successfully (id: ${agent.id})`)
    console.log("Status: paused (activate manually at /agents/reyna-recovery)")
    console.log("\nDefault config:")
    console.log("  Daily draft cap: 30")
    console.log("  Send time: 9:30 AM")
    console.log("  Anti-spam window: 30 days")
    console.log("  Target tiers: AT_RISK, LAPSED, DEAD")
    console.log("  Value tiers: BIG_SPENDER, VALUABLE, AVERAGE")
    console.log("\nNext steps:")
    console.log("  1. Visit /agents/reyna-recovery")
    console.log("  2. Click 'Run Now' to generate first batch of drafts")
    console.log("  3. Review and approve drafts")
    console.log("  4. Change status to 'active' for daily auto-runs")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error("Seed failed:", e.message)
  process.exit(1)
})
