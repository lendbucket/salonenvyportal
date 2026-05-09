import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // KILL SWITCH — set PORTAL_KILL_SWITCH=true in Vercel env vars to disable
  if (process.env.PORTAL_KILL_SWITCH === "true") {
    return NextResponse.json({ disabled: true, reason: "kill_switch_active" }, { status: 200 })
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { trackConversions } = await import("@/lib/agents/track-conversions")
  const result = await trackConversions()
  return NextResponse.json({ ok: true, ...result })
}
