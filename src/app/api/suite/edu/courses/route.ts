import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")

  const [courses, completions] = await Promise.all([
    prisma.eduCourse.findMany({
      where: { isActive: true, ...(category && category !== "all" ? { category } : {}) },
      orderBy: [{ isFeatured: "desc" }, { isTdlrApproved: "desc" }, { createdAt: "asc" }],
    }),
    prisma.courseCompletion.findMany({ where: { userId } }),
  ])

  const completedIds = new Set(completions.map((c) => c.courseId))
  const coursesWithStatus = courses.map((c) => ({
    ...c,
    isCompleted: completedIds.has(c.id),
    completedAt: completions.find((comp) => comp.courseId === c.id)?.completedAt || null,
  }))

  const completedCeHours = courses
    .filter((c) => c.isTdlrApproved && completedIds.has(c.id))
    .reduce((s, c) => s + c.tdlrHours, 0)

  return NextResponse.json({ courses: coursesWithStatus, completedCeHours })
}
