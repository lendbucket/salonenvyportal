import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function publishPostToMeta(post: { locationId: string; platform: string; content: string; imageUrls: unknown }) {
  const result: { fbPostId?: string; igPostId?: string } = {}
  const locations = post.locationId === "BOTH" ? ["CC", "SA"] : [post.locationId]
  const images: string[] = Array.isArray(post.imageUrls) ? post.imageUrls : []

  for (const loc of locations) {
    const pageId = loc === "CC" ? process.env.META_CC_PAGE_ID : process.env.META_SA_PAGE_ID
    const igId = loc === "CC" ? process.env.META_CC_INSTAGRAM_ID : process.env.META_SA_INSTAGRAM_ID
    const token = loc === "CC" ? process.env.META_CC_PAGE_ACCESS_TOKEN : process.env.META_SA_PAGE_ACCESS_TOKEN

    if (post.platform === "facebook" || post.platform === "both") {
      if (images.length === 0) {
        const r = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: post.content, access_token: token }) })
        const d = await r.json(); if (!result.fbPostId) result.fbPostId = d.id
      } else if (images.length === 1) {
        const r = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: images[0], caption: post.content, access_token: token }) })
        const d = await r.json(); if (!result.fbPostId) result.fbPostId = d.post_id || d.id
      } else {
        const mids: { media_fbid: string }[] = []
        for (const url of images) { const r = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, published: false, access_token: token }) }); const d = await r.json(); if (d.id) mids.push({ media_fbid: d.id }) }
        const r = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: post.content, attached_media: mids, access_token: token }) })
        if (!result.fbPostId) result.fbPostId = (await r.json()).id
      }
    }

    if ((post.platform === "instagram" || post.platform === "both") && igId && images.length > 0) {
      if (images.length === 1) {
        const cr = await fetch(`https://graph.facebook.com/v18.0/${igId}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: images[0], caption: post.content, access_token: token }) })
        const cd = await cr.json()
        if (cd.id) { const pr = await fetch(`https://graph.facebook.com/v18.0/${igId}/media_publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: cd.id, access_token: token }) }); if (!result.igPostId) result.igPostId = (await pr.json()).id }
      } else {
        const cids: string[] = []
        for (const url of images) { const r = await fetch(`https://graph.facebook.com/v18.0/${igId}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: token }) }); const d = await r.json(); if (d.id) cids.push(d.id) }
        const cr = await fetch(`https://graph.facebook.com/v18.0/${igId}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "CAROUSEL", caption: post.content, children: cids.join(","), access_token: token }) })
        const cd = await cr.json()
        if (cd.id) { const pr = await fetch(`https://graph.facebook.com/v18.0/${igId}/media_publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: cd.id, access_token: token }) }); if (!result.igPostId) result.igPostId = (await pr.json()).id }
      }
    }
  }
  return result
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  const status = searchParams.get("status"); if (status && status !== "all") where.status = status
  const platform = searchParams.get("platform"); if (platform && platform !== "all") where.platform = platform
  const locationId = searchParams.get("locationId"); if (locationId && locationId !== "all") where.locationId = locationId
  const month = searchParams.get("month"); const year = searchParams.get("year")
  if (month && year) { const s = new Date(parseInt(year), parseInt(month) - 1, 1); const e = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59); where.OR = [{ scheduledAt: { gte: s, lte: e } }, { publishedAt: { gte: s, lte: e } }, { createdAt: { gte: s, lte: e } }] }
  const posts = await prisma.socialPost.findMany({ where, orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }], take: 200 })
  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const body = await req.json()
  const post = await prisma.socialPost.create({ data: { locationId: body.locationId || "BOTH", platform: body.platform || "both", content: body.content || "", imageUrls: body.imageUrls || [], status: body.status || "draft", scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, createdBy: userId } })
  if (body.status === "published") {
    try {
      const result = await publishPostToMeta(post)
      const updated = await prisma.socialPost.update({ where: { id: post.id }, data: { status: "published", publishedAt: new Date(), fbPostId: result.fbPostId, igPostId: result.igPostId } })
      return NextResponse.json({ post: updated })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "failed", errorMessage: msg } })
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }
  return NextResponse.json({ post })
}
