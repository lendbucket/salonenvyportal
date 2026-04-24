import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/api-auth"
import { Resend } from "resend"
import { sendSMS, formatOutreachMessage } from "@/lib/twilio"

export async function POST(req: NextRequest) {
  const { response } = await requireSession()
  if (response) return response

  const { customers, message, channel } = await req.json() as {
    customers: { customerId: string; customerName: string; email: string; phone: string }[]
    message: string
    channel: "email" | "sms"
  }

  if (!customers?.length || !message) {
    return NextResponse.json({ error: "Missing customers or message" }, { status: 400 })
  }

  if (channel === "sms") {
    const smsResults: { customerId: string; customerName: string; status: string; error?: string }[] = []
    let smsSent = 0
    let smsFailed = 0
    for (const customer of customers) {
      if (!customer.phone) {
        smsResults.push({ customerId: customer.customerId, customerName: customer.customerName, status: "skipped", error: "No phone number" })
        smsFailed++
        continue
      }
      const smsMsg = message || formatOutreachMessage(customer.customerName, 0, "")
      const result = await sendSMS(customer.phone, smsMsg)
      if (result.success) {
        smsResults.push({ customerId: customer.customerId, customerName: customer.customerName, status: "sent" })
        smsSent++
      } else {
        smsResults.push({ customerId: customer.customerId, customerName: customer.customerName, status: "failed", error: result.error })
        smsFailed++
      }
    }
    return NextResponse.json({ sent: smsSent, failed: smsFailed, results: smsResults })
  }

  // Email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const results: { customerId: string; customerName: string; status: string; error?: string }[] = []
  let sent = 0
  let failed = 0

  for (const customer of customers) {
    if (!customer.email) {
      results.push({
        customerId: customer.customerId,
        customerName: customer.customerName,
        status: "skipped",
        error: "No email address",
      })
      failed++
      continue
    }

    try {
      await resend.emails.send({
        from: "Salon Envy Team <team@salonenvyusa.com>",
        replyTo: "team@salonenvyusa.com",
        to: customer.email,
        subject: "We Miss You at Salon Envy!",
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a2a32; color: #fff; padding: 40px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #CDC9C0; font-size: 28px; margin: 0;">Salon Envy</h1>
              <p style="color: rgba(205,201,192,0.6); font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;">We Miss You</p>
            </div>
            <p style="color: #e8e4dc; font-size: 16px; line-height: 1.6;">
              Hi ${customer.customerName},
            </p>
            <p style="color: #e8e4dc; font-size: 16px; line-height: 1.6;">
              ${message}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://salonenvy.com/book" style="display: inline-block; padding: 14px 32px; background: #CDC9C0; color: #1a2a32; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.05em;">
                Book Now
              </a>
            </div>
            <p style="color: rgba(205,201,192,0.4); font-size: 12px; text-align: center; margin-top: 40px;">
              Salon Envy | Corpus Christi &amp; San Antonio
            </p>
          </div>
        `,
      })
      results.push({
        customerId: customer.customerId,
        customerName: customer.customerName,
        status: "sent",
      })
      sent++
    } catch (err) {
      results.push({
        customerId: customer.customerId,
        customerName: customer.customerName,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      })
      failed++
    }
  }

  return NextResponse.json({ sent, failed, results })
}
