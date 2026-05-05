import { NextResponse } from "next/server"
import {
  getMetaCredentials,
  publishToFacebookPage,
  publishToInstagram,
} from "@/lib/meta/publish"

export async function POST() {
  const { prisma } = await import("@/lib/prisma")
  const now = new Date()
  const duePosts = await prisma.socialPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
  })

  if (duePosts.length === 0) {
    return NextResponse.json({ published: 0, results: [] })
  }

  const results: { id: string; success: boolean; error?: string }[] = []

  for (const post of duePosts) {
    try {
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

        // Facebook
        if (wantsFb && creds.fbPageId && creds.fbAccessToken) {
          try {
            const fbResult = await publishToFacebookPage({
              pageId: creds.fbPageId,
              accessToken: creds.fbAccessToken,
              message: post.content,
              imageUrls: images,
            })
            fbPostId = fbResult.id
            console.log(`[social-cron] FB published: loc=${loc} postId=${fbResult.id}`)
          } catch (err: unknown) {
            fbError = err instanceof Error ? err.message : String(err)
            console.error(`[social-cron] FB failed: loc=${loc} error=${fbError}`)
          }
        }

        // Instagram
        if (wantsIg && creds.igUserId && creds.fbAccessToken) {
          if (images.length === 0) {
            igError = "Instagram requires at least one image"
            console.warn(`[social-cron] IG skipped: loc=${loc} — no image`)
          } else {
            try {
              const igResult = await publishToInstagram({
                igUserId: creds.igUserId,
                accessToken: creds.fbAccessToken,
                caption: post.content,
                imageUrls: images,
              })
              igPostId = igResult.id
              console.log(`[social-cron] IG published: loc=${loc} mediaId=${igResult.id}`)
            } catch (err: unknown) {
              igError = err instanceof Error ? err.message : String(err)
              console.error(`[social-cron] IG failed: loc=${loc} error=${igError}`)
            }
          }
        }
      }

      // Determine final status
      const fbOk = !wantsFb || fbPostId !== null
      const igOk = !wantsIg || igPostId !== null
      const allOk = fbOk && igOk
      const allFailed = (wantsFb && !fbPostId) && (wantsIg && !igPostId)
      const errorParts: string[] = []
      if (fbError) errorParts.push(`FB: ${fbError}`)
      if (igError) errorParts.push(`IG: ${igError}`)

      const status = allOk ? "published" : allFailed ? "failed" : "partial"
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status,
          publishedAt: (fbPostId || igPostId) ? new Date() : null,
          fbPostId: fbPostId || undefined,
          igPostId: igPostId || undefined,
          errorMessage: errorParts.length > 0 ? errorParts.join("; ") : null,
        },
      })

      results.push({ id: post.id, success: allOk, error: errorParts.join("; ") || undefined })
    } catch (err: unknown) {
      // Catch-all: one bad post should not kill the entire cron
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[social-cron] Fatal error on post ${post.id}: ${msg}`)
      try {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: "failed", errorMessage: msg },
        })
      } catch {
        // DB update failed too — log and continue
        console.error(`[social-cron] Could not mark post ${post.id} as failed`)
      }
      results.push({ id: post.id, success: false, error: msg })
    }
  }

  return NextResponse.json({ published: results.filter(r => r.success).length, results })
}
