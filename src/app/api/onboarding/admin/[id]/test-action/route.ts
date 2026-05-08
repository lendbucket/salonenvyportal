import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params
  const body = await req.json()
  const action = body.action as string

  const enrollment = await prisma.onboardingEnrollment.findUnique({ where: { id } })
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {}

  switch (action) {
    case "skip_to_pending_review":
      updateData.status = "pending_review"
      updateData.emailVerified = true
      updateData.phoneVerified = true
      break
    case "mock_bg_check_clear":
      updateData.bgCheckStatus = "clear"
      updateData.bgCheckCompletedAt = new Date()
      break
    case "reset_to_started":
      updateData.status = "started"
      break
    case "force_i9_section_2":
      updateData.i9Section2Complete = true
      updateData.i9Section2VerifiedBy = userId
      updateData.i9Section2VerifiedAt = new Date()
      break
    case "force_approve":
      updateData.status = "approved"
      break
    default:
      return NextResponse.json({ error: "Unknown test action" }, { status: 400 })
  }

  await prisma.onboardingEnrollment.update({ where: { id }, data: updateData })

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: `enrollment.test_action.${action}`,
      entity: "onboarding_enrollment",
      entityId: id,
      userId,
      metadata: { action, previousStatus: enrollment.status },
    },
  })

  return NextResponse.json({ success: true, action })
}
