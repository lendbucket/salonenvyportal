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
        from: "Salon Envy Team <team@salonenvyusa.com>",
        replyTo: "team@salonenvyusa.com",
        to: email,
        subject: `You're invited to join Salon Envy — ${location.name}`,
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;"><div style="display:none;color:#F4F5F7;">${(session!.user as any).name || "Salon Envy"} has invited you to join the team. Complete your onboarding to get started.</div><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F5F7;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td align="center" style="padding-bottom:24px;"><img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="140" style="display:block;height:auto;filter:brightness(0) saturate(100%) invert(60%) sepia(15%) saturate(600%) hue-rotate(155deg) brightness(90%);" /></td></tr><tr><td style="background-color:#FBFBFB;border-radius:16px;border:1px solid rgba(26,19,19,0.07);box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:4px;background:linear-gradient(90deg,#7a8f96 0%,#9aafb7 100%);"></td></tr></table><table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:40px 40px 32px;"><tr><td style="padding-bottom:8px;"><p style="margin:0;font-size:13px;font-weight:600;color:rgba(26,19,19,0.4);text-transform:uppercase;letter-spacing:0.08em;">Team Invitation</p></td></tr><tr><td style="padding-bottom:24px;"><h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#1A1313;line-height:1.2;">Hi ${firstName},<br/>You're invited to join us</h1><p style="margin:0;font-size:15px;color:rgba(26,19,19,0.55);line-height:1.6;">${(session!.user as any).name || "Salon Envy"} has invited you to join the Salon Envy team as a <strong style="color:#1A1313;">${inviteRole}</strong> at our <strong style="color:#1A1313;">${location.name}</strong> location.</p></td></tr><tr><td style="padding-bottom:28px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F5F7;border-radius:10px;border:1px solid rgba(26,19,19,0.07);"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-bottom:10px;border-bottom:1px solid rgba(26,19,19,0.06);"><p style="margin:0;font-size:12px;color:rgba(26,19,19,0.4);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Location</p><p style="margin:4px 0 0;font-size:14px;color:#1A1313;font-weight:500;">${location.name}</p></td></tr><tr><td style="padding-top:10px;padding-bottom:10px;border-bottom:1px solid rgba(26,19,19,0.06);"><p style="margin:0;font-size:12px;color:rgba(26,19,19,0.4);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Role</p><p style="margin:4px 0 0;font-size:14px;color:#1A1313;font-weight:500;">${inviteRole}</p></td></tr><tr><td style="padding-top:10px;"><p style="margin:0;font-size:12px;color:rgba(26,19,19,0.4);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Link Expires</p><p style="margin:4px 0 0;font-size:14px;color:#1A1313;font-weight:500;">${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p></td></tr></table></td></tr></table></td></tr><tr><td style="padding-bottom:28px;" align="center"><a href="${process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"}/onboarding/enroll/${enrollment.inviteToken}" style="display:inline-block;padding:14px 36px;background-color:#7a8f96;color:#FBFBFB;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.3px;box-shadow:0 2px 8px rgba(122,143,150,0.35);">Complete Your Onboarding →</a><p style="margin:12px 0 0;font-size:12px;color:rgba(26,19,19,0.35);">Or copy: ${process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"}/onboarding/enroll/${enrollment.inviteToken}</p></td></tr><tr><td style="padding-bottom:24px;"><div style="height:1px;background:rgba(26,19,19,0.07);"></div></td></tr><tr><td><p style="margin:0;font-size:12px;color:rgba(26,19,19,0.4);line-height:1.5;">This invitation is personal to you and should not be shared. Your information is encrypted and stored securely. This link expires on ${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p></td></tr></table></td></tr><tr><td style="padding:24px 0 0;" align="center"><p style="margin:0 0 4px;font-size:13px;color:rgba(26,19,19,0.45);">Salon Envy USA LLC</p><p style="margin:0 0 4px;font-size:12px;color:rgba(26,19,19,0.3);">Corpus Christi, TX · San Antonio, TX</p><p style="margin:0;font-size:11px;color:rgba(26,19,19,0.25);">Questions? Reply to this email or call (361) 889-1102</p></td></tr></table></td></tr></table></body></html>`,
      });
    } catch (emailErr) {
      console.error("Failed to send enrollment email:", emailErr);
    }

    // Send SMS if phone number provided (non-blocking)
    if (phone) {
      try {
        const { sendSMS } = await import("@/lib/twilio");
        const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const smsMsg = `Hi ${firstName}! You've been invited to complete your Salon Envy onboarding. Click here to get started: ${baseUrl}/onboarding/enroll/${enrollment.inviteToken} Questions? Call (361) 889-1102. Reply STOP to unsubscribe.`;
        await sendSMS(phone, smsMsg);
      } catch (smsErr) {
        console.error("Failed to send onboarding SMS:", smsErr);
      }
    }

    return NextResponse.json({ success: true, enrollment });
  } catch (error: unknown) {
    console.error("Onboarding enrollment error:", error);
    return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
  }
}
