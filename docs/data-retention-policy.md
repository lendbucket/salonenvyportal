# Data Retention Policy — Salon Envy Onboarding

## Active Enrollments
- **Retention**: Kept indefinitely while stylist is active
- **Reason**: Legal/tax compliance, employment records
- **Access**: OWNER and MANAGER roles only

## Cancelled / Rejected Enrollments
- **Retention**: Deleted on request OR auto-deleted after 90 days
- **Method**: POST /api/onboarding/admin/[id]/delete (OWNER only)
- **What's deleted**: All PII, uploaded documents, bank/SSN data
- **What's retained**: Audit log entries (7-year retention)

## Expired Enrollments
- **Retention**: Auto-deleted after 90 days of expiry
- **Reason**: No ongoing business relationship established

## Audit Logs
- **Retention**: 7 years minimum
- **Reason**: Tax/legal compliance (IRS record-keeping requirements)
- **Contains**: Action type, timestamp, user ID, IP address
- **Does NOT contain**: PII values (SSN, bank numbers, etc.)

## Storage Buckets
- All onboarding storage buckets (signatures, licenses, gov-ids, insurance, agreements, i9) follow the same retention as their parent enrollment
- Files are cascade-deleted when enrollment is deleted

## CCPA/GDPR Compliance
- Stylists can request deletion via their enrollment token (cancelled/rejected/expired only)
- Active stylists must be terminated before data deletion is possible
- Owner can initiate deletion for any non-active enrollment
- Deletion is permanent and irreversible
- Confirmation email sent to stylist after successful deletion

## Contact
- Data requests: ceo@36west.org
- Privacy inquiries: ceo@36west.org
