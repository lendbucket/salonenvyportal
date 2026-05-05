import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  getMetaCredentials,
  publishToFacebookPage,
  publishToInstagram,
} from "@/lib/meta/publish"

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
    const locations = post.locationId === "BOTH" ? ["CC", "SA"] : [post.locationId]
    const images: string[] = Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : []
    const wantsFb = post.platform === "facebook" || post.platform === "both"
    const wantsIg = post.platform === "instagram" || post.platform === "both"

    let fbPostId: string | null = null
    let igPostId: string | null = null
    let fbError: string | null = null
    let igError: string | null = null

    for (const loc of locations) {
      const creds = getMetaCredentials(loc)

      if (wantsFb && creds.fbPageId && creds.fbAccessToken) {
        try {
          const fbResult = await publishToFacebookPage({
            pageId: creds.fbPageId,
            accessToken: creds.fbAccessToken,
            message: post.content,
            imageUrls: images,
          })
          fbPostId = fbResult.id
          console.log(`[social-publish] FB published: loc=${loc} postId=${fbResult.id}`)
        } catch (err: unknown) {
          fbError = err instanceof Error ? err.message : String(err)
          console.error(`[social-publish] FB failed: loc=${loc} error=${fbError}`)
        }
      }

      if (wantsIg && creds.igUserId && creds.fbAccessToken) {
        if (images.length === 0) {
          igError = "Instagram requires at least one image"
          console.warn(`[social-publish] IG skipped: loc=${loc} — no image`)
        } else {
          try {
            const igResult = await publishToInstagram({
              igUserId: creds.igUserId,
              accessToken: creds.fbAccessToken,
              caption: post.content,
              imageUrls: images,
            })
            igPostId = igResult.id
            console.log(`[social-publish] IG published: loc=${loc} mediaId=${igResult.id}`)
          } catch (err: unknown) {
            igError = err instanceof Error ? err.message : String(err)
            console.error(`[social-publish] IG failed: loc=${loc} error=${igError}`)
          }
        }
      }
    }

    const fbOk = !wantsFb || fbPostId !== null
    const igOk = !wantsIg || igPostId !== null
    const allOk = fbOk && igOk
    const allFailed = (wantsFb && !fbPostId) && (wantsIg && !igPostId)
    const errorParts: string[] = []
    if (fbError) errorParts.push(`FB: ${fbError}`)
    if (igError) errorParts.push(`IG: ${igError}`)

    const finalStatus = allOk ? "published" : allFailed ? "failed" : "partial"
    const updated = await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: finalStatus,
        publishedAt: (fbPostId || igPostId) ? new Date() : null,
        fbPostId: fbPostId || undefined,
        igPostId: igPostId || undefined,
        errorMessage: errorParts.length > 0 ? errorParts.join("; ") : null,
      },
    })

    if (allFailed) {
      return NextResponse.json({ error: errorParts.join("; "), post: updated }, { status: 500 })
    }
    return NextResponse.json({ post: updated })
  }

  return NextResponse.json({ post })
}
