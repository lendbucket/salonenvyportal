import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const notes = await prisma.appointmentNote.findMany({
    where: { OR: [{ squareBookingId: id }, { squareCustomerId: id }] },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const user = session.user as Record<string, unknown>
  const body = await req.json()

  const note = await prisma.appointmentNote.create({
    data: {
      squareBookingId: id,
      squareCustomerId: body.squareCustomerId || null,
      note: body.note,
      createdBy: (user.name as string) || "Staff",
      createdById: (user.id as string) || "",
      notifyStylist: body.notifyStylist || false,
    },
  })

  // Send SMS to stylist if requested
  if (body.notifyStylist && body.stylistPhone) {
    try {
      const { sendSMS } = await import("@/lib/twilio")
      await sendSMS(body.stylistPhone, `Note for upcoming appointment: ${body.note.substring(0, 140)}`)
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ note })
}
