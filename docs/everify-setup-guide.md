# E-Verify Setup Guide

## What is E-Verify?

E-Verify is a web-based system run by the U.S. Department of Homeland Security (DHS) in partnership with the Social Security Administration (SSA). It allows enrolled employers to confirm the identity and employment eligibility of newly hired employees.

E-Verify is **required** for:
- Federal contractors
- Employers in states with E-Verify mandates

E-Verify is **recommended** (but currently optional) for Texas private employers.

## When to Use E-Verify

At Salon Envy, E-Verify should be used for **W-2 employees only** (not 1099 independent contractors). It is submitted **after** the I-9 form is completed.

## Enrollment Steps

### Step 1: Visit the E-Verify Website
Go to: https://www.e-verify.gov/employers/enrolling-in-e-verify

### Step 2: Choose Enrollment Type
- **Employer**: You manage E-Verify directly
- **E-Verify Employer Agent**: A third party manages E-Verify on your behalf (e.g., your PEO or HR provider)
- **Web Services**: For automated integration (what our portal will use once approved)

**Recommended**: Start with **Employer** enrollment. Switch to **Web Services** later for portal integration.

### Step 3: Sign the Memorandum of Understanding (MOU)
- The MOU is the legal agreement between your company and DHS/SSA
- Must be signed by an authorized representative of Salon Envy USA LLC
- Usually the owner (Robert Reyna) or a designated agent

### Step 4: Complete Training
- E-Verify requires all users to complete a training tutorial
- Takes approximately 30 minutes
- Must be completed before first case submission

### Step 5: Receive Credentials
- After MOU signing and training, you'll receive login credentials
- **Company ID Number**: Unique to Salon Envy
- **Program Administrator User ID**: Your admin login

### Step 6: Web Services Integration (Future)
- After operating E-Verify manually for at least 3 months
- Apply for Web Services access to enable automated submission from portal
- USCIS provides sandbox credentials for testing
- After testing approval, production credentials are issued

## Expected Timeline
- MOU signing: 1-3 business days
- Training completion: Same day
- First case submission: Immediately after training
- Web Services approval: 2-4 weeks after application

## Cost
E-Verify is **free** for employers.

## Important Compliance Notes
- Cases must be submitted within 3 business days of hire date (same as I-9 Section 2)
- You cannot pre-screen applicants using E-Verify (illegal)
- You cannot use E-Verify to reverify existing employees
- All Tentative Non-Confirmations (TNCs) must be referred to the employee for resolution

## Environment Variables (once approved)
Add to Vercel:
- `EVERIFY_COMPANY_ID` — Your E-Verify Company ID
- `EVERIFY_USER_ID` — Web Services API user ID
- `EVERIFY_PASSWORD` — Web Services API password
- `EVERIFY_ENVIRONMENT` — "sandbox" or "production"
