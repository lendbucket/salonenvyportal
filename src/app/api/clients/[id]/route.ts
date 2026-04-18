import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"
import { CC_LOCATION_ID, SA_LOCATION_ID } from "@/lib/staff"

function getSquare() {
  return new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const user = session.user as Record<string, unknown>
  const role = user.role as string
  const isStylist = role === "STYLIST"

  // Get client from local DB
  const client = await prisma.client.findUnique({
    where: { id },
    include: { formulas: { orderBy: { createdAt: "desc" }, take: 10 } },
  })

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  // Fetch order history from Square using squareCustomerId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let visits: any[] = []
  let totalSpend = client.totalSpend || 0
  let totalVisits = client.totalVisits || 0
  let avgTicket = 0
  let lastVisit: string | null = client.lastVisitAt?.toISOString() || null

  if (client.squareCustomerId) {
    try {
      const square = getSquare()
      const ordersRes = await square.orders.search({
        locationIds: [CC_LOCATION_ID, SA_LOCATION_ID],
        query: {
          filter: {
            customerFilter: { customerIds: [client.squareCustomerId] },
            stateFilter: { states: ["COMPLETED"] },
          },
          sort: { sortField: "CLOSED_AT", sortOrder: "DESC" },
        },
        limit: 50,
      })

      const orders = ordersRes.orders || []
      totalVisits = orders.length || client.totalVisits || 0
      totalSpend = orders.reduce((sum, o) => sum + (Number(o.totalMoney?.amount || 0) / 100), 0) || client.totalSpend || 0
      avgTicket = totalVisits > 0 ? totalSpend / totalVisits : 0
      lastVisit = orders[0]?.closedAt || client.lastVisitAt?.toISOString() || null

      visits = orders.map(o => ({
        orderId: o.id,
        date: o.closedAt,
        location: o.locationId === CC_LOCATION_ID ? "CC" : "SA",
        services: (o.lineItems || []).map(li => ({
          name: li.name || "Service",
          price: Number(li.totalMoney?.amount || 0) / 100,
        })),
        subtotal: (Number(o.totalMoney?.amount || 0) - Number(o.totalTipMoney?.amount || 0) - Number(o.totalTaxMoney?.amount || 0)) / 100,
        tips: Number(o.totalTipMoney?.amount || 0) / 100,
        tax: Number(o.totalTaxMoney?.amount || 0) / 100,
        total: Number(o.totalMoney?.amount || 0) / 100,
        tenders: (o.tenders || []).map(t => ({
          type: t.type,
          last4: t.cardDetails?.card?.last4 || null,
          brand: t.cardDetails?.card?.cardBrand || null,
        })),
      }))
    } catch (err) {
      console.error("[clients/id] Square orders error:", err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({
    client: {
      id: client.id,
      squareCustomerId: client.squareCustomerId,
      name: [client.firstName, client.lastName].filter(Boolean).join(" ") || "Unknown",
      firstName: client.firstName,
      lastName: client.lastName,
      phone: isStylist && client.phone ? `***-***-${client.phone.replace(/\D/g, "").slice(-4)}` : client.phone,
      email: isStylist && client.email ? `${client.email[0]}***@${client.email.split("@")[1] || ""}` : client.email,
      notes: client.notes,
      cardOnFile: client.cardOnFile,
      createdAt: client.createdAt,
      profileInitials: `${(client.firstName || "?")[0]}${(client.lastName || "")[0] || ""}`.toUpperCase(),
    },
    stats: { totalSpend, totalVisits, avgTicket, lastVisit },
    visits,
    formulas: client.formulas,
  })
}
