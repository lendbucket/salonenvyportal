import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const locationId = req.nextUrl.searchParams.get("locationId") || "LTJSA6QR1HGW6"

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.json({ error: "Meta App not configured" }, { status: 500 })
  }

  const state = crypto.randomBytes(32).toString("hex")
  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"
  const redirectUri = `${baseUrl}/api/social/oauth/facebook/callback`

  await prisma.socialOAuthState.create({
    data: {
      state,
      locationId,
      userId: (session.user as Record<string, unknown>).id as string,
      platform: "facebook",
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })

  const scopes = [
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_show_list",
    "pages_read_user_content",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "read_insights",
    "business_management",
  ].join(",")

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    response_type: "code",
  })

  return NextResponse.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`)
}
