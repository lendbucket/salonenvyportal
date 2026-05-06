import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { previewAudience } from "@/lib/audience/build"
import type { AudienceFilter } from "@/lib/audience/types"
import { segmentCount } from "@/lib/sms/personalize"

const COST_PER_SEGMENT = 0.0079

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const filter = body.audienceFilter as AudienceFilter
  const channel = (body.channel || "SMS") as "SMS" | "EMAIL"
  const messageBody = (body.body || "") as string

  const preview = await previewAudience(filter, channel)
  const segments = segmentCount(messageBody || "X".repeat(160))
  const estimatedCost = Math.round(preview.count * segments * COST_PER_SEGMENT * 100) / 100

  return NextResponse.json({
    ...preview,
    segments,
    estimatedCost,
    costPerRecipient: Math.round(segments * COST_PER_SEGMENT * 10000) / 10000,
  })
}
