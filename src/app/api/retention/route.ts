import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/api-auth"
import { SquareClient, SquareEnvironment } from "square"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { response } = await requireSession()
  if (response) return response

  const location = req.nextUrl.searchParams.get("location")
  const debug = req.nextUrl.searchParams.get("debug") === "true"

  try {
    if (debug) {
      const square = new SquareClient({
        token: process.env.SQUARE_ACCESS_TOKEN!,
        environment: SquareEnvironment.Production,
      })

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const page = await square.bookings.list({
        startAtMin: thirtyDaysAgo.toISOString(),
        startAtMax: now.toISOString(),
        limit: 50,
      })

      const bookings = page.data || []
      const withCustomer = bookings.filter(b => b.customerId)
      const accepted = bookings.filter(b => b.status === "ACCEPTED")
      const acceptedWithCustomer = bookings.filter(b => b.status === "ACCEPTED" && b.customerId)
      const locationIds = [...new Set(bookings.map(b => b.locationId))]

      return NextResponse.json({
        totalBookings: bookings.length,
        withCustomerId: withCustomer.length,
        acceptedStatus: accepted.length,
        acceptedWithCustomer: acceptedWithCustomer.length,
        locationIdsFound: locationIds,
        locationFilter: location,
        allStatuses: [...new Set(bookings.map(b => b.status))],
        sampleAccepted: acceptedWithCustomer.slice(0, 3).map(b => ({
          id: b.id,
          customerId: b.customerId,
          locationId: b.locationId,
          status: b.status,
          startAt: b.startAt,
        })),
        sampleAll: bookings.slice(0, 5).map(b => ({
          id: b.id,
          customerId: b.customerId,
          locationId: b.locationId,
          status: b.status,
          startAt: b.startAt,
        })),
      })
    }

    // Normal flow
    const { getAllRetentionData } = await import("@/lib/square-retention")
    const data = await getAllRetentionData(
      location && location !== "Both" && location !== "null"
        ? (location as "Corpus Christi" | "San Antonio")
        : undefined
    )
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error("Retention API error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg, details: String(error) }, { status: 500 })
  }
}
