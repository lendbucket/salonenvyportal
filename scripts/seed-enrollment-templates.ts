/**
 * Seeds the 4 default enrollment templates.
 * Idempotent — skips existing templates by name.
 * Run: npm run seed:enrollment-templates
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const TEMPLATES = [
  {
    name: "stylist_1099_booth",
    displayName: "Stylist (1099 Booth Rental)",
    description: "Standard independent contractor stylist on booth rental. Requires W-9, TDLR license, liability insurance, NDA, and compensation agreement. Does NOT require I-9, E-Verify, or state tax withholding.",
    defaultCompensationType: "BOOTH_RENTAL",
    requiredSteps: {
      personal_info: true, email_verified: true, phone_verified: true,
      license_verified: true, gov_id_uploaded: true, insurance_uploaded: true,
      w9_complete: true, state_tax_complete: false, dd_complete: true,
      nda_signed: true, comp_agreement_signed: true,
      i9_section_1_complete: false, i9_section_2_complete: false,
      bg_check: false, everify: false,
    },
  },
  {
    name: "stylist_w2_hourly",
    displayName: "Stylist (W-2 Hourly)",
    description: "W-2 employee stylist. Full compliance requirements including I-9, E-Verify, state tax, background check, license, and insurance.",
    defaultCompensationType: "W2_HOURLY",
    requiredSteps: {
      personal_info: true, email_verified: true, phone_verified: true,
      license_verified: true, gov_id_uploaded: true, insurance_uploaded: true,
      w9_complete: true, state_tax_complete: true, dd_complete: true,
      nda_signed: true, comp_agreement_signed: true,
      i9_section_1_complete: true, i9_section_2_complete: true,
      bg_check: true, everify: true,
    },
  },
  {
    name: "manager_w2",
    displayName: "Manager (W-2)",
    description: "W-2 salon manager. Requires W-9, I-9, E-Verify, background check, NDA, and compensation agreement. Does NOT require cosmetology license or liability insurance.",
    defaultCompensationType: "W2_HOURLY",
    requiredSteps: {
      personal_info: true, email_verified: true, phone_verified: true,
      license_verified: false, gov_id_uploaded: true, insurance_uploaded: false,
      w9_complete: true, state_tax_complete: true, dd_complete: true,
      nda_signed: true, comp_agreement_signed: true,
      i9_section_1_complete: true, i9_section_2_complete: true,
      bg_check: true, everify: true,
    },
  },
  {
    name: "receptionist_w2",
    displayName: "Receptionist (W-2 Part-Time)",
    description: "W-2 part-time receptionist. Same requirements as manager (no license or insurance). Background check required.",
    defaultCompensationType: "W2_HOURLY",
    requiredSteps: {
      personal_info: true, email_verified: true, phone_verified: true,
      license_verified: false, gov_id_uploaded: true, insurance_uploaded: false,
      w9_complete: true, state_tax_complete: true, dd_complete: true,
      nda_signed: true, comp_agreement_signed: true,
      i9_section_1_complete: true, i9_section_2_complete: true,
      bg_check: true, everify: true,
    },
  },
]

async function main() {
  console.log("Seeding enrollment templates...")
  for (const tmpl of TEMPLATES) {
    const existing = await prisma.enrollmentTemplate.findUnique({ where: { name: tmpl.name } })
    if (existing) {
      console.log(`  ${tmpl.name} — already exists, skipping`)
      continue
    }
    await prisma.enrollmentTemplate.create({ data: tmpl })
    console.log(`  ${tmpl.name} — created`)
  }
  console.log("Done.")
}

main().catch(e => { console.error("Seed failed:", e); process.exit(1) }).finally(() => prisma.$disconnect())
