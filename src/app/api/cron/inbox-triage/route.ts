import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { triageUnclassifiedMessages } = await import("@/lib/inbox/triage")
  const result = await triageUnclassifiedMessages()
  return NextResponse.json({ ok: true, ...result })
}
