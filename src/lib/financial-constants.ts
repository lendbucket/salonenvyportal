/** Financial constants and tax calculation utilities for Salon Envy */

export const EXPENSE_CATEGORIES = [
  "Rent & Lease",
  "Utilities",
  "Supplies & Products",
  "Equipment",
  "Marketing & Advertising",
  "Insurance",
  "Software & Subscriptions",
  "Payroll & Commissions",
  "Repairs & Maintenance",
  "Professional Services",
  "Training & Education",
  "Travel",
  "Licenses & Permits",
  "Taxes & Fees",
  "Miscellaneous",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const BUSINESS_MODELS = [
  { value: "commission", label: "Commission-Based", description: "Stylists earn a percentage of service revenue" },
  { value: "booth_rental", label: "Booth Rental", description: "Stylists rent booth space at a fixed rate" },
  { value: "suite_rental", label: "Suite Rental", description: "Stylists rent a private suite" },
  { value: "hybrid", label: "Hybrid", description: "Combination of commission and rental models" },
  { value: "w2_employee", label: "W-2 Employee", description: "Stylists are salaried or hourly employees" },
] as const

export const TEXAS_SALES_TAX_RATE = 0.0825

export const FEDERAL_INCOME_TAX_BRACKETS_2026 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
] as const

export const SELF_EMPLOYMENT_TAX_RATE = 0.1530
export const SE_TAX_DEDUCTION = 0.5

export function calculateEstimatedTaxes(netIncome: number) {
  // Self-employment tax
  const selfEmploymentTax = netIncome * SELF_EMPLOYMENT_TAX_RATE

  // SE tax deduction (half of SE tax is deductible)
  const seDeduction = selfEmploymentTax * SE_TAX_DEDUCTION
  const adjustedIncome = netIncome - seDeduction

  // Federal income tax using progressive brackets
  let federalIncomeTax = 0
  for (const bracket of FEDERAL_INCOME_TAX_BRACKETS_2026) {
    if (adjustedIncome <= bracket.min) break
    const taxableInBracket = Math.min(adjustedIncome, bracket.max) - bracket.min
    federalIncomeTax += taxableInBracket * bracket.rate
  }

  const totalEstimated = selfEmploymentTax + federalIncomeTax
  const quarterlyPayment = totalEstimated / 4

  return {
    selfEmploymentTax: Math.round(selfEmploymentTax * 100) / 100,
    federalIncomeTax: Math.round(federalIncomeTax * 100) / 100,
    totalEstimated: Math.round(totalEstimated * 100) / 100,
    quarterlyPayment: Math.round(quarterlyPayment * 100) / 100,
  }
}
