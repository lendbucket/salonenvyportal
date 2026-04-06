import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const { courseId } = await req.json()

  const completion = await prisma.courseCompletion.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { completedAt: new Date() },
    create: { userId, courseId, completedAt: new Date() },
  })

  // Update TDLR renewal tracker
  const course = await prisma.eduCourse.findUnique({ where: { id: courseId } })
  if (course?.isTdlrApproved && course.tdlrHours > 0) {
    const allCompletions = await prisma.courseCompletion.findMany({ where: { userId } })
    const completedIds = new Set(allCompletions.map((c) => c.courseId))
    const allCeCourses = await prisma.eduCourse.findMany({ where: { isTdlrApproved: true } })
    const totalCeHours = allCeCourses
      .filter((c) => completedIds.has(c.id))
      .reduce((s, c) => s + c.tdlrHours, 0)

    await prisma.tdlrLicenseRenewal.upsert({
      where: { userId },
      update: { ceHoursCompleted: totalCeHours, updatedAt: new Date() },
      create: { userId, ceHoursCompleted: totalCeHours, ceHoursRequired: 8 },
    })
  }

  return NextResponse.json({ completion })
}
