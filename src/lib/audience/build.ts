import type { AudienceFilter } from "./types"

interface ClientRow {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  totalVisits: number
  totalSpend: number
  lifetimeSpend: number
  averageTicket: number
  lastVisitAt: Date | null
  locationId: string | null
  birthday: Date | null
  favoriteServiceCategory: string | null
}

const PHONE_REGEX = /^\+?1?\d{10,11}$/

function hasValidPhone(c: ClientRow): boolean {
  if (!c.phone) return false
  return PHONE_REGEX.test(c.phone.replace(/\D/g, ""))
}

export async function buildAudience(filter: AudienceFilter, channel: "SMS" | "EMAIL"): Promise<ClientRow[]> {
  const { prisma } = await import("@/lib/prisma")

  // Base: opted in, not opted out, valid destination
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseWhere: any = {
    smsMarketingConsent: true,
    smsOptedOutAt: null,
    phone: { not: null },
  }

  const allClients = await prisma.client.findMany({
    where: baseWhere,
    select: {
      id: true, firstName: true, lastName: true, phone: true, email: true,
      totalVisits: true, totalSpend: true, lifetimeSpend: true, averageTicket: true,
      lastVisitAt: true, locationId: true, birthday: true, favoriteServiceCategory: true,
    },
  })

  // Filter for valid phone numbers
  const validClients = channel === "SMS" ? allClients.filter(hasValidPhone) : allClients

  // BY_PAYMENT_METHOD requires async DB query before static filtering
  if (filter.type === "BY_PAYMENT_METHOD") {
    const clientIds = validClients.map(c => c.id)
    const paymentGroups = await prisma.squarePayment.groupBy({
      by: ["clientId", "sourceType"],
      where: { clientId: { in: clientIds }, status: { in: ["COMPLETED", "APPROVED"] } },
      _count: true,
    })
    // Determine each client's payment profile: CARD_ONLY, CASH_ONLY, or MIXED
    const clientMethodMap = new Map<string, Set<string>>()
    for (const row of paymentGroups) {
      if (!row.clientId) continue
      if (!clientMethodMap.has(row.clientId)) clientMethodMap.set(row.clientId, new Set())
      clientMethodMap.get(row.clientId)!.add(row.sourceType)
    }
    const clientCategory = new Map<string, string>()
    for (const [cid, types] of clientMethodMap) {
      const hasCard = types.has("CARD") || types.has("SQUARE_GIFT_CARD")
      const hasCash = types.has("CASH") || types.has("EXTERNAL")
      if (hasCard && hasCash) clientCategory.set(cid, "MIXED")
      else if (hasCash) clientCategory.set(cid, "CASH_ONLY")
      else clientCategory.set(cid, "CARD_ONLY")
    }
    const filtered = validClients.filter(c => {
      const cat = clientCategory.get(c.id)
      if (!cat) return false // no payment data
      return filter.methods.includes(cat)
    })
    return filtered
  }

  return applyFilter(validClients, filter)
}

function applyFilter(clients: ClientRow[], filter: AudienceFilter): ClientRow[] {
  switch (filter.type) {
    case "ALL_CLIENTS":
      return clients

    case "BY_LOCATION":
      return clients.filter(c => c.locationId && filter.locationIds.includes(c.locationId))

    case "BY_LAST_VISIT": {
      const now = Date.now()
      const threshold = filter.daysSinceLastVisit * 24 * 60 * 60 * 1000
      return clients.filter(c => {
        if (!c.lastVisitAt) return filter.operator === "GT" // Never visited = infinite days since
        const daysSince = now - c.lastVisitAt.getTime()
        return filter.operator === "GT" ? daysSince > threshold : daysSince < threshold
      })
    }

    case "BY_VISIT_COUNT":
      return clients.filter(c => {
        if (filter.minVisits !== undefined && c.totalVisits < filter.minVisits) return false
        if (filter.maxVisits !== undefined && c.totalVisits > filter.maxVisits) return false
        return true
      })

    case "BY_TOTAL_SPEND":
      return clients.filter(c => {
        const spend = c.lifetimeSpend || c.totalSpend
        if (filter.minSpend !== undefined && spend < filter.minSpend) return false
        if (filter.maxSpend !== undefined && spend > filter.maxSpend) return false
        return true
      })

    case "BY_BIRTHDAY_MONTH": {
      const targetMonth = filter.month ?? (new Date().getMonth() + 1)
      return clients.filter(c => c.birthday && (c.birthday.getMonth() + 1) === targetMonth)
    }

    case "MANUAL":
      return clients.filter(c => filter.clientIds.includes(c.id))

    case "BY_STYLIST":
      // Requires booking data — for V1, return all clients (stylist filtering needs Square bookings query)
      return clients

    case "BY_SERVICE":
      return clients.filter(c =>
        c.favoriteServiceCategory && filter.serviceCategoryIds.includes(c.favoriteServiceCategory)
      )

    case "BY_AVG_TICKET":
      return clients.filter(c => {
        const avg = c.averageTicket || 0
        if (filter.minAvg !== undefined && avg < filter.minAvg) return false
        if (filter.maxAvg !== undefined && avg > filter.maxAvg) return false
        return true
      })

    case "BY_PAYMENT_METHOD":
      // This filter needs async payment data — for static applyFilter, we pass through
      // The actual filtering is done in buildAudience before calling applyFilter
      return clients

    case "AND":
      return filter.filters.reduce((acc, f) => applyFilter(acc, f), clients)

    case "OR": {
      const sets = filter.filters.map(f => new Set(applyFilter(clients, f).map(c => c.id)))
      const unionIds = new Set<string>()
      for (const s of sets) for (const id of s) unionIds.add(id)
      return clients.filter(c => unionIds.has(c.id))
    }

    default:
      return clients
  }
}

export async function previewAudience(filter: AudienceFilter, channel: "SMS" | "EMAIL"): Promise<{
  count: number
  sampleClients: Pick<ClientRow, "id" | "firstName" | "lastName" | "phone" | "email">[]
}> {
  const audience = await buildAudience(filter, channel)
  return {
    count: audience.length,
    sampleClients: audience.slice(0, 5).map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email })),
  }
}
