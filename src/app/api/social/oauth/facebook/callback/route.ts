import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")
  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"

  if (error) {
    console.log("[fb-oauth] User denied:", error)
    return NextResponse.redirect(`${baseUrl}/social?error=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/social?error=missing_params`)
  }

  const storedState = await prisma.socialOAuthState.findUnique({ where: { state } })
  if (!storedState || storedState.expiresAt < new Date()) {
    return NextResponse.redirect(`${baseUrl}/social?error=invalid_state`)
  }

  const { locationId } = storedState
  const redirectUri = `${baseUrl}/api/social/oauth/facebook/callback`

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `client_id=${process.env.META_APP_ID}&` +
        `client_secret=${process.env.META_APP_SECRET}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `code=${code}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || "Failed to get access token")
    }

    // Exchange for long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${process.env.META_APP_ID}&` +
        `client_secret=${process.env.META_APP_SECRET}&` +
        `fb_exchange_token=${tokenData.access_token}`
    )
    const longData = await longRes.json()
    const longToken = longData.access_token || tokenData.access_token

    // Get user info
    const userRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${longToken}`
    )
    const userData = await userRes.json()
    console.log("[fb-oauth] User:", userData.name, userData.id)

    // Get managed pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture,fan_count,instagram_business_account&access_token=${longToken}`
    )
    const pagesData = await pagesRes.json()
    const pages = pagesData.data || []
    console.log("[fb-oauth] Pages found:", pages.length)

    let pagesConnected = 0
    for (const page of pages) {
      const pageToken = page.access_token // Page tokens don't expire

      // Check for linked Instagram business account
      let igId: string | null = null
      let igUsername: string | null = null
      let igAvatar: string | null = null
      let igFollowers: number | null = null

      if (page.instagram_business_account?.id) {
        igId = page.instagram_business_account.id
        try {
          const igRes = await fetch(
            `https://graph.facebook.com/v19.0/${igId}?fields=id,username,profile_picture_url,followers_count,media_count&access_token=${pageToken}`
          )
          const igData = await igRes.json()
          igUsername = igData.username || null
          igAvatar = igData.profile_picture_url || null
          igFollowers = igData.followers_count || null
        } catch {
          // IG fetch failed, continue
        }
      }

      // Save Facebook connection
      await prisma.socialConnection.upsert({
        where: {
          locationId_platform_pageId: {
            locationId,
            platform: "facebook",
            pageId: page.id,
          },
        },
        create: {
          locationId,
          platform: "facebook",
          platformUserId: userData.id,
          platformUserName: userData.name,
          platformUserAvatar: userData.picture?.data?.url,
          pageId: page.id,
          pageName: page.name,
          pageAvatar: page.picture?.data?.url,
          instagramAccountId: igId,
          instagramUsername: igUsername,
          instagramAvatar: igAvatar,
          accessToken: pageToken,
          refreshToken: longToken,
          followerCount: page.fan_count,
          isActive: true,
          lastSyncAt: new Date(),
        },
        update: {
          platformUserName: userData.name,
          pageName: page.name,
          accessToken: pageToken,
          refreshToken: longToken,
          instagramAccountId: igId,
          instagramUsername: igUsername,
          instagramAvatar: igAvatar,
          followerCount: page.fan_count,
          isActive: true,
          lastSyncAt: new Date(),
        },
      })

      // Save Instagram connection if exists
      if (igId) {
        await prisma.socialConnection.upsert({
          where: {
            locationId_platform_pageId: {
              locationId,
              platform: "instagram",
              pageId: igId,
            },
          },
          create: {
            locationId,
            platform: "instagram",
            platformUserId: igId,
            platformUserName: igUsername || "",
            platformUserAvatar: igAvatar,
            pageId: igId,
            pageName: igUsername || "",
            accessToken: pageToken,
            followerCount: igFollowers,
            isActive: true,
            lastSyncAt: new Date(),
          },
          update: {
            platformUserName: igUsername || "",
            accessToken: pageToken,
            followerCount: igFollowers,
            isActive: true,
            lastSyncAt: new Date(),
          },
        })
      }

      pagesConnected++
    }

    // Clean up state
    await prisma.socialOAuthState.delete({ where: { state } }).catch(() => {})

    return NextResponse.redirect(`${baseUrl}/social?connected=true&pages=${pagesConnected}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[fb-oauth] Error:", msg)
    return NextResponse.redirect(`${baseUrl}/social?error=${encodeURIComponent(msg)}`)
  }
}
