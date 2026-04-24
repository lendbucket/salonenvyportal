import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { Resend } from "resend";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, action } = (await req.json()) as { userId?: string; action?: string };

  if (!userId || !action) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (action === "approve") {
    const tempPassword = `${Math.random().toString(36).slice(-8)}SE!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        inviteStatus: "ACCEPTED",
        passwordHash,
      },
    });

    if (resend) {
      try {
        await resend.emails.send({
          from: "Salon Envy Team <team@salonenvyusa.com>",
          replyTo: "team@salonenvyusa.com",
          to: user.email,
          subject: "Your Salon Envy® Portal Access is Approved!",
          html: `
          <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; background: #0f1d24; color: #ffffff; padding: 40px; border-radius: 12px;">
            <h1 style="color: #CDC9C0; font-size: 24px;">Welcome to Salon Envy® Portal!</h1>
            <p style="color: #94A3B8;">Hi ${user.name ?? "there"},</p>
            <p style="color: #94A3B8;">Your portal access has been approved. Here are your login credentials:</p>
            <div style="background: #1a2a32; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(205,201,192,0.2);">
              <p style="margin: 0 0 8px; color: #CDC9C0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Email</p>
              <p style="margin: 0 0 16px; color: #ffffff; font-size: 16px; font-weight: 700;">${user.email}</p>
              <p style="margin: 0 0 8px; color: #CDC9C0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Temporary Password</p>
              <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 700;">${tempPassword}</p>
            </div>
            <p style="color: #94A3B8;">Please change your password after your first login.</p>
            <a href="https://portal.salonenvyusa.com/login" style="display: inline-block; background: #CDC9C0; color: #0f1d24; padding: 12px 24px; border-radius: 7px; text-decoration: none; font-weight: 800; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 8px;">
              Sign In to Portal →
            </a>
          </div>
        `,
        });
      } catch (e) {
        console.error("Email send failed:", e);
      }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "reject") {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
