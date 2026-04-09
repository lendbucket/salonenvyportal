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

  try {
    const [igProfile, fbPosts] = await Promise.all([
      igId ? fetch(`https://graph.facebook.com/v18.0/${igId}?fields=followers_count,media_count,username,profile_picture_url&access_token=${token}`).then(r => r.json()).catch(() => null) : null,
      fetch(`https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,message,created_time,full_picture,likes.summary(true),comments.summary(true),shares&limit=10&access_token=${token}`).then(r => r.json()).catch(() => null),
    ])
    return NextResponse.json({ igProfile, fbPosts, locationId })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
