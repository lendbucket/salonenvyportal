/**
 * NDA template for Salon Envy contractors.
 * DRAFT VERSION — REPLACE WITH LAWYER-APPROVED TEXT BEFORE PRODUCTION USE.
 */

export function generateNdaText(data: {
  stylistName: string
  stylistAddress: string
  salonName?: string
  salonAddress?: string
  effectiveDate: string
  locationName: string
}): string {
  const salon = data.salonName || "Salon Envy USA LLC"
  const salonAddr = data.salonAddress || "Corpus Christi, TX"

  return `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of ${data.effectiveDate} ("Effective Date") by and between:

${salon} ("Company"), located at ${salonAddr}, and

${data.stylistName} ("Recipient"), located at ${data.stylistAddress}.

1. CONFIDENTIAL INFORMATION
"Confidential Information" means all non-public information disclosed by Company to Recipient, including but not limited to: client lists, contact information, appointment histories, pricing strategies, business plans, financial information, proprietary techniques, product formulations, marketing strategies, and technology systems (including portal access credentials and internal tools).

2. OBLIGATIONS OF RECIPIENT
Recipient agrees to:
(a) Hold all Confidential Information in strict confidence;
(b) Not disclose Confidential Information to any third party without prior written consent of Company;
(c) Use Confidential Information solely for the purpose of performing services for Company;
(d) Take reasonable measures to protect the confidentiality of such information;
(e) Not copy, photograph, or otherwise reproduce Confidential Information except as necessary for authorized use.

3. EXCLUSIONS
This Agreement does not apply to information that:
(a) Is or becomes publicly available through no fault of Recipient;
(b) Was known to Recipient prior to disclosure by Company;
(c) Is independently developed by Recipient without use of Confidential Information;
(d) Is disclosed with the prior written approval of Company.

4. RETURN OF MATERIALS
Upon termination of the relationship between Company and Recipient, or upon request by Company, Recipient shall promptly return or destroy all Confidential Information and any copies thereof.

5. TERM
The obligations of confidentiality under this Agreement shall survive for a period of five (5) years following the termination of the relationship between Company and Recipient.

6. REMEDIES
Recipient acknowledges that any breach of this Agreement may cause irreparable harm to Company and that monetary damages may be inadequate. Company shall be entitled to seek equitable relief, including injunction and specific performance, in addition to all other remedies available at law or in equity.

7. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Texas.

8. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof.

--- DRAFT VERSION ---
This template must be reviewed and approved by legal counsel before use in production.
--- END DRAFT ---

ACKNOWLEDGED AND AGREED:

Recipient: ${data.stylistName}
Location: ${data.locationName}
Date: ${data.effectiveDate}
`
}
