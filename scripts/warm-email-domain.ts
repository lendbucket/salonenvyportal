/**
 * Domain warming helper — generates audience filter definitions for Day 1-7
 * of the email domain warming schedule.
 *
 * Queries EmailContact records ordered by engagement (opens, clicks)
 * and outputs audience filters ready to paste into the email composer.
 *
 * Run: npm run warm:email-domain
 */

import { PrismaClient } from "@prisma/client"

const WARMING_SCHEDULE = [
  { day: 1, count: 50, label: "Internal/test + most engaged" },
  { day: 2, count: 100, label: "Top engaged clients" },
  { day: 3, count: 250, label: "Engaged clients" },
  { day: 4, count: 500, label: "Engaged clients" },
  { day: 5, count: 1000, label: "Engaged + active clients" },
  { day: 6, count: 2500, label: "Active clients" },
  { day: 7, count: 5000, label: "Full audience ramp" },
]

async function main() {
  const prisma = new PrismaClient()

  try {
    // Get total opted-in contacts
    const totalContacts = await prisma.emailContact.count({
      where: { isOptedIn: true, isHardBounced: false },
    })
    console.log(`Total opted-in email contacts: ${totalContacts}`)
    console.log("")

    // Get contacts ordered by engagement (most engaged first)
    const contacts = await prisma.emailContact.findMany({
      where: { isOptedIn: true, isHardBounced: false },
      orderBy: [
        { totalOpened: "desc" },
        { totalClicked: "desc" },
        { lastOpenedAt: "desc" },
      ],
      select: {
        id: true,
        email: true,
        firstName: true,
        totalOpened: true,
        totalClicked: true,
        clientId: true,
      },
    })

    // Also get clients with recent visits for engagement scoring
    const clientIds = contacts.filter(c => c.clientId).map(c => c.clientId!)
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, lastVisitAt: true, totalVisits: true, lifetimeSpend: true },
    })
    const clientMap = new Map(clients.map(c => [c.id, c]))

    // Score contacts: email engagement + visit recency
    const scored = contacts.map(contact => {
      const client = contact.clientId ? clientMap.get(contact.clientId) : null
      let score = 0
      score += (contact.totalOpened || 0) * 3
      score += (contact.totalClicked || 0) * 5
      if (client?.lastVisitAt) {
        const daysSince = (Date.now() - client.lastVisitAt.getTime()) / 86400000
        if (daysSince < 30) score += 10
        else if (daysSince < 60) score += 5
        else if (daysSince < 90) score += 2
      }
      if (client?.totalVisits && client.totalVisits >= 3) score += 3
      if (client?.lifetimeSpend && client.lifetimeSpend >= 200) score += 2
      return { ...contact, score }
    })

    scored.sort((a, b) => b.score - a.score)

    console.log("=== Domain Warming Schedule ===")
    console.log("")

    let cumulative = 0
    for (const day of WARMING_SCHEDULE) {
      const newRecipients = Math.min(day.count, scored.length) - cumulative
      const dayContacts = scored.slice(cumulative, cumulative + newRecipients)
      cumulative += newRecipients

      console.log(`--- Day ${day.day}: ${day.count} emails (${day.label}) ---`)
      console.log(`  New recipients this day: ${newRecipients}`)
      console.log(`  Cumulative total: ${cumulative}`)

      if (dayContacts.length > 0) {
        console.log(`  Sample (first 5):`)
        for (const c of dayContacts.slice(0, 5)) {
          console.log(`    ${c.firstName || "?"} <${c.email}> (score: ${c.score}, opens: ${c.totalOpened}, clicks: ${c.totalClicked})`)
        }
      }

      // Generate a MANUAL audience filter for this day's batch
      const allDayIds = scored.slice(0, cumulative).filter(c => c.clientId).map(c => c.clientId!)
      console.log(`  Audience filter (MANUAL, ${allDayIds.length} client IDs):`)
      console.log(`    { "type": "MANUAL", "clientIds": [first ${Math.min(allDayIds.length, 3)} shown] }`)

      if (cumulative >= scored.length) {
        console.log(`  NOTE: All ${scored.length} contacts included by Day ${day.day}`)
        break
      }

      console.log("")
    }

    console.log("")
    console.log("=== Recommended Audience Builder Filters ===")
    console.log("")
    console.log("For automated warming without manual IDs:")
    console.log("  Day 1-2: BY_LAST_VISIT < 30 days (recently active)")
    console.log("  Day 3-4: BY_LAST_VISIT < 60 days")
    console.log("  Day 5:   BY_VISIT_COUNT min 3+")
    console.log("  Day 6:   BY_TOTAL_SPEND min $100+")
    console.log("  Day 7+:  ALL_CLIENTS")
    console.log("")
    console.log("Use the composer's audience preview to verify counts before sending.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error("Warming script failed:", e.message)
  process.exit(1)
})
