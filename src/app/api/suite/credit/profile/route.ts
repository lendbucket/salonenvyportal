import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function getScoreTier(score: number | null): string {
  if (!score) return "unknown"
  if (score < 580) return "poor"
  if (score < 670) return "fair"
  if (score < 740) return "good"
  if (score < 800) return "very_good"
  return "exceptional"
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const userRole = (session.user as Record<string, unknown>).role as string

  const sub = await prisma.suiteSubscription.findUnique({ where: { userId } })
  if (!sub && userRole !== "OWNER") {
    return NextResponse.json({ error: "No subscription" }, { status: 403 })
  }

  let profile = await prisma.creditProfile.findUnique({ where: { userId } })
  if (!profile) {
    profile = await prisma.creditProfile.create({
      data: {
        userId,
        currentScore: null,
        tier: null,
        reportingStartDate: sub?.startDate || new Date(),
        totalPaymentsReported: 0,
        bureausReported: { experian: true, transunion: true, equifax: true },
        estimatedScoreGain: 0,
        scoreHistory: [],
      },
    })
  }

  const startDate = sub?.startDate ? new Date(sub.startDate) : new Date()
  const now = new Date()
  const monthsSubscribed = Math.max(
    0,
    Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
  )
  const paymentsReported = monthsSubscribed
  const estimatedGain = Math.min(monthsSubscribed * 8, 80)

  return NextResponse.json({
    profile,
    monthsSubscribed,
    paymentsReported,
    estimatedGain,
    hasSubscription: !!sub,
    subscriptionStart: sub?.startDate,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const body = await req.json()

  const profile = await prisma.creditProfile.upsert({
    where: { userId },
    update: {
      currentScore: body.currentScore,
      tier: getScoreTier(body.currentScore),
      scoreHistory: body.scoreHistory,
      updatedAt: new Date(),
    },
    create: {
      userId,
      currentScore: body.currentScore,
      tier: getScoreTier(body.currentScore),
      scoreHistory: body.scoreHistory || [],
      reportingStartDate: new Date(),
      bureausReported: { experian: true, transunion: true, equifax: true },
    },
  })

  return NextResponse.json({ profile })
}
