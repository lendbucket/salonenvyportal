import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "node:crypto"

function verifyCheckrSignature(body: string, signature: string | null): boolean {
  const secret = process.env.CHECKR_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac("sha256", secret).update(body).digest("hex")
  return signature === expected
}

export async function POST(req: NextRequest) {
  // KILL SWITCH — set PORTAL_KILL_SWITCH=true in Vercel env vars to disable
  if (process.env.PORTAL_KILL_SWITCH === "true") {
    return NextResponse.json({ ok: true, disabled: true }, { status: 200 })
  }
  const rawBody = await req.text()
  const signature = req.headers.get("x-checkr-signature")

  if (!verifyCheckrSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const { prisma } = await import("@/lib/prisma")

  // Handle report.completed event
  if (event.type === "report.completed") {
    const reportId = event.data?.object?.id
    const status = event.data?.object?.status // clear | consider | suspended
    const completedAt = event.data?.object?.completed_at

    if (!reportId) return NextResponse.json({ received: true })

    // Find enrollment with this report ID
    const enrollment = await prisma.onboardingEnrollment.findFirst({
      where: { bgCheckOrderId: reportId },
    })

    if (!enrollment) return NextResponse.json({ received: true })

    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        bgCheckStatus: status,
        bgCheckCompletedAt: completedAt ? new Date(completedAt) : new Date(),
      },
    })

    // If clear, auto-progress
    if (status === "clear") {
      await prisma.auditLog.create({
        data: {
          action: "enrollment.bg_check.clear",
          entity: "onboarding_enrollment",
          entityId: enrollment.id,
          metadata: { reportId, status },
        },
      })
    } else {
      // Consider or suspended — create admin alert
      await prisma.adminAlert.create({
        data: {
          type: "bg_check_review_needed",
          title: `Background check: ${status}`,
          body: `${enrollment.firstName} ${enrollment.lastName}'s background check returned "${status}". Manual review required at /staff/enrollments/${enrollment.id}`,
          severity: "error",
          locationId: enrollment.locationId,
        },
      })
    }
  }

  return NextResponse.json({ received: true })
}
