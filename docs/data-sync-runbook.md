# Data Sync Runbook

## Overview

The data sync system pulls data from Square APIs into local Postgres via Prisma, then computes client metrics from the synced data. All workers share the same architecture: monthly chunking, cursor-based pagination, 35s soft deadline, batch transactions of 25, and error isolation.

## Initial Sync Order

Run these in sequence for a fresh environment:

1. **Clients sync** — must run first since orders and appointments reference client records
2. **Orders sync** — pulls all orders with line items for the past 24 months
3. **Appointments sync** — pulls all bookings for the past 24 months
4. **Client metrics** — computes aggregates from orders + appointments data

### Triggering Initial Sync

From the portal UI:
- Navigate to `/data-sync` (owner-only)
- Click "Sync now" for each type in order
- Wait for each to complete before starting the next

From the API:
```bash
# Clients
curl -X POST https://your-domain.com/api/clients/sync -H "Cookie: ..."

# Orders
curl -X POST https://your-domain.com/api/orders/sync -H "Cookie: ..."

# Appointments
curl -X POST https://your-domain.com/api/appointments/sync -H "Cookie: ..."

# Metrics (one-time backfill)
npm run backfill:client-metrics
```

## Verification Steps

After a full sync completes, verify with the health endpoint:

```bash
curl https://your-domain.com/api/sync/health -H "Cookie: ..."
```

Expected response includes:
- `counts.clients` > 0
- `counts.orders` > 0
- `counts.appointments` > 0
- `counts.metricsComputed` should equal `counts.clients`
- `revenue.totalCompleted` should be reasonable for your salon

## Ongoing Operations

### Cron Schedule

| Job | Schedule | Purpose |
|-----|----------|---------|
| clients-sync | Every minute | Processes running client sync jobs |
| orders-sync | Every minute | Processes running order sync jobs |
| appointments-sync | Every minute | Processes running appointment sync jobs |
| compute-metrics | Every 6 hours | Recomputes client metrics (200 clients/tick) |

### Monitoring

- Check `/data-sync` page for sync status and errors
- Check `/api/sync/health` for aggregate counts
- Sync jobs auto-fail after 5 non-transient errors
- Stale jobs (no progress for 5 minutes) are marked as failed by the cron

### Re-running a Sync

If a sync fails or data needs refreshing:
1. The failed job will no longer block new jobs
2. Simply click "Sync now" again to start a fresh job
3. The new job starts from month 0 and works forward

## Hard Rules

1. **NEVER** use `--force-reset` or `--accept-data-loss` with Prisma migrations
2. **NO** schema changes without explicit approval — schema is already deployed
3. All workers use fresh `PrismaClient` per invocation with `$disconnect()` in `finally`
4. 35-second soft deadline per invocation — workers checkpoint and resume on next cron tick
5. Batch `$transaction` of 25 operations maximum
6. Error isolation: individual record failures don't crash the entire batch
7. Monthly chunking: 24 months back, one month at a time per location
8. Locations are hardcoded: `LTJSA6QR1HGW6` and `LXJYXDXWR0XZF`

## Architecture

```
Cron tick (every minute)
  -> Finds running SyncJob
  -> Calls worker's processBatch(jobId)
  -> Worker fetches page from Square API
  -> Upserts records in batches of 25
  -> Checkpoints cursor to SyncJob.cursor
  -> Returns when deadline hit or all data processed
  -> Next cron tick continues from checkpoint
```

## Environment Variables Required

- `SQUARE_ACCESS_TOKEN` — Square API bearer token
- `CRON_SECRET` — Bearer token for cron endpoint authentication
- `DATABASE_URL` — Postgres connection string
