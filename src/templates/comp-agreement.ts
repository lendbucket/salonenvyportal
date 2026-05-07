/**
 * Compensation agreement template for Salon Envy contractors.
 * DRAFT VERSION — REPLACE WITH LAWYER-APPROVED TEXT BEFORE PRODUCTION USE.
 */

export function generateCompAgreementText(data: {
  stylistName: string
  locationName: string
  effectiveDate: string
  compensationType: string
  boothRentalAmount?: number
  commissionPercent?: number
  paymentSchedule: string
  startDate: string
}): string {
  const compDescription = (() => {
    switch (data.compensationType) {
      case "BOOTH_RENTAL":
        return `Booth Rental: $${data.boothRentalAmount?.toFixed(2) || "0.00"} per month, due on the 1st of each month.`
      case "COMMISSION":
        return `Commission: ${data.commissionPercent || 0}% of gross service revenue collected.`
      case "HYBRID":
        return `Hybrid: $${data.boothRentalAmount?.toFixed(2) || "0.00"} monthly booth fee plus ${data.commissionPercent || 0}% commission on gross service revenue.`
      case "W2_HOURLY":
        return `W-2 Hourly Employment: Hourly rate to be set by Company. Subject to applicable tax withholding.`
      default:
        return `Compensation terms to be determined.`
    }
  })()

  const scheduleLabel: Record<string, string> = {
    WEEKLY: "Weekly (every Tuesday for the prior Wednesday-Tuesday period)",
    BIWEEKLY: "Bi-weekly (every other Tuesday)",
    MONTHLY: "Monthly (on the 1st of the following month)",
  }

  return `INDEPENDENT CONTRACTOR / COMPENSATION AGREEMENT

This Agreement is entered into as of ${data.effectiveDate} by and between Salon Envy USA LLC ("Company") and ${data.stylistName} ("Contractor") for services at the ${data.locationName} location.

1. COMPENSATION
${compDescription}

2. PAYMENT SCHEDULE
Payments will be made ${scheduleLabel[data.paymentSchedule] || data.paymentSchedule}.

3. START DATE
Contractor's services shall commence on ${data.startDate}.

4. INDEPENDENT CONTRACTOR STATUS
${data.compensationType === "W2_HOURLY"
    ? "Contractor is classified as a W-2 employee for tax purposes. Company will withhold applicable federal, state, and local taxes."
    : "Contractor is an independent contractor and is responsible for their own tax obligations, including self-employment tax, estimated quarterly payments, and filing Schedule C (Form 1040)."
}

5. SUPPLIES AND EQUIPMENT
Contractor shall provide their own tools, supplies, and products unless otherwise agreed upon in writing.

6. TERMINATION
Either party may terminate this agreement with 14 days written notice.

7. NON-COMPETE
Contractor agrees not to solicit Company's clients for a period of 12 months following termination of this agreement within a 25-mile radius of the ${data.locationName} location.

8. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Texas.

--- DRAFT VERSION ---
This template must be reviewed and approved by legal counsel before use in production.
--- END DRAFT ---

ACKNOWLEDGED AND AGREED:

Contractor: ${data.stylistName}
Location: ${data.locationName}
Date: ${data.effectiveDate}
`
}
