import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getMetricsByPeriod, getMetricsByPeriodWithDates } from "@/lib/square-metrics"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const period = req.nextUrl.searchParams.get("period") || "7days"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any).role as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionLocationName = (session.user as any).locationName as string | undefined

  // MANAGER: forced to their own location
  let loc: "Corpus Christi" | "San Antonio" | undefined
  if (role === "MANAGER" && sessionLocationName) {
    loc = sessionLocationName as "Corpus Christi" | "San Antonio"
  } else {
    const reqLoc = req.nextUrl.searchParams.get("location")
    loc = reqLoc ? (reqLoc as "Corpus Christi" | "San Antonio") : undefined
  }

  try {
    const startDate = req.nextUrl.searchParams.get("startDate")
    const endDate = req.nextUrl.searchParams.get("endDate")
    const metrics = startDate && endDate
      ? await getMetricsByPeriodWithDates(new Date(startDate).toISOString(), new Date(endDate + "T23:59:59").toISOString(), loc || undefined)
      : await getMetricsByPeriod(period, loc || undefined)
    return NextResponse.json({ metrics })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
