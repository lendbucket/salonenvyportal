import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // KILL SWITCH — set PORTAL_KILL_SWITCH=true in Vercel env vars to disable
  if (process.env.PORTAL_KILL_SWITCH === "true") {
    return NextResponse.json({ disabled: true, reason: "kill_switch_active" }, { status: 200 })
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")
  const issues: string[] = []

  // W-2 employees missing I-9 Section 2
  const missingI9 = await prisma.onboardingEnrollment.count({
    where: { compensationType: "W2_HOURLY", status: "active", i9Section2Complete: false, deletedAt: null },
  })
  if (missingI9 > 0) issues.push(`${missingI9} W-2 employee(s) with incomplete I-9 Section 2`)

  // Expired licenses
  const expiredLicenses = await prisma.enrollmentDocument.count({
    where: { documentType: "license_image", expiresAt: { lt: new Date() }, enrollment: { status: "active" } },
  })
  if (expiredLicenses > 0) issues.push(`${expiredLicenses} active employee(s) with expired licenses`)

  // Expired insurance
  const expiredInsurance = await prisma.enrollmentDocument.count({
    where: { documentType: "insurance_cert", expiresAt: { lt: new Date() }, enrollment: { status: "active" } },
  })
  if (expiredInsurance > 0) issues.push(`${expiredInsurance} active employee(s) with expired insurance`)

  // Create admin alert with summary
  if (issues.length > 0) {
    await prisma.adminAlert.create({
      data: {
        type: "quarterly_compliance_check",
        title: `Quarterly compliance: ${issues.length} issue(s) found`,
        body: issues.join("\n"),
        severity: "warning",
      },
    })

    // Email summary
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "Salon Envy Portal <portal@salonenvyusa.com>",
        to: "ceo@36west.org",
        subject: `Quarterly Compliance Check: ${issues.length} issue(s)`,
        html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;"><h2>Quarterly Compliance Summary</h2><ul>${issues.map(i => `<li>${i}</li>`).join("")}</ul><p><a href="https://portal.salonenvyusa.com/staff/enrollments/audit-export" style="display:inline-block;padding:10px 20px;background:#7a8f96;color:#fff;border-radius:8px;text-decoration:none;">View Audit Dashboard</a></p></div>`,
      })
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true, issuesFound: issues.length, issues })
}
