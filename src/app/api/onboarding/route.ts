import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

// GET: List all enrollments (owner/manager only)
export async function GET() {
  const { session, response } = await requireSession();
  if (response) return response;

  const role = (session!.user as any).role;
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = await prisma.onboardingEnrollment.findMany({
    include: { location: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ enrollments });
}

// POST: Create a new enrollment invitation
export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const role = (session!.user as any).role;
  if (role !== "OWNER" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, locationId, enrollRole, role: bodyRole } = body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      locationId?: string;
      enrollRole?: string;
      role?: string;
    };
    const inviteRole = enrollRole || bodyRole || "STYLIST";

    if (!firstName || !lastName || !email || !locationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 400 });
    }

    // Check for existing pending enrollment
    const existing = await prisma.onboardingEnrollment.findFirst({
      where: { email, status: { in: ["pending", "in_progress"] } },
    });
    if (existing) {
      return NextResponse.json({ error: "An active enrollment already exists for this email" }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const enrollment = await prisma.onboardingEnrollment.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        locationId,
        role: inviteRole === "MANAGER" ? "MANAGER" : "STYLIST",
        expiresAt,
      },
    });

    // Send invite email via Resend
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Salon Envy Portal <noreply@salonenvyusa.com>",
        to: email,
        subject: "Complete Your Salon Envy\u00ae Onboarding",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #0f1d24; color: #ffffff; padding: 40px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #CDC9C0; font-size: 28px; margin: 0 0 4px; font-weight: 900; letter-spacing: 0.05em;">SALON</h1>
              <h1 style="color: #CDC9C0; font-size: 36px; margin: 0; font-style: italic; font-family: Georgia, serif; font-weight: 400;">Envy</h1>
            </div>
            <h2 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 8px;">Welcome, ${firstName}!</h2>
            <p style="color: #94A3B8; margin: 0 0 8px; font-size: 14px; line-height: 1.6;">
              You've been invited to join the Salon Envy\u00ae team at ${location.name}.
            </p>
            <p style="color: #94A3B8; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
              Please complete your enrollment by clicking the button below. This link expires in 30 days.
            </p>
            <a href="${baseUrl}/onboarding/enroll/${enrollment.inviteToken}" style="display: block; background: #CDC9C0; color: #0f1d24; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; margin-bottom: 24px;">
              Complete Enrollment
            </a>
            <p style="color: #555; font-size: 12px; text-align: center; margin: 0;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send enrollment email:", emailErr);
      // Don't fail the entire request if email fails
    }

    return NextResponse.json({ success: true, enrollment });
  } catch (error: unknown) {
    console.error("Onboarding enrollment error:", error);
    return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
  }
}
