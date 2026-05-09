import { NextResponse } from "next/server"

export async function GET() {
  // PERMANENTLY DISABLED until root cause of 15-min timeout investigated
  return NextResponse.json({ disabled: true, reason: "investigating_timeout" }, { status: 200 })

  // KILL SWITCH — set PORTAL_KILL_SWITCH=true in Vercel env vars to disable
  if (process.env.PORTAL_KILL_SWITCH === "true") {
    return NextResponse.json({ disabled: true, reason: "kill_switch_active" }, { status: 200 })
  }
  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const res = await fetch(`${baseUrl}/api/social/publish-scheduled`, { method: "POST" })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
