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
        from: "Salon Envy <waivers@salonenvyusa.com>",
        to: email,
        subject: "Your Salon Envy Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
            <img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" style="max-width: 150px; margin-bottom: 24px; background: #0f1d24; padding: 8px 12px; border-radius: 6px;" />
            <h2 style="color: #1A1313; margin: 0 0 8px;">Verify Your Email</h2>
            <p style="color: #666666; font-size: 14px; margin: 0 0 24px;">Enter this code to verify your email address:</p>
            <div style="background: #f5f5f5; border: 2px solid #e0e0e0; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: monospace; color: #1A1313;">${otp}</span>
            </div>
            <p style="color: #999999; font-size: 12px; margin: 0;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
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
