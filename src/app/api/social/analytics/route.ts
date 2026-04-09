import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const locationId = req.nextUrl.searchParams.get("locationId") || "CC"
  const pageId = locationId === "CC" ? process.env.META_CC_PAGE_ID : process.env.META_SA_PAGE_ID
  const igId = locationId === "CC" ? process.env.META_CC_INSTAGRAM_ID : process.env.META_SA_INSTAGRAM_ID
  const token = locationId === "CC" ? process.env.META_CC_PAGE_ACCESS_TOKEN : process.env.META_SA_PAGE_ACCESS_TOKEN

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any = { locationId, errors: [] }

  // Facebook page info
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=name,fan_count,followers_count,about,picture&access_token=${token}`)
    const d = await r.json()
    if (d.error) results.errors.push({ source: "fb_page", error: d.error.message }); else results.fbPage = d
  } catch (e: unknown) { results.errors.push({ source: "fb_page", error: e instanceof Error ? e.message : String(e) }) }

  // Facebook posts
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,message,created_time,full_picture,likes.summary(true),comments.summary(true),shares&limit=12&access_token=${token}`)
    const d = await r.json()
    if (d.error) results.errors.push({ source: "fb_posts", error: d.error.message }); else results.fbPosts = d.data || []
  } catch (e: unknown) { results.errors.push({ source: "fb_posts", error: e instanceof Error ? e.message : String(e) }) }

  // Instagram profile
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/${igId}?fields=username,followers_count,follows_count,media_count,profile_picture_url,biography&access_token=${token}`)
    const d = await r.json()
    if (d.error) results.errors.push({ source: "ig_profile", error: d.error.message }); else results.igProfile = d
  } catch (e: unknown) { results.errors.push({ source: "ig_profile", error: e instanceof Error ? e.message : String(e) }) }

  // Instagram media
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=12&access_token=${token}`)
    const d = await r.json()
    if (d.error) results.errors.push({ source: "ig_media", error: d.error.message }); else results.igMedia = d.data || []
  } catch (e: unknown) { results.errors.push({ source: "ig_media", error: e instanceof Error ? e.message : String(e) }) }

  return NextResponse.json(results)
}
