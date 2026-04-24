import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/twilio"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = session.user as Record<string, unknown>
  const role = user.role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { clientName, clientPhone, clientEmail, appointmentId, squareBookingId, locationId, amount } = body

  if (!clientName || !locationId) return NextResponse.json({ error: "clientName and locationId required" }, { status: 400 })

  const request = await prisma.cardOnFileRequest.create({
    data: {
      clientName,
      clientPhone: clientPhone || null,
      clientEmail: clientEmail || null,
      appointmentId: appointmentId || null,
      squareBookingId: squareBookingId || null,
      locationId,
      amount: amount || null,
      tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const link = `${baseUrl}/card-on-file?token=${request.token}`

  let smsSent = false
  if (clientPhone) {
    const smsResult = await sendSMS(clientPhone, `Hi ${clientName.split(" ")[0]}! Your appointment at Salon Envy is booked. To secure your appointment, please add a card on file: ${link} — your card will only be charged for no-shows. Link expires in 24 hours. Reply STOP to unsubscribe.`)
    smsSent = smsResult.success
  }

  let emailSent = false
  if (clientEmail) {
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "Salon Envy Team <team@salonenvyusa.com>",
        replyTo: "team@salonenvyusa.com",
        to: clientEmail,
        subject: "Secure Your Appointment — Salon Envy",
        html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;"><h2>Add Card on File</h2><p>Hi ${clientName.split(" ")[0]},</p><p>To secure your appointment, please add a card on file. Your card will only be charged in case of a no-show.</p><a href="${link}" style="display:inline-block;padding:14px 28px;background:#7a8f96;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Add Card</a><p style="color:#666;font-size:12px;margin-top:24px;">This link expires in 24 hours.</p></div>`,
      })
      emailSent = true
    } catch { /* skip */ }
  }

  return NextResponse.json({ token: request.token, link, smsSent, emailSent })
}
