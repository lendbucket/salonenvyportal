import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  const userId = (session.user as Record<string, unknown>).id as string

  if (role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can review submissions" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { action, rejectionReason } = body

  const submission = await prisma.videoSubmission.findUnique({ where: { id } })
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (action === "approve") {
    const course = await prisma.eduCourse.create({
      data: {
        title: submission.title,
        description: submission.description,
        category: submission.category,
        instructor: "Community Submission",
        durationMinutes: Math.round((submission.suggestedHours || 0.5) * 60),
        level: "intermediate",
        isTdlrApproved: submission.isTdlrCe,
        tdlrHours: submission.isTdlrCe ? submission.suggestedHours : 0,
        videoUrl: submission.embedUrl || submission.videoId || "",
        isActive: true,
        isFeatured: false,
      },
    })

    await prisma.videoSubmission.update({
      where: { id },
      data: {
        status: "approved",
        reviewedBy: userId,
        reviewedAt: new Date(),
        approvedCourseId: course.id,
      },
    })

    return NextResponse.json({ success: true, course })
  }

  if (action === "reject") {
    await prisma.videoSubmission.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedBy: userId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || "Not approved",
      },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
