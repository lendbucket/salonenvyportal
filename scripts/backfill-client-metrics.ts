/**
 * Fast Backfill — Client Metrics
 * Computes lifetimeSpend, totalVisits, lastVisitAt, vipTier, valueTier, etc.
 * for all clients in a single SQL aggregation pass.
 *
 * Replaces old per-client loop (3-4 hours) with bulk SQL (~30 seconds).
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Tier thresholds (in days)
const ACTIVE_DAYS = 30
const RECENT_DAYS = 60
const AT_RISK_DAYS = 90
const LAPSED_DAYS = 180
// >180 days = DEAD

async function main() {
  console.log("[backfill] Starting fast SQL-based metric computation...")
  const startTime = Date.now()

  // Step 1: Use a single CTE-based query to compute aggregations for ALL clients at once
  console.log("[backfill] Computing payment aggregations from square_payments...")

  await prisma.$executeRawUnsafe(`
    WITH payment_aggs AS (
      SELECT
        "clientId",
        SUM("totalAmount" - COALESCE("refundedAmount", 0)) AS total_spend,
        COUNT(DISTINCT DATE("createdAtSquare")) AS visit_count,
        MAX("createdAtSquare") AS last_visit_at,
        MIN("createdAtSquare") AS first_visit_at
      FROM square_payments
      WHERE status = 'COMPLETED' AND "clientId" IS NOT NULL
      GROUP BY "clientId"
    ),
    appt_aggs AS (
      SELECT
        "clientId",
        COUNT(*) AS total_appts,
        COUNT(*) FILTER (WHERE status = 'NO_SHOW') AS no_shows,
        COUNT(*) FILTER (WHERE status IN ('DECLINED_BY_CUSTOMER', 'DECLINED_BY_SELLER', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SELLER')) AS cancellations
      FROM square_appointments
      WHERE "clientId" IS NOT NULL
      GROUP BY "clientId"
    ),
    spend_percentiles AS (
      SELECT
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_spend) AS p90,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_spend) AS p75,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_spend) AS p25
      FROM payment_aggs
      WHERE total_spend > 0
    )
    UPDATE clients c
    SET
      "lifetimeSpend" = COALESCE(p.total_spend, 0),
      "totalVisits" = COALESCE(p.visit_count, 0),
      "lastVisitAt" = p.last_visit_at,
      "lastOrderAt" = p.last_visit_at,
      "firstVisitAt" = p.first_visit_at,
      "averageTicket" = CASE
        WHEN COALESCE(p.visit_count, 0) > 0 THEN COALESCE(p.total_spend, 0) / p.visit_count
        ELSE 0
      END,
      "totalNoShows" = COALESCE(a.no_shows, 0),
      "totalCancellations" = COALESCE(a.cancellations, 0),
      "valueTier" = CASE
        WHEN COALESCE(p.total_spend, 0) = 0 THEN 'NONE'
        WHEN p.total_spend >= sp.p90 THEN 'BIG_SPENDER'
        WHEN p.total_spend >= sp.p75 THEN 'VALUABLE'
        WHEN p.total_spend >= sp.p25 THEN 'AVERAGE'
        ELSE 'LOW_VALUE'
      END,
      "vipTier" = CASE
        WHEN p.last_visit_at IS NULL THEN 'NEVER'
        WHEN p.last_visit_at >= NOW() - INTERVAL '${ACTIVE_DAYS} days' AND p.total_spend >= sp.p90 THEN 'VIP'
        WHEN p.last_visit_at >= NOW() - INTERVAL '${ACTIVE_DAYS} days' THEN 'ACTIVE'
        WHEN p.last_visit_at >= NOW() - INTERVAL '${RECENT_DAYS} days' THEN 'AT_RISK'
        WHEN p.last_visit_at >= NOW() - INTERVAL '${AT_RISK_DAYS} days' THEN 'LAPSED'
        WHEN p.last_visit_at >= NOW() - INTERVAL '${LAPSED_DAYS} days' THEN 'DEAD'
        ELSE 'NEVER'
      END,
      "engagementScore" = CASE
        WHEN p.total_spend IS NULL OR p.total_spend = 0 THEN 0
        ELSE LEAST(100, GREATEST(0,
          (50 * EXP(-EXTRACT(EPOCH FROM (NOW() - p.last_visit_at)) / (90 * 86400)))::int +
          (50 * LEAST(p.total_spend / sp.p90, 1.0))::int
        ))
      END,
      "churnRiskScore" = CASE
        WHEN p.last_visit_at IS NULL THEN 1.0
        WHEN p.last_visit_at >= NOW() - INTERVAL '30 days' THEN 0.1
        WHEN p.last_visit_at >= NOW() - INTERVAL '60 days' THEN 0.3
        WHEN p.last_visit_at >= NOW() - INTERVAL '90 days' THEN 0.6
        WHEN p.last_visit_at >= NOW() - INTERVAL '180 days' THEN 0.85
        ELSE 0.95
      END,
      "metricsLastComputedAt" = NOW()
    FROM clients c2
    LEFT JOIN payment_aggs p ON p."clientId" = c2.id
    LEFT JOIN appt_aggs a ON a."clientId" = c2.id
    CROSS JOIN spend_percentiles sp
    WHERE c.id = c2.id;
  `)

  // Step 2: Compute predicted next visit + days between visits for clients with multiple visits
  console.log("[backfill] Computing visit cadence and predictions...")

  await prisma.$executeRawUnsafe(`
    WITH visit_dates AS (
      SELECT
        "clientId",
        DATE("createdAtSquare") AS visit_date,
        LAG(DATE("createdAtSquare")) OVER (PARTITION BY "clientId" ORDER BY DATE("createdAtSquare")) AS prev_visit_date
      FROM square_payments
      WHERE status = 'COMPLETED' AND "clientId" IS NOT NULL
    ),
    cadence AS (
      SELECT
        "clientId",
        AVG(visit_date - prev_visit_date)::int AS avg_days_between_visits
      FROM visit_dates
      WHERE prev_visit_date IS NOT NULL
      GROUP BY "clientId"
    )
    UPDATE clients c
    SET
      "daysBetweenVisits" = cadence.avg_days_between_visits,
      "predictedNextVisitAt" = c."lastVisitAt" + (cadence.avg_days_between_visits || ' days')::interval
    FROM cadence
    WHERE c.id = cadence."clientId"
      AND c."lastVisitAt" IS NOT NULL
      AND cadence.avg_days_between_visits IS NOT NULL;
  `)

  // Step 3: Set favorite stylist (most-frequent staffMemberId on payments)
  console.log("[backfill] Computing favorite stylists...")

  await prisma.$executeRawUnsafe(`
    WITH stylist_counts AS (
      SELECT
        "clientId",
        "staffMemberId",
        COUNT(*) AS visit_count,
        ROW_NUMBER() OVER (PARTITION BY "clientId" ORDER BY COUNT(*) DESC) AS rn
      FROM square_payments
      WHERE status = 'COMPLETED'
        AND "clientId" IS NOT NULL
        AND "staffMemberId" IS NOT NULL
      GROUP BY "clientId", "staffMemberId"
    ),
    favorites AS (
      SELECT "clientId", "staffMemberId", visit_count
      FROM stylist_counts
      WHERE rn = 1
    ),
    totals AS (
      SELECT "clientId", COUNT(*) AS total_visits
      FROM square_payments
      WHERE status = 'COMPLETED' AND "clientId" IS NOT NULL
      GROUP BY "clientId"
    )
    UPDATE clients c
    SET
      "favoriteStaffMemberId" = f."staffMemberId",
      "loyaltyScore" = CASE
        WHEN t.total_visits > 0 THEN ROUND((f.visit_count::float / t.total_visits) * 100)::int
        ELSE 0
      END
    FROM favorites f
    JOIN totals t ON t."clientId" = f."clientId"
    WHERE c.id = f."clientId";
  `)

  // Step 4: Print results summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*) AS total_clients,
      COUNT(*) FILTER (WHERE "lifetimeSpend" > 0) AS paying_clients,
      ROUND(SUM("lifetimeSpend")::numeric, 2) AS total_lifetime_revenue,
      ROUND(AVG("lifetimeSpend") FILTER (WHERE "lifetimeSpend" > 0)::numeric, 2) AS avg_paying_client_spend,
      ROUND(MAX("lifetimeSpend")::numeric, 2) AS max_lifetime_spend,
      COUNT(*) FILTER (WHERE "vipTier" = 'VIP') AS vip,
      COUNT(*) FILTER (WHERE "vipTier" = 'ACTIVE') AS active,
      COUNT(*) FILTER (WHERE "vipTier" = 'AT_RISK') AS at_risk,
      COUNT(*) FILTER (WHERE "vipTier" = 'LAPSED') AS lapsed,
      COUNT(*) FILTER (WHERE "vipTier" = 'DEAD') AS dead,
      COUNT(*) FILTER (WHERE "vipTier" = 'NEVER') AS never_visited,
      COUNT(*) FILTER (WHERE "valueTier" = 'BIG_SPENDER') AS big_spenders,
      COUNT(*) FILTER (WHERE "valueTier" = 'VALUABLE') AS valuable,
      COUNT(*) FILTER (WHERE "valueTier" = 'AVERAGE') AS average,
      COUNT(*) FILTER (WHERE "valueTier" = 'LOW_VALUE') AS low_value,
      COUNT(*) FILTER (WHERE "valueTier" = 'NONE') AS no_value
    FROM clients;
  `)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log("\n[backfill] COMPLETE in " + elapsed + "s")
  console.log("\n=== RESULTS ===")
  console.log(JSON.stringify(summary[0], null, 2))
}

main()
  .catch((e) => { console.error("[backfill] FAILED:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
