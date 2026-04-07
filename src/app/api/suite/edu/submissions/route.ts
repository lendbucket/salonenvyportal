import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseVideoUrl } from "@/lib/videoParser"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const role = (session.user as Record<string, unknown>).role as string
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (role !== "OWNER") {
    const staff = await prisma.staffMember.findFirst({ where: { userId } })
    if (staff) where.locationId = staff.locationId
  }
  if (status && status !== "all") where.status = status

  const submissions = await prisma.videoSubmission.findMany({
    where,
    include: {
      submitter: { select: { name: true, email: true } },
      location: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ submissions })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const role = (session.user as Record<string, unknown>).role as string

  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, url, category, suggestedHours, isTdlrCe } = body

  const parsed = parseVideoUrl(url)
  if (!parsed.isValid) {
    return NextResponse.json(
      { error: "Invalid video URL. Paste a YouTube, Instagram, TikTok, or Facebook link." },
      { status: 400 }
    )
  }

  // Get location
  let locationId: string | undefined
  const staff = await prisma.staffMember.findFirst({ where: { userId } })
  locationId = staff?.locationId
  if (!locationId) {
    const loc = await prisma.location.findFirst()
    locationId = loc?.id
  }
  if (!locationId) return NextResponse.json({ error: "No location" }, { status: 400 })

  const submission = await prisma.videoSubmission.create({
    data: {
      submittedBy: userId,
      locationId,
      title,
      description,
      url,
      videoId: parsed.videoId,
      platform: parsed.platform,
      embedUrl: parsed.embedUrl,
      category,
      suggestedHours: parseFloat(suggestedHours) || 0,
      isTdlrCe: isTdlrCe || false,
      status: "pending",
    },
  })

  return NextResponse.json({ submission })
}
