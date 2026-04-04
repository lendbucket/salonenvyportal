import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/api-auth"
import { getAllRetentionData } from "@/lib/square-retention"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { response } = await requireSession()
  if (response) return response

  const location = req.nextUrl.searchParams.get("location") as
    | "Corpus Christi"
    | "San Antonio"
    | null

  try {
    const data = await getAllRetentionData(location || undefined)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Retention API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch retention data" },
      { status: 500 }
    )
  }
}
