import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { verifyTDLRLicense } from "@/lib/tdlr"
import { sendSMS } from "@/lib/twilio"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"
import crypto from "crypto"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as Record<string, unknown>
  const role = user.role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: staffId } = await params
  const body = await req.json() as { method: string; licenseNumber?: string; holderName?: string; licenseType?: string; expirationDate?: string; status?: string }
  const { method, licenseNumber } = body

  const staff = await prisma.staffMember.findUnique({ where: { id: staffId } })
  if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 })

  if (method === "manual") {
    if (!licenseNumber) return NextResponse.json({ error: "License number required" }, { status: 400 })
    const result = await verifyTDLRLicense(licenseNumber)
    console.log("[verify-license] TDLR result:", JSON.stringify(result))
    console.log("[verify-license] valid:", result.valid, "error:", result.error)

    let expDateParsed: Date | null = null
    if (result.expirationDate) {
      try { expDateParsed = new Date(result.expirationDate) } catch { /* skip */ }
      if (expDateParsed && isNaN(expDateParsed.getTime())) expDateParsed = null
    }

    await prisma.staffMember.update({
      where: { id: staffId },
      data: {
        tdlrLicenseNumber: result.licenseNumber || licenseNumber,
        tdlrStatus: result.status || (result.valid ? "ACTIVE" : "INVALID"),
        tdlrExpirationDate: expDateParsed,
        tdlrVerifiedAt: result.valid ? new Date() : null,
        tdlrHolderName: result.holderName || null,
        licenseVerificationMethod: "manual",
        licenseVerifiedBy: user.id as string,
      },
    })
    logAction({ action: AUDIT_ACTIONS.LICENSE_VERIFIED, entity: "StaffMember", entityId: staffId, userId: user.id as string, userEmail: user.email as string, userRole: role, metadata: { licenseNumber, valid: result.valid, method: "manual" } })
    return NextResponse.json({ verified: result.valid, result })
  }

  if (method === "override") {
    if (!licenseNumber) return NextResponse.json({ error: "License number required" }, { status: 400 })
    let expDateParsed: Date | null = null
    if (body.expirationDate) {
      try { expDateParsed = new Date(body.expirationDate) } catch { /* skip */ }
      if (expDateParsed && isNaN(expDateParsed.getTime())) expDateParsed = null
    }
    await prisma.staffMember.update({
      where: { id: staffId },
      data: {
        tdlrLicenseNumber: licenseNumber,
        tdlrStatus: body.status || "ACTIVE",
        tdlrExpirationDate: expDateParsed,
        tdlrVerifiedAt: new Date(),
        tdlrHolderName: body.holderName || null,
        licenseVerificationMethod: "override",
        licenseVerifiedBy: user.id as string,
      },
    })
    logAction({ action: AUDIT_ACTIONS.LICENSE_VERIFIED, entity: "StaffMember", entityId: staffId, userId: user.id as string, userEmail: user.email as string, userRole: role, metadata: { licenseNumber, method: "override", holderName: body.holderName } })
    return NextResponse.json({ verified: true, override: true, result: { valid: true, licenseNumber, holderName: body.holderName, licenseType: body.licenseType, expirationDate: body.expirationDate, status: body.status || "ACTIVE" } })
  }

  if (method === "sms" || method === "email") {
    const token = crypto.randomUUID()
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.staffMember.update({
      where: { id: staffId },
      data: { licenseVerificationToken: token, licenseVerificationTokenExpiry: expiry },
    })
    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const verifyUrl = `${baseUrl}/verify-license?token=${token}`
    if (method === "sms" && staff.phone) {
      await sendSMS(staff.phone, `Hi ${staff.fullName.split(" ")[0]}! Please verify your cosmetology license for Salon Envy. Click here: ${verifyUrl} This link expires in 24 hours. Reply STOP to unsubscribe.`)
    } else if (method === "email" && staff.email) {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Salon Envy Portal <noreply@salonenvyusa.com>",
        to: staff.email,
        subject: "Verify Your Cosmetology License — Salon Envy",
        html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;"><h2>License Verification</h2><p>Hi ${staff.fullName.split(" ")[0]},</p><p>Please click the link below to verify your cosmetology license:</p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#7a8f96;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Verify License</a><p style="color:#666;font-size:12px;margin-top:24px;">This link expires in 24 hours.</p></div>`,
      })
    } else {
      return NextResponse.json({ error: `No ${method === "sms" ? "phone" : "email"} on file` }, { status: 400 })
    }
    logAction({ action: AUDIT_ACTIONS.LICENSE_VERIFICATION_SENT, entity: "StaffMember", entityId: staffId, userId: user.id as string, userEmail: user.email as string, userRole: role, metadata: { method } })
    return NextResponse.json({ sent: true, method })
  }

  return NextResponse.json({ error: "Invalid method" }, { status: 400 })
}
