import { NextRequest, NextResponse } from "next/server"
import { requireStylistContext } from "@/lib/auth/get-stylist-context"
import { renderToStream } from "@react-pdf/renderer"
import { PayStubDocument } from "@/components/pdf/pay-stub-document"
import React from "react"

export const maxDuration = 30

export async function GET(_req: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  let ctx
  try {
    ctx = await requireStylistContext()
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!ctx.squareTeamMemberId) {
    return NextResponse.json({ error: "No team member linked" }, { status: 404 })
  }

  const { periodId } = await params
  const { prisma } = await import("@/lib/prisma")

  const entry = await prisma.payrollEntry.findFirst({
    where: {
      periodId,
      teamMemberId: ctx.squareTeamMemberId,
    },
    include: { period: true },
  })

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Resolve location name
  const location = await prisma.location.findFirst({
    where: { id: ctx.locationId },
    select: { name: true },
  })

  const pdfData = {
    periodId: entry.periodId,
    periodStart: entry.period.periodStart.toISOString(),
    periodEnd: entry.period.periodEnd.toISOString(),
    status: entry.period.status,
    stylistName: ctx.fullName,
    stylistEmail: ctx.email,
    locationName: location?.name || "Salon Envy",
    serviceCount: entry.serviceCount,
    serviceSubtotal: entry.serviceSubtotal,
    commission: entry.commission,
    tips: entry.tips,
    totalPayout: entry.totalPayout,
  }

  const stream = await renderToStream(React.createElement(PayStubDocument, { data: pdfData }))

  const dateStr = entry.period.periodStart.toISOString().split("T")[0]

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="paystub-${dateStr}.pdf"`,
    },
  })
}
