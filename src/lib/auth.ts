import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

import type { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  secret:
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    "fallback-secret-for-dev",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || "smtp.resend.com",
        port: Number(process.env.EMAIL_SERVER_PORT) || 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER || "resend",
          pass: process.env.EMAIL_SERVER_PASSWORD || process.env.RESEND_API_KEY || "",
        },
      },
      from: "Salon Envy Team <team@salonenvyusa.com>",
      async sendVerificationRequest({ identifier: email, url }) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: "Salon Envy Team <team@salonenvyusa.com>",
          replyTo: "team@salonenvyusa.com",
          to: email,
          subject: "Sign in to Salon Envy Portal",
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1520;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1520;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="160" style="display:block;height:auto;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#1a2a32;border-radius:16px;padding:40px 36px;border:1px solid rgba(205,201,192,0.15);">
              <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Your sign-in link</p>
              <p style="margin:0 0 32px;font-size:14px;color:#94a3b8;line-height:1.6;">Click the button below to securely sign in to the Salon Envy Management Portal. This link expires in 24 hours and can only be used once.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${url}" style="display:inline-block;background-color:#CDC9C0;color:#0f1d24;padding:14px 40px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">Sign In to Portal</a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr><td style="border-top:1px solid rgba(205,201,192,0.1);font-size:0;">&nbsp;</td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#64748b;">Or copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:11px;color:#CDC9C0;word-break:break-all;line-height:1.6;">${url}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;">If you did not request this link, you can safely ignore this email.<br/>Salon Envy Management Portal</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        });
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (user.inviteStatus === "INVITED") return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;

      const email = user?.email;
      if (!email) return false;

      if (account?.provider === "google") {
        let dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser) {
          const role = email === "ceo@36west.org" ? "OWNER" : "STYLIST";
          const inviteStatus = email === "ceo@36west.org" ? "ACCEPTED" : "INVITED";
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name ?? undefined,
              role,
              inviteStatus,
            },
          });
        }
        if (dbUser.inviteStatus === "INVITED") {
          return "/login?error=PendingApproval";
        }
        return true;
      }

      if (account?.provider === "email") {
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser) return "/login?error=NotFound";
        if (dbUser.inviteStatus === "INVITED") return "/login?error=PendingApproval";
        return true;
      }

      return false;
    },
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email) as string | undefined;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          include: { location: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.locationId = dbUser.locationId;
          token.locationName = dbUser.location?.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        (session.user as any).locationId = token.locationId;
        (session.user as any).locationName = token.locationName;
      }
      return session;
    },
  },
};
