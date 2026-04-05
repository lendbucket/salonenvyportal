import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    fullName?: string
    email?: string
    phone?: string
    role?: string
    locationId?: string
    sendOnboarding?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { fullName, email, phone, role, locationId, sendOnboarding } = body
  if (!email || !fullName || !locationId) {
    return NextResponse.json(
      { error: "fullName, email, and locationId are required" },
      { status: 400 }
    )
  }

  // Validate location exists
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  })
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 })
  }

  const position = role?.toLowerCase() === "manager" ? "manager" : "stylist"
  const userRole = role?.toUpperCase() === "MANAGER" ? "MANAGER" as const : "STYLIST" as const

  try {
    // Upsert user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: fullName,
        locationId,
        role: userRole,
        inviteStatus: "INVITED",
      },
      create: {
        email,
        name: fullName,
        locationId,
        role: userRole,
        inviteStatus: "INVITED",
      },
    })

    // Check if staff member already exists for this user
    const existingStaff = await prisma.staffMember.findUnique({
      where: { userId: user.id },
    })

    if (!existingStaff) {
      await prisma.staffMember.create({
        data: {
          userId: user.id,
          locationId,
          fullName,
          email,
          phone: phone || null,
          position,
          inviteStatus: "invited",
        },
      })
    } else {
      await prisma.staffMember.update({
        where: { id: existingStaff.id },
        data: {
          fullName,
          email,
          phone: phone || existingStaff.phone,
          position,
          locationId,
          inviteStatus: "invited",
        },
      })
    }

    // If sendOnboarding, create an OnboardingEnrollment
    let enrollmentLink: string | null = null
    if (sendOnboarding) {
      const nameParts = fullName.trim().split(/\s+/)
      const firstName = nameParts[0] || fullName
      const lastName = nameParts.slice(1).join(" ") || ""

      const enrollment = await prisma.onboardingEnrollment.create({
        data: {
          email,
          firstName,
          lastName,
          locationId,
          role: userRole,
          status: "pending",
          phone: phone || null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000")
      enrollmentLink = `${baseUrl}/onboarding/enroll/${enrollment.inviteToken}`
    }

    // Send branded email
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")

    const ctaUrl = enrollmentLink || `${baseUrl}/onboarding`
    const ctaLabel = enrollmentLink ? "Begin Enrollment" : "Get Started"

    await resend.emails.send({
      from:
        process.env.EMAIL_FROM || "Salon Envy Portal <noreply@salonenvyusa.com>",
      to: email,
      subject: "Welcome to Salon Envy\u00ae",
      html: `
        <div style="font-family: -apple-system, Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #0f1d24; color: #ffffff; padding: 40px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="180" style="display:block;height:auto;margin:0 auto;" />
          </div>
          <h2 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 8px;">Welcome, ${fullName}!</h2>
          <p style="color: #94A3B8; margin: 0 0 8px; font-size: 14px; line-height: 1.6;">
            You've been invited to join the Salon Envy\u00ae team at <strong style="color: #CDC9C0;">${location.name}</strong> as a <strong style="color: #CDC9C0;">${position.charAt(0).toUpperCase() + position.slice(1)}</strong>.
          </p>
          <p style="color: #94A3B8; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
            ${enrollmentLink ? "Click the button below to complete your enrollment and get started." : "Click the button below to set up your account and get started."}
          </p>
          <a href="${ctaUrl}" style="display: block; background: #CDC9C0; color: #0f1d24; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; margin-bottom: 24px;">
            ${ctaLabel}
          </a>
          <p style="color: #555; font-size: 12px; text-align: center; margin: 0;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true, enrollmentLink })
  } catch (err) {
    console.error("Failed to invite staff:", err)
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    )
  }
}
