import { NextRequest } from "next/server"
import { SquareClient, SquareEnvironment } from "square"
import { validateApiKey, apiResponse, apiError } from "@/lib/api-v1-auth"
import { TEAM_MEMBER_NAMES, TEAM_MEMBER_LOCATIONS } from "@/lib/square-metrics"

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return apiError(auth.error!, auth.status || 401)
  if (!auth.apiKey!.permissions.includes("appointments:read")) {
    return apiError("Insufficient permissions: appointments:read required", 403)
  }

  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0]
  const locationId = req.nextUrl.searchParams.get("locationId") || auth.apiKey!.locationId
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 200)

  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    const startAt = `${date}T00:00:00-05:00`
    const endAt = `${date}T23:59:59-05:00`

    const result = await square.bookings.list({
      startAtMin: new Date(startAt).toISOString(),
      startAtMax: new Date(endAt).toISOString(),
      limit: limit > 200 ? 200 : limit,
      ...(locationId ? { locationId } : {}),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appointments = (result.data || []).map((b: any) => {
      const tmId = b.appointmentSegments?.[0]?.teamMemberId || ""
      return {
        id: b.id,
        squareBookingId: b.id,
        startAt: b.startAt,
        durationMinutes: b.appointmentSegments?.[0]?.durationMinutes || 0,
        status: b.status,
        stylist: {
          id: tmId,
          name: TEAM_MEMBER_NAMES[tmId] || "Unknown",
          location: TEAM_MEMBER_LOCATIONS[tmId] === "Corpus Christi" ? "CC" : "SA",
        },
        services: (b.appointmentSegments || []).map((seg: { serviceVariationId?: string; durationMinutes?: number }) => ({
          variationId: seg.serviceVariationId,
          durationMinutes: seg.durationMinutes,
        })),
        locationId: b.locationId,
        customerNote: b.customerNote,
      }
    })

    return apiResponse({ appointments, total: appointments.length })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to fetch appointments", 500)
  }
}
