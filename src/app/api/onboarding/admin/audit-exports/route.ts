import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const body = await req.json()
  const exportType = body.type as string
  const startDate = body.startDate ? new Date(body.startDate) : new Date(Date.now() - 90 * 86400000)
  const endDate = body.endDate ? new Date(body.endDate) : new Date()

  if (exportType === "all_enrollments") {
    const enrollments = await prisma.onboardingEnrollment.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, locationId: true, createdAt: true, completedAt: true, compensationType: true },
      orderBy: { createdAt: "desc" },
    })
    const csv = ["ID,First Name,Last Name,Email,Role,Status,Location,Created,Completed,Comp Type",
      ...enrollments.map(e => `${e.id},${e.firstName},${e.lastName},${e.email},${e.role},${e.status},${e.locationId},${e.createdAt.toISOString()},${e.completedAt?.toISOString() || ""},${e.compensationType || ""}`)
    ].join("\n")
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=enrollments-${exportType}-${startDate.toISOString().slice(0, 10)}.csv` } })
  }

  if (exportType === "i9_compliance") {
    const enrollments = await prisma.onboardingEnrollment.findMany({
      where: { compensationType: "W2_HOURLY", createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, i9Section1Complete: true, i9Section1SignedAt: true, i9Section2Complete: true, i9Section2VerifiedAt: true, everifyStatus: true, everifyCaseNumber: true, status: true },
    })
    const csv = ["ID,Name,Section 1,Section 1 Date,Section 2,Section 2 Date,E-Verify Status,E-Verify Case,Enrollment Status",
      ...enrollments.map(e => `${e.id},${e.firstName} ${e.lastName},${e.i9Section1Complete},${e.i9Section1SignedAt?.toISOString() || ""},${e.i9Section2Complete},${e.i9Section2VerifiedAt?.toISOString() || ""},${e.everifyStatus || ""},${e.everifyCaseNumber || ""},${e.status}`)
    ].join("\n")
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=i9-compliance-${startDate.toISOString().slice(0, 10)}.csv` } })
  }

  if (exportType === "bg_check_summary") {
    const enrollments = await prisma.onboardingEnrollment.findMany({
      where: { bgCheckOrderId: { not: null }, createdAt: { gte: startDate, lte: endDate } },
      select: { id: true, firstName: true, lastName: true, bgCheckOrderId: true, bgCheckStatus: true, bgCheckRequestedAt: true, bgCheckCompletedAt: true },
    })
    const csv = ["ID,Name,Report ID,Status,Requested,Completed",
      ...enrollments.map(e => `${e.id},${e.firstName} ${e.lastName},${e.bgCheckOrderId},${e.bgCheckStatus || ""},${e.bgCheckRequestedAt?.toISOString() || ""},${e.bgCheckCompletedAt?.toISOString() || ""}`)
    ].join("\n")
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=bg-checks-${startDate.toISOString().slice(0, 10)}.csv` } })
  }

  if (exportType === "document_inventory") {
    const docs = await prisma.enrollmentDocument.findMany({
      where: { uploadedAt: { gte: startDate, lte: endDate } },
      include: { enrollment: { select: { firstName: true, lastName: true } } },
    })
    const csv = ["Doc ID,Enrollment,Name,Type,Verified,Expires,Uploaded",
      ...docs.map(d => `${d.id},${d.enrollmentId},${d.enrollment.firstName} ${d.enrollment.lastName},${d.documentType},${d.isVerified},${d.expiresAt?.toISOString() || ""},${d.uploadedAt.toISOString()}`)
    ].join("\n")
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=documents-${startDate.toISOString().slice(0, 10)}.csv` } })
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 })
}
