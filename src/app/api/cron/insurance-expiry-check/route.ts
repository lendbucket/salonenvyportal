import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")
  const thirtyDaysOut = new Date(Date.now() + 30 * 86400000)

  // Find insurance docs expiring within 30 days
  const expiringDocs = await prisma.enrollmentDocument.findMany({
    where: {
      documentType: "insurance_cert",
      expiresAt: { lte: thirtyDaysOut, gte: new Date() },
    },
    include: {
      enrollment: { select: { id: true, firstName: true, lastName: true, email: true, locationId: true } },
    },
  })

  let alertCount = 0
  for (const doc of expiringDocs) {
    const daysUntilExpiry = Math.ceil((doc.expiresAt!.getTime() - Date.now()) / 86400000)
    await prisma.adminAlert.create({
      data: {
        type: "insurance_expiring",
        title: `Insurance expiring in ${daysUntilExpiry} days`,
        body: `${doc.enrollment.firstName} ${doc.enrollment.lastName}'s liability insurance expires on ${doc.expiresAt!.toLocaleDateString()}.`,
        severity: daysUntilExpiry <= 7 ? "error" : "warning",
        locationId: doc.enrollment.locationId,
      },
    })
    alertCount++
  }

  return NextResponse.json({ ok: true, expiringCount: expiringDocs.length, alertsCreated: alertCount })
}
