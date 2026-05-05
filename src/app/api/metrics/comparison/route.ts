import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getComparisonMetrics, getMetricsByPeriodWithDates } from "@/lib/square-metrics"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const period = req.nextUrl.searchParams.get("period") || "30days"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session.user as any).role as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionLocationName = (session.user as any).locationName as string | undefined

    // MANAGER: forced to their own location
    let loc: string | null
    if (role === "MANAGER" && sessionLocationName) {
      loc = sessionLocationName
    } else {
      loc = req.nextUrl.searchParams.get("location")
    }

    const startDate = req.nextUrl.searchParams.get("startDate")
    const endDate = req.nextUrl.searchParams.get("endDate")
    const locFilter = loc === "Corpus Christi" || loc === "San Antonio" ? loc : undefined

    if (period === "custom" && startDate && endDate) {
      const startAt = new Date(startDate).toISOString()
      const endAt = new Date(endDate + "T23:59:59").toISOString()
      const currentMetrics = await getMetricsByPeriodWithDates(startAt, endAt, locFilter)
      return NextResponse.json({ currentMetrics, previousMetrics: [], prevStartAt: startAt, prevEndAt: endAt })
    }

    const data = await getComparisonMetrics(
      period,
      locFilter
    )
    return NextResponse.json(data)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
