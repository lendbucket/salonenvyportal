import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const complaints = await prisma.anonymousComplaint.findMany({
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ complaints })
}

export async function POST(req: Request) {
  // No auth required — anonymous submission
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { category, locationId, message } = body
  if (!category || !message) {
    return NextResponse.json({ error: "category and message are required" }, { status: 400 })
  }

  const complaint = await prisma.anonymousComplaint.create({
    data: {
      category,
      locationId: locationId || null,
      message,
    },
  })

  // Send email notification via Resend
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Salon Envy Portal <noreply@salonenvyusa.com>",
      to: "ceo@36west.org",
      subject: `New Anonymous Complaint: ${category}`,
      html: `<div style="font-family:sans-serif;padding:20px;background:#0a1520;color:#e9e5dc;">
        <h2 style="color:#CDC9C0;">New Anonymous Complaint</h2>
        <p><strong>Category:</strong> ${category}</p>
        ${locationId ? `<p><strong>Location ID:</strong> ${locationId}</p>` : ""}
        <p><strong>Message:</strong></p>
        <p style="padding:16px;background:#1a2a32;border-radius:8px;border:1px solid rgba(205,201,192,0.15);">${message}</p>
        <p style="margin-top:20px;"><a href="https://portal.salonenvyusa.com/complaints" style="color:#CDC9C0;">View in Portal</a></p>
      </div>`,
    })
  } catch {
    // Email failure should not block complaint creation
  }

  return NextResponse.json({ complaint }, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { id, reviewNote } = body
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const complaint = await prisma.anonymousComplaint.update({
    where: { id },
    data: {
      isReviewed: true,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    },
  })

  return NextResponse.json({ complaint })
}
