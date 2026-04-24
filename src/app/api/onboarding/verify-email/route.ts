import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, enrollmentId, action, code } = body as {
      email?: string
      enrollmentId?: string
      action?: string
      code?: string
    }

    if (!enrollmentId) {
      return NextResponse.json({ error: "Missing enrollmentId" }, { status: 400 })
    }

    // Look up enrollment by id or inviteToken
    const enrollment = await prisma.onboardingEnrollment.findFirst({
      where: {
        OR: [
          { id: enrollmentId },
          { inviteToken: enrollmentId },
        ],
      },
    })
    if (!enrollment) {
      console.error("[verify-email] Enrollment not found for:", enrollmentId)
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }
    console.log("[verify-email] Found enrollment:", enrollment.id, "| email:", enrollment.email)

    // Confirm action — verify the code
    if (action === "confirm") {
      if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 })
      }
      if (enrollment.emailVerificationCode !== code) {
        console.log("[verify-email] Invalid code. Expected:", enrollment.emailVerificationCode, "Got:", code)
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
      }
      if (enrollment.emailVerificationExpiry && new Date() > enrollment.emailVerificationExpiry) {
        return NextResponse.json({ error: "Verification code expired. Please request a new one." }, { status: 400 })
      }
      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { emailVerified: true },
      })
      console.log("[verify-email] Email verified for:", enrollment.email)
      return NextResponse.json({ verified: true })
    }

    // Send action — generate and email OTP
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    console.log("[verify-email] Generating OTP for:", email, "| code:", otp)

    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        emailVerificationCode: otp,
        emailVerificationExpiry: expiry,
        emailVerified: false,
      },
    })

    console.log("[verify-email] OTP saved to DB. Sending email...")
    console.log("[verify-email] RESEND_API_KEY present:", !!process.env.RESEND_API_KEY)
    console.log("[verify-email] RESEND_API_KEY length:", process.env.RESEND_API_KEY?.length || 0)

    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)

      const result = await resend.emails.send({
        from: "Salon Envy Team <team@salonenvyusa.com>",
        replyTo: "team@salonenvyusa.com",
        to: email,
        subject: "Your verification code — Salon Envy",
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;"><div style="display:none;color:#F4F5F7;">Your Salon Envy verification code: ${otp}</div><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F5F7;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;"><tr><td align="center" style="padding-bottom:24px;"><img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="120" style="display:block;height:auto;filter:brightness(0) saturate(100%) invert(60%) sepia(15%) saturate(600%) hue-rotate(155deg) brightness(90%);" /></td></tr><tr><td style="background-color:#FBFBFB;border-radius:16px;border:1px solid rgba(26,19,19,0.07);box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:4px;background:linear-gradient(90deg,#7a8f96,#9aafb7);"></td></tr></table><table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:36px 40px;"><tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:13px;font-weight:600;color:rgba(26,19,19,0.4);text-transform:uppercase;letter-spacing:0.08em;">Email Verification</p></td></tr><tr><td style="padding-bottom:24px;"><h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A1313;">Verify your email</h1><p style="margin:0;font-size:14px;color:rgba(26,19,19,0.55);line-height:1.6;">Enter this code to verify your email address and continue your onboarding.</p></td></tr><tr><td style="padding-bottom:24px;" align="center"><div style="background:#F4F5F7;border-radius:12px;border:1px solid rgba(26,19,19,0.08);padding:24px 32px;display:inline-block;"><p style="margin:0 0 4px;font-size:11px;font-weight:600;color:rgba(26,19,19,0.4);text-transform:uppercase;letter-spacing:0.1em;text-align:center;">Your Code</p><p style="margin:0;font-size:40px;font-weight:700;color:#1A1313;letter-spacing:12px;text-align:center;">${otp}</p></div></td></tr><tr><td><p style="margin:0;font-size:13px;color:rgba(26,19,19,0.4);text-align:center;line-height:1.6;">This code expires in <strong style="color:#1A1313;">10 minutes</strong>.<br/>If you did not request this, please ignore this email.</p></td></tr></table></td></tr><tr><td style="padding:20px 0 0;" align="center"><p style="margin:0;font-size:12px;color:rgba(26,19,19,0.3);">Salon Envy USA LLC · Corpus Christi, TX · San Antonio, TX</p></td></tr></table></td></tr></table></body></html>`,
        text: `Your Salon Envy verification code is: ${otp}. Expires in 10 minutes.`,
      })

      console.log("[verify-email] Resend result:", JSON.stringify(result))

      if (result.error) {
        console.error("[verify-email] Resend error:", JSON.stringify(result.error))
        return NextResponse.json({ error: "Failed to send verification email: " + (result.error as { message?: string }).message }, { status: 500 })
      }

      console.log("[verify-email] Email sent successfully. Message ID:", result.data?.id)
      return NextResponse.json({ sent: true, messageId: result.data?.id })
    } catch (emailErr) {
      console.error("[verify-email] Email send exception:", emailErr)
      return NextResponse.json({ error: "Failed to send email: " + (emailErr instanceof Error ? emailErr.message : "Unknown error") }, { status: 500 })
    }
  } catch (err) {
    console.error("[verify-email] Server error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
