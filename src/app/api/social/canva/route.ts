import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID || ""
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET || ""

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const action = req.nextUrl.searchParams.get("action")
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const redirectUri = `${baseUrl}/api/social/canva?action=callback`

  if (action === "auth") {
    const url = `https://www.canva.com/api/oauth/authorize?response_type=code&client_id=${CANVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=design:content:read%20design:meta:read%20asset:read`
    return NextResponse.redirect(url)
  }

  if (action === "callback") {
    const code = req.nextUrl.searchParams.get("code")
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 })
    try {
      const tokenRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: CANVA_CLIENT_ID, client_secret: CANVA_CLIENT_SECRET }).toString(),
      })
      const tokenData = await tokenRes.json()
      const response = NextResponse.redirect(`${baseUrl}/social?canva=connected`)
      if (tokenData.access_token) {
        response.cookies.set("canva_access_token", tokenData.access_token, { httpOnly: true, secure: true, maxAge: 3600, path: "/" })
      }
      return response
    } catch {
      return NextResponse.redirect(`${baseUrl}/social?canva=error`)
    }
  }

  if (action === "designs") {
    const canvaToken = req.cookies.get("canva_access_token")?.value
    if (!canvaToken) return NextResponse.json({ error: "Not connected to Canva", needsAuth: true })
    try {
      const r = await fetch("https://api.canva.com/rest/v1/designs?limit=20", { headers: { Authorization: `Bearer ${canvaToken}` } })
      const d = await r.json()
      return NextResponse.json({ designs: d.items || [] })
    } catch {
      return NextResponse.json({ designs: [], error: "Failed to fetch designs" })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
