import { NextRequest } from "next/server"
import { validateApiKey, apiResponse, apiError } from "@/lib/api-v1-auth"
import { getMetricsByPeriod } from "@/lib/square-metrics"

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return apiError(auth.error!, auth.status || 401)
  if (!auth.apiKey!.permissions.includes("metrics:read")) {
    return apiError("Insufficient permissions: metrics:read required", 403)
  }

  const period = req.nextUrl.searchParams.get("period") || "today"
  const locationId = req.nextUrl.searchParams.get("locationId")

  let location: "Corpus Christi" | "San Antonio" | undefined
  if (locationId === "LTJSA6QR1HGW6") location = "Corpus Christi"
  else if (locationId === "LXJYXDXWR0XZF") location = "San Antonio"
  if (auth.apiKey!.locationId) {
    location = auth.apiKey!.locationId === "LTJSA6QR1HGW6" ? "Corpus Christi" : "San Antonio"
  }

  try {
    const metrics = await getMetricsByPeriod(period, location)
    const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0)
    const totalCheckouts = metrics.reduce((s, m) => s + m.checkoutCount, 0)
    const allStylists = metrics.flatMap((m) => m.stylistBreakdown)
    const top = allStylists.filter((s) => s.checkoutCount > 0).sort((a, b) => b.revenue - a.revenue)[0]

    return apiResponse({
      period: { start: metrics[0]?.periodStart, end: metrics[0]?.periodEnd },
      revenue: {
        net: totalRevenue,
        checkouts: totalCheckouts,
        avgTicket: totalCheckouts > 0 ? Math.round((totalRevenue / totalCheckouts) * 100) / 100 : 0,
      },
      topStylist: top ? { name: top.name, revenue: top.revenue, checkouts: top.checkoutCount } : null,
      locations: metrics.map((m) => ({
        location: m.location,
        revenue: m.revenue,
        checkouts: m.checkoutCount,
        avgTicket: m.avgTicket,
      })),
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to fetch metrics", 500)
  }
}
