import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/api-auth"
import { getCancellations } from "@/lib/square-cancellations"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession()
  if (response) return response

  const period = req.nextUrl.searchParams.get("period") || "30days"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session!.user as any).role as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionLocationName = (session!.user as any).locationName as string | undefined

  // MANAGER: forced to their own location
  let location: string
  if (role === "MANAGER" && sessionLocationName) {
    location = sessionLocationName
  } else {
    location = req.nextUrl.searchParams.get("location") || "Both"
  }

  try {
    const data = await getCancellations(period, location)
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error("Cancellations API error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
