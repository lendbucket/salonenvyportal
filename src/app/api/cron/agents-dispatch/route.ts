import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { dispatchApprovedDrafts } = await import("@/lib/agents/dispatch-drafts")
  const result = await dispatchApprovedDrafts()
  return NextResponse.json({ ok: true, ...result })
}
