-- ============================================================================
-- CRITICAL SECURITY FIX: Enable Row Level Security on ALL tables
-- ============================================================================
-- Supabase exposes tables via PostgREST. Without RLS, any authenticated
-- (or anonymous) client can read/write every row. Our app uses the
-- service_role key from Next.js API routes which bypasses RLS, so enabling
-- RLS + a service_role policy keeps the API working while blocking direct
-- browser access via the anon key.
--
-- Run this in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/jzenfldyopczopivqoxw/sql/new
-- ============================================================================

-- Step 1: Enable RLS on every table
-- (Uses actual Postgres table names from @@map in schema.prisma)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conduct_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdlr_license_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdlr_license_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdlr_cache_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_on_file_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_rental_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_records ENABLE ROW LEVEL SECURITY;

-- Step 2: Create service_role full-access policy on every public table
-- The service_role key is used by our Next.js API (server-side only).
-- This policy lets the API operate normally while RLS blocks direct access.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- Drop existing policy if it exists (idempotent)
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON public.%I', t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    -- Create the policy
    EXECUTE format(
      'CREATE POLICY "service_role_full_access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Step 3: Also allow the postgres role (used by Prisma via direct connection)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "postgres_full_access" ON public.%I', t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    EXECUTE format(
      'CREATE POLICY "postgres_full_access" ON public.%I FOR ALL TO postgres USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Verify: list all tables and their RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
