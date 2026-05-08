/**
 * Bulk invite processing for CSV uploads.
 * Validates rows, creates enrollments, sends emails.
 */

import { generateToken } from "@/lib/crypto/invite-tokens"

export interface BulkInviteRow {
  rowNumber: number
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  role: string
  compensationType: string
  boothRentalAmount: string
  commissionPercent: string
  paymentSchedule: string
  startDate: string
}

export interface ValidationResult {
  row: BulkInviteRow
  isValid: boolean
  errors: string[]
  warnings: string[]
}

const VALID_LOCATIONS = ["CC", "SA"]
const VALID_ROLES = ["Stylist", "Manager", "Receptionist"]
const VALID_COMP_TYPES = ["BOOTH_RENTAL", "COMMISSION", "HYBRID", "W2_HOURLY"]
const VALID_SCHEDULES = ["WEEKLY", "BIWEEKLY", "MONTHLY"]
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseCsvText(text: string): BulkInviteRow[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []

  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""))
    return {
      rowNumber: i + 2,
      firstName: cols[0] || "",
      lastName: cols[1] || "",
      email: cols[2] || "",
      phone: cols[3] || "",
      location: cols[4] || "",
      role: cols[5] || "",
      compensationType: cols[6] || "",
      boothRentalAmount: cols[7] || "",
      commissionPercent: cols[8] || "",
      paymentSchedule: cols[9] || "",
      startDate: cols[10] || "",
    }
  }).filter(r => r.firstName || r.email)
}

export async function validateRows(rows: BulkInviteRow[]): Promise<ValidationResult[]> {
  const { prisma } = await import("@/lib/prisma")

  // Check existing emails
  const emails = rows.map(r => r.email.toLowerCase()).filter(Boolean)
  const existingEnrollments = await prisma.onboardingEnrollment.findMany({
    where: { email: { in: emails }, status: { notIn: ["cancelled", "rejected", "expired"] } },
    select: { email: true },
  })
  const existingEmails = new Set(existingEnrollments.map(e => e.email.toLowerCase()))

  return rows.map(row => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!row.firstName) errors.push("First name required")
    if (!row.lastName) errors.push("Last name required")
    if (!row.email) errors.push("Email required")
    else if (!EMAIL_REGEX.test(row.email)) errors.push("Invalid email format")
    else if (existingEmails.has(row.email.toLowerCase())) errors.push("Active enrollment already exists for this email")
    if (!VALID_LOCATIONS.includes(row.location)) errors.push(`Location must be CC or SA (got "${row.location}")`)
    if (!VALID_ROLES.includes(row.role)) errors.push(`Role must be Stylist, Manager, or Receptionist (got "${row.role}")`)
    if (!VALID_COMP_TYPES.includes(row.compensationType)) errors.push(`Invalid compensation type: ${row.compensationType}`)
    if ((row.compensationType === "BOOTH_RENTAL" || row.compensationType === "HYBRID") && !row.boothRentalAmount) errors.push("Booth rental amount required for this comp type")
    if ((row.compensationType === "COMMISSION" || row.compensationType === "HYBRID") && !row.commissionPercent) errors.push("Commission percent required for this comp type")
    if (row.commissionPercent && (Number(row.commissionPercent) < 0 || Number(row.commissionPercent) > 100)) errors.push("Commission must be 0-100")
    if (!VALID_SCHEDULES.includes(row.paymentSchedule)) errors.push(`Invalid payment schedule: ${row.paymentSchedule}`)
    if (row.startDate && new Date(row.startDate) < new Date()) warnings.push("Start date is in the past")
    if (!row.phone) warnings.push("No phone number — SMS invite won't be sent")

    return { row, isValid: errors.length === 0, errors, warnings }
  })
}

export async function createBulkInvites(rows: BulkInviteRow[]): Promise<{ created: number; failed: { row: number; error: string }[] }> {
  const { prisma } = await import("@/lib/prisma")

  // Resolve location IDs
  const locations = await prisma.location.findMany({ select: { id: true, name: true } })
  const locationMap: Record<string, string> = {}
  for (const loc of locations) {
    if (loc.name.includes("Corpus")) locationMap["CC"] = loc.id
    if (loc.name.includes("San Antonio") || loc.name.includes("SA")) locationMap["SA"] = loc.id
    locationMap[loc.id] = loc.id
  }

  let created = 0
  const failed: { row: number; error: string }[] = []

  for (const row of rows) {
    try {
      const { hash: tokenHash } = generateToken()
      const locationId = locationMap[row.location]
      if (!locationId) { failed.push({ row: row.rowNumber, error: "Location not found" }); continue }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const roleMap: Record<string, string> = { Stylist: "STYLIST", Manager: "MANAGER", Receptionist: "STYLIST" }

      await prisma.onboardingEnrollment.create({
        data: {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone || null,
          locationId,
          role: (roleMap[row.role] || "STYLIST") as "STYLIST" | "MANAGER",
          status: "invited",
          expiresAt,
          inviteTokenHash: tokenHash,
          compensationType: row.compensationType || null,
          boothRentalAmount: row.boothRentalAmount ? Number(row.boothRentalAmount) : null,
          commissionPercent: row.commissionPercent ? Number(row.commissionPercent) : null,
          paymentSchedule: row.paymentSchedule || null,
          startDate: row.startDate ? new Date(row.startDate) : null,
        },
      })

      // Send invite email (non-blocking)
      try {
        const { Resend } = await import("resend")
        const resend = new Resend(process.env.RESEND_API_KEY)
        const baseUrl = process.env.NEXTAUTH_URL || "https://portal.salonenvyusa.com"
        // Use the cuid inviteToken for the URL (auto-generated by Prisma)
        const enrollment = await prisma.onboardingEnrollment.findFirst({
          where: { email: row.email, status: "invited" },
          orderBy: { createdAt: "desc" },
          select: { inviteToken: true },
        })
        if (enrollment) {
          await resend.emails.send({
            from: "Salon Envy Team <team@salonenvyusa.com>",
            to: row.email,
            subject: `You're invited to join Salon Envy`,
            html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;"><h2>Hi ${row.firstName},</h2><p>You've been invited to join the Salon Envy team. Complete your onboarding to get started.</p><p><a href="${baseUrl}/onboarding/enroll/${enrollment.inviteToken}" style="display:inline-block;padding:12px 24px;background:#7a8f96;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Start Onboarding</a></p><p style="color:#9ca3af;font-size:12px;">This link expires in 7 days.</p></div>`,
          })
        }
      } catch { /* non-blocking */ }

      await prisma.auditLog.create({
        data: { action: "enrollment.bulk_invite.created", entity: "onboarding_enrollment", metadata: { email: row.email, role: row.role, location: row.location } },
      })

      created++
    } catch (err) {
      failed.push({ row: row.rowNumber, error: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  return { created, failed }
}
