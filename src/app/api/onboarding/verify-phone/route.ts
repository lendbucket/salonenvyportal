import { NextRequest, NextResponse } from "next/server"
import { generateCode, isCodeValid, canSendCode, CODE_EXPIRY_MS } from "@/lib/crypto/verification-codes"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, enrollmentId, action, code } = body as {
      phone?: string; enrollmentId?: string; action?: string; code?: string
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

      if (!isCodeValid(code, enrollment.phoneVerificationCode, enrollment.phoneVerificationExpiry)) {
        return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 })
      }

      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { phoneVerified: true, phoneVerificationAttempts: 0 },
      })
      return NextResponse.json({ verified: true })
    }

    // Send action — generate and SMS OTP with rate limiting
    if (!phone) return NextResponse.json({ error: "Missing phone" }, { status: 400 })

    const rateCheck = canSendCode(enrollment.phoneVerificationAttempts, enrollment.phoneVerificationLastSent)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 })
    }

    // Check if Twilio is configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { phoneVerified: true },
      })
      return NextResponse.json({ sent: false, skipped: true, reason: "SMS verification temporarily unavailable. Phone saved." })
    }

    const otp = generateCode()
    const expiry = new Date(Date.now() + CODE_EXPIRY_MS)

    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        phoneVerificationCode: otp,
        phoneVerificationExpiry: expiry,
        phoneVerified: false,
        phoneVerificationAttempts: { increment: 1 },
        phoneVerificationLastSent: new Date(),
      },
    })

    try {
      const { sendSMS } = await import("@/lib/twilio")
      await sendSMS(phone, `Your Salon Envy verification code is: ${otp}. Expires in 15 minutes.`)
      return NextResponse.json({ sent: true })
    } catch (smsErr) {
      console.error("[verify-phone] SMS send failed:", smsErr)
      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { phoneVerified: true },
      })
      return NextResponse.json({ sent: false, skipped: true, reason: "SMS delivery failed. Phone saved." })
    }
  } catch (err) {
    console.error("[verify-phone] Server error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
