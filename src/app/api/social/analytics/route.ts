import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get("locationId") || "CC"

  const pageId = locationId === "CC" ? process.env.META_CC_PAGE_ID : process.env.META_SA_PAGE_ID
  const igId = locationId === "CC" ? process.env.META_CC_INSTAGRAM_ID : process.env.META_SA_INSTAGRAM_ID
  const token = locationId === "CC" ? process.env.META_CC_PAGE_ACCESS_TOKEN : process.env.META_SA_PAGE_ACCESS_TOKEN

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any = { locationId, errors: [] }

  // Facebook page info
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=name,fan_count,followers_count,picture&access_token=${token}`)
    const data = await res.json()
    if (data.error) results.errors.push({ source: "fb_page", message: data.error.message, code: data.error.code })
    else results.fbPage = data
  } catch (e: unknown) { results.errors.push({ source: "fb_page", message: e instanceof Error ? e.message : String(e) }) }

  // Facebook recent posts
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,message,created_time,full_picture,likes.summary(true),comments.summary(true),shares&limit=12&access_token=${token}`)
    const data = await res.json()
    if (data.error) results.errors.push({ source: "fb_posts", message: data.error.message, code: data.error.code })
    else results.fbPosts = data.data || []
  } catch (e: unknown) { results.errors.push({ source: "fb_posts", message: e instanceof Error ? e.message : String(e) }) }

  // Instagram profile
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${igId}?fields=username,followers_count,follows_count,media_count,profile_picture_url&access_token=${token}`)
    const data = await res.json()
    if (data.error) results.errors.push({ source: "ig_profile", message: data.error.message, code: data.error.code })
    else results.igProfile = data
  } catch (e: unknown) { results.errors.push({ source: "ig_profile", message: e instanceof Error ? e.message : String(e) }) }

  // Instagram recent media
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=12&access_token=${token}`)
    const data = await res.json()
    if (data.error) results.errors.push({ source: "ig_media", message: data.error.message, code: data.error.code })
    else results.igMedia = data.data || []
  } catch (e: unknown) { results.errors.push({ source: "ig_media", message: e instanceof Error ? e.message : String(e) }) }

  // Instagram insights (v18+ format)
  const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
  const until = Math.floor(Date.now() / 1000)
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${igId}/insights?metric=impressions,reach,profile_views&period=day&since=${since}&until=${until}&access_token=${token}`)
    const data = await res.json()
    if (data.error) results.errors.push({ source: "ig_insights", message: data.error.message, code: data.error.code })
    else results.igInsights = data.data || []
  } catch (e: unknown) { results.errors.push({ source: "ig_insights", message: e instanceof Error ? e.message : String(e) }) }

  // Facebook page insights
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/insights?metric=page_impressions,page_engaged_users,page_fan_adds_unique&period=week&access_token=${token}`)
    const data = await res.json()
    if (data.error) results.errors.push({ source: "fb_insights", message: data.error.message, code: data.error.code })
    else results.fbInsights = data.data || []
  } catch (e: unknown) { results.errors.push({ source: "fb_insights", message: e instanceof Error ? e.message : String(e) }) }

  return NextResponse.json(results)
}
