# Email Marketing Runbook

## DNS Setup for marketing.salonenvyusa.com

Add these records at your DNS provider (Cloudflare).

### MX Record

| Field    | Value                                      |
|----------|--------------------------------------------|
| Name     | marketing                                  |
| Type     | MX                                         |
| Priority | 10                                         |
| Value    | feedback-smtp.us-east-1.amazonses.com      |

### SPF Record

| Field | Value                                      |
|-------|--------------------------------------------|
| Name  | marketing                                  |
| Type  | TXT                                        |
| Value | `v=spf1 include:amazonses.com ~all`        |

### DKIM Records (3 CNAME records)

These are provided by Resend after adding the domain. Steps:

1. Log into [Resend dashboard](https://resend.com/domains)
2. Domains > Add Domain > `marketing.salonenvyusa.com`
3. Copy the 3 DKIM CNAME records Resend provides
4. Add all 3 to Cloudflare DNS
5. Wait 24-48 hours for propagation
6. Click "Verify" in Resend dashboard

Typical DKIM records look like:

| Name                                             | Type  | Value                                        |
|--------------------------------------------------|-------|----------------------------------------------|
| resend._domainkey.marketing.salonenvyusa.com     | CNAME | (provided by Resend)                         |
| s1._domainkey.marketing.salonenvyusa.com         | CNAME | (provided by Resend)                         |
| s2._domainkey.marketing.salonenvyusa.com         | CNAME | (provided by Resend)                         |

### DMARC Record (recommended)

| Field | Value                                                              |
|-------|--------------------------------------------------------------------|
| Name  | _dmarc.marketing                                                   |
| Type  | TXT                                                                |
| Value | `v=DMARC1; p=none; rua=mailto:dmarc@salonenvyusa.com`             |

---

## Domain Warming Schedule

New sending domains MUST be warmed before high-volume sends. Sending too many emails too fast on a new domain will trigger spam filters and damage sender reputation.

| Day  | Volume   | Audience                               |
|------|----------|----------------------------------------|
| 1    | 50       | Internal team / test list              |
| 2    | 100      | Most engaged clients (opened recently) |
| 3    | 250      | Engaged clients                        |
| 4    | 500      | Engaged clients                        |
| 5    | 1,000    | Engaged + active clients               |
| 6    | 2,500    | Active clients                         |
| 7+   | 5,000+   | Full audience as needed                |

Use the audience builder's filters to target engaged subsets:
- BY_LAST_VISIT < 30 days (recently active)
- BY_VISIT_COUNT min 3+ (regular clients)
- BY_TOTAL_SPEND min $200+ (invested clients)

Run `npm run warm:email-domain` to generate warming audience definitions.

---

## Sender Reputation Best Practices

1. **Always include unsubscribe link** - auto-included by all templates
2. **Never send to bounced addresses** - auto-suppressed by webhook (hard bounces disable the contact)
3. **Monitor complaint rate** - must stay below 0.1%. Over this triggers Resend warnings and can lead to domain suspension
4. **Stagger sends** - don't blast full audience at midnight. Spread throughout the day
5. **Clean your list** - contacts with 0 opens across 5+ sends should be moved to a suppression list
6. **Subject line hygiene** - avoid ALL CAPS, excessive punctuation (!!!), and spam trigger words
7. **Warm new IPs/domains gradually** - follow the schedule above

---

## Environment Variables

| Variable               | Where to set | Description                            |
|------------------------|--------------|----------------------------------------|
| RESEND_API_KEY         | Vercel env   | Already set (existing transactional)   |
| RESEND_WEBHOOK_SECRET  | Vercel env   | Svix signing secret from Resend        |

### Setting up the webhook

1. Go to [Resend Webhooks](https://resend.com/webhooks)
2. Create endpoint: `https://portal.salonenvyusa.com/api/resend/webhook`
3. Select events: email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained, email.unsubscribed
4. Copy the signing secret
5. Add to Vercel: `vercel env add RESEND_WEBHOOK_SECRET`

---

## Post-Deploy Checklist

- [ ] Run `npm run backfill:email-contacts` to create EmailContact records from existing clients
- [ ] Verify EmailContact count matches clients with email addresses
- [ ] Add marketing.salonenvyusa.com domain in Resend dashboard
- [ ] Add DNS records to Cloudflare (MX, SPF, 3x DKIM, DMARC)
- [ ] Wait 24-48h for DNS propagation
- [ ] Verify domain in Resend dashboard
- [ ] Set RESEND_WEBHOOK_SECRET env var in Vercel
- [ ] Send test email from composer to verify delivery
- [ ] Begin Day 1 warming (50 emails to engaged subset)
- [ ] Monitor Resend dashboard for bounce/complaint rates daily during warming
