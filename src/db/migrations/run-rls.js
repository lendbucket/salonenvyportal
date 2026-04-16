const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const tables = [
  "users", "locations", "staff_members", "inventory_items", "schedules", "shifts",
  "verification_tokens", "accounts", "sessions", "admin_alerts", "alert_reads",
  "purchase_orders", "purchase_order_items", "anonymous_complaints", "conduct_records",
  "onboarding_enrollments", "suite_subscriptions", "tax_receipts", "mileage_logs",
  "quarterly_payments", "tax_years", "credit_profiles", "dispute_letters",
  "income_verifications", "insurance_profiles", "incident_reports", "other_income",
  "edu_courses", "course_completions", "tdlr_license_renewals", "health_profiles",
  "video_submissions", "payroll_periods", "payroll_entries", "audit_logs",
  "social_posts", "social_tokens", "social_comments", "social_analytics",
  "system_settings", "waitlist_entries", "tdlr_license_cache", "tdlr_cache_metadata",
  "clients", "client_formulas", "card_on_file_requests", "appointment_notes",
  "financial_accounts", "bank_transactions", "expenses", "invoices",
  "booth_rentals", "booth_rental_payments", "tax_records", "contractor_payments",
  "business_models", "offboarding_records",
];

async function run() {
  console.log("=== Enabling RLS on all tables ===\n");

  let enabled = 0;
  let failed = 0;
  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`
      );
      console.log("  RLS enabled:", t);
      enabled++;
    } catch (e) {
      console.error("  FAILED:", t, e.message);
      failed++;
    }
  }
  console.log(`\nRLS: ${enabled} enabled, ${failed} failed\n`);

  console.log("=== Creating access policies ===\n");

  let policies = 0;
  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `DROP POLICY IF EXISTS service_role_full_access ON public.${t}`
      );
      await prisma.$executeRawUnsafe(
        `CREATE POLICY service_role_full_access ON public.${t} FOR ALL TO service_role USING (true) WITH CHECK (true)`
      );
      await prisma.$executeRawUnsafe(
        `DROP POLICY IF EXISTS postgres_full_access ON public.${t}`
      );
      await prisma.$executeRawUnsafe(
        `CREATE POLICY postgres_full_access ON public.${t} FOR ALL TO postgres USING (true) WITH CHECK (true)`
      );
      console.log("  Policies created:", t);
      policies++;
    } catch (e) {
      console.error("  Policy FAILED:", t, e.message);
    }
  }
  console.log(`\nPolicies: ${policies} tables configured\n`);

  // Verify
  const result = await prisma.$queryRaw`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  console.log("=== RLS VERIFICATION ===\n");
  let rlsOn = 0;
  let rlsOff = 0;
  for (const r of result) {
    const status = r.rowsecurity ? "ENABLED" : "DISABLED";
    if (r.rowsecurity) rlsOn++;
    else rlsOff++;
    console.log(`  ${status.padEnd(9)} ${r.tablename}`);
  }
  console.log(`\nTotal: ${rlsOn + rlsOff} | RLS ON: ${rlsOn} | RLS OFF: ${rlsOff}`);

  if (rlsOff > 0) {
    console.log("\nWARNING: Some tables still have RLS disabled!");
  } else {
    console.log("\nAll tables have RLS enabled.");
  }

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
