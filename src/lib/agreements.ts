export function getStylistAgreement(data: {
  name: string
  location: string
  startDate: string
  commissionRate: number
}): string {
  return `
INDEPENDENT CONTRACTOR AGREEMENT — COSMETOLOGY SERVICES

This Independent Contractor Agreement ("Agreement") is entered into as of ${data.startDate} between:

SALON ENVY USA LLC ("Company")
A Texas Limited Liability Company
Corpus Christi, Texas

AND

${data.name} ("Contractor")

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee of Company. Contractor shall have no claim against Company for vacation pay, sick leave, retirement benefits, social security, workers compensation, health or disability benefits, unemployment insurance benefits, or employee benefits of any kind.

2. SERVICES
Contractor agrees to provide professional cosmetology services at Salon Envy ${data.location} location. Contractor shall maintain a valid Texas TDLR cosmetology license at all times.

3. COMPENSATION
Contractor shall receive ${data.commissionRate}% of the service subtotal for all services performed. Tips belong entirely to Contractor. Retail product sales commissions are negotiated separately. Payment is made weekly every Tuesday for the Wednesday-Tuesday pay period.

4. TAXES
Contractor is responsible for all federal, state, and local taxes on compensation received. Company will issue Form 1099-NEC for annual compensation of $600 or more.

5. CONFIDENTIALITY
Contractor agrees to keep confidential all client information, pricing, business practices, and proprietary information of Company.

6. CLIENT RELATIONSHIPS
Client relationships developed through Company resources and facilities belong to Company. Contractor may not solicit Company clients for a period of 12 months after termination of this Agreement.

7. TERM AND TERMINATION
This Agreement is at-will and may be terminated by either party with 2 weeks written notice.

8. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Texas.

By signing below, both parties agree to the terms of this Agreement.

Company: Salon Envy USA LLC
By: Robert Reyna, Owner

Contractor: ${data.name}
Signature: _______________
Date: ${data.startDate}
  `.trim()
}

export function getManagerAgreement(data: {
  name: string
  location: string
  startDate: string
  commissionRate: number
  managementFee?: number
}): string {
  return `
MANAGER INDEPENDENT CONTRACTOR AGREEMENT

This Manager Contractor Agreement ("Agreement") is entered into as of ${data.startDate} between:

SALON ENVY USA LLC ("Company")
A Texas Limited Liability Company
Corpus Christi, Texas

AND

${data.name} ("Manager Contractor")

1. INDEPENDENT CONTRACTOR STATUS
Manager Contractor is an independent contractor and not an employee of Company.

2. MANAGEMENT SERVICES
In addition to providing cosmetology services, Manager Contractor agrees to:
- Oversee daily salon operations at Salon Envy ${data.location}
- Manage and support stylist team members
- Handle opening and closing procedures
- Maintain salon standards and cleanliness
- Report operational issues to Owner
- Assist with scheduling and client relations
- Ensure compliance with TDLR regulations

3. COMPENSATION
Manager Contractor shall receive:
- ${data.commissionRate}% of service subtotal for personal services performed
- Management fee of $${data.managementFee || 0}/week for management responsibilities
- Tips belong entirely to Manager Contractor
- Payment made weekly every Tuesday

4. AUTHORITY LIMITS
Manager Contractor has authority to:
- Direct daily operations and staff scheduling
- Handle client complaints up to $100 value
- Order supplies up to $200 per order

Manager Contractor does NOT have authority to:
- Hire or terminate staff members
- Modify compensation agreements
- Enter into contracts on behalf of Company
- Access financial accounts

5. CONFIDENTIALITY
Manager Contractor agrees to maintain strict confidentiality of all business operations, financial information, client data, and proprietary systems.

6. TAXES
Manager Contractor is responsible for all applicable taxes. Company will issue Form 1099-NEC for annual compensation of $600 or more.

7. TERM AND TERMINATION
This Agreement is at-will and may be terminated by either party with 2 weeks written notice.

8. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Texas.

By signing below, both parties agree to the terms of this Agreement.

Company: Salon Envy USA LLC
By: Robert Reyna, Owner

Manager Contractor: ${data.name}
Signature: _______________
Date: ${data.startDate}
  `.trim()
}
