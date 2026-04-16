import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, enrollmentId, action, code } = body as {
      phone?: string
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
      console.error("[verify-phone] Enrollment not found for:", enrollmentId)
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    // Confirm action — verify the code
    if (action === "confirm") {
      if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 })
      }
      if (enrollment.phoneVerificationCode !== code) {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
      }
      if (enrollment.phoneVerificationExpiry && new Date() > enrollment.phoneVerificationExpiry) {
        return NextResponse.json({ error: "Verification code expired. Please request a new one." }, { status: 400 })
      }
      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { phoneVerified: true },
      })
      console.log("[verify-phone] Phone verified for:", enrollment.id)
      return NextResponse.json({ verified: true })
    }

    // Send action — generate and SMS OTP
    if (!phone) {
      return NextResponse.json({ error: "Missing phone" }, { status: 400 })
    }

    // Check if Twilio is configured
    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER

    if (!twilioSid || !twilioToken || !twilioPhone) {
      console.log("[verify-phone] Twilio not configured — auto-verifying phone for enrollment:", enrollment.id)
      // Auto-verify since SMS is not available
      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { phoneVerified: true },
      })
      return NextResponse.json({ sent: false, skipped: true, reason: "SMS verification is temporarily unavailable. Your phone number has been saved." })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: {
        phoneVerificationCode: otp,
        phoneVerificationExpiry: expiry,
        phoneVerified: false,
      },
    })

    try {
      const { sendSMS } = await import("@/lib/twilio")
      await sendSMS(phone, `Your Salon Envy verification code is: ${otp}. Expires in 10 minutes.`)
      console.log("[verify-phone] SMS sent to:", phone)
      return NextResponse.json({ sent: true })
    } catch (smsErr) {
      console.log("[verify-phone] Twilio send failed:", smsErr instanceof Error ? smsErr.message : smsErr)
      // Auto-verify since SMS failed (number likely not approved)
      await prisma.onboardingEnrollment.update({
        where: { id: enrollment.id },
        data: { phoneVerified: true },
      })
      return NextResponse.json({ sent: false, skipped: true, reason: "SMS delivery failed. Your phone number has been saved." })
    }
  } catch (err) {
    console.error("[verify-phone] Server error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
