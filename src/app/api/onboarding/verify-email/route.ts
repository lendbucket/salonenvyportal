import { NextRequest, NextResponse } from "next/server"
import { generateCode, isCodeValid, canSendCode, CODE_EXPIRY_MS } from "@/lib/crypto/verification-codes"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, enrollmentId, action, code } = body as {
      email?: string; enrollmentId?: string; action?: string; code?: string
    }

    if (!enrollmentId) return NextResponse.json({ error: "Missing enrollmentId" }, { status: 400 })

    const { prisma } = await import("@/lib/prisma")
    const enrollment = await prisma.onboardingEnrollment.findFirst({
      where: { OR: [{ id: enrollmentId }, { inviteToken: enrollmentId }] },
    })
    if (!enrollment) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })

    // Confirm action — verify the code
    if (action === "confirm") {
      if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 })

      if (!isCodeValid(code, enrollment.emailVerificationCode, enrollment.emailVerificationExpiry)) {
        // Increment attempt counter (if you want to track wrong guesses per verification session)
        return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 })
      }

      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { emailVerified: true, emailVerificationAttempts: 0 },
      })
      return NextResponse.json({ verified: true })
    }

    // Send action — generate and email OTP with rate limiting
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

    const rateCheck = canSendCode(enrollment.emailVerificationAttempts, enrollment.emailVerificationLastSent)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 })
    }

    const otp = generateCode()
    const expiry = new Date(Date.now() + CODE_EXPIRY_MS)

    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        emailVerificationCode: otp,
        emailVerificationExpiry: expiry,
        emailVerified: false,
        emailVerificationAttempts: { increment: 1 },
        emailVerificationLastSent: new Date(),
      },
    })

    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)

      await resend.emails.send({
        from: "Salon Envy Team <team@salonenvyusa.com>",
        replyTo: "team@salonenvyusa.com",
        to: email,
        subject: "Your verification code -- Salon Envy",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px;"><h2 style="color:#1A1313;">Verify your email</h2><p style="color:#525866;">Enter this code to continue your onboarding:</p><div style="background:#F4F5F7;border-radius:12px;padding:24px;text-align:center;margin:20px 0;"><p style="font-size:40px;font-weight:700;color:#1A1313;letter-spacing:12px;margin:0;">${otp}</p></div><p style="color:#9ca3af;font-size:13px;">This code expires in 15 minutes.</p></div>`,
        text: `Your Salon Envy verification code is: ${otp}. Expires in 15 minutes.`,
      })
      return NextResponse.json({ sent: true })
    } catch (emailErr) {
      console.error("[verify-email] Email send failed:", emailErr)
      return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 })
    }
  } catch (err) {
    console.error("[verify-email] Server error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
