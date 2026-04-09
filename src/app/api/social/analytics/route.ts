import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const locationId = req.nextUrl.searchParams.get("locationId") || "CC"
  const token = process.env.META_ACCESS_TOKEN
  const pageId = locationId === "CC" ? process.env.META_CC_PAGE_ID : process.env.META_SA_PAGE_ID
  const igId = locationId === "CC" ? process.env.META_CC_INSTAGRAM_ID : process.env.META_SA_INSTAGRAM_ID

  try {
    const [fbPage, igAccount, fbPosts] = await Promise.all([
      fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=fan_count,followers_count,name&access_token=${token}`).then(r => r.json()).catch(() => null),
      igId ? fetch(`https://graph.facebook.com/v18.0/${igId}?fields=followers_count,media_count,username&access_token=${token}`).then(r => r.json()).catch(() => null) : null,
      fetch(`https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,message,created_time,likes.summary(true),comments.summary(true),shares&limit=10&access_token=${token}`).then(r => r.json()).catch(() => null),
    ])

    return NextResponse.json({
      facebook: {
        fanCount: fbPage?.fan_count || 0,
        followersCount: fbPage?.followers_count || 0,
        pageName: fbPage?.name || "",
        recentPosts: (fbPosts?.data || []).map((p: Record<string, unknown>) => ({
          id: p.id,
          message: ((p.message as string) || "").slice(0, 100),
          createdTime: p.created_time,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          likes: (p.likes as any)?.summary?.total_count || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          comments: (p.comments as any)?.summary?.total_count || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shares: (p.shares as any)?.count || 0,
        })),
      },
      instagram: igAccount ? {
        followersCount: igAccount.followers_count || 0,
        mediaCount: igAccount.media_count || 0,
        username: igAccount.username || "",
      } : null,
      locationId,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
