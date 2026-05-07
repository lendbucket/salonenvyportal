/**
 * State-specific tax form requirements.
 * Returns the form type needed based on work state.
 */

export type StateTaxFormType = "TX_NONE" | "CA_DE4" | "NY_IT2104" | "GENERIC_W4_STATE"

const STATE_FORM_MAP: Record<string, { type: StateTaxFormType; label: string; description: string }> = {
  TX: { type: "TX_NONE", label: "None Required", description: "Texas does not have state income tax. No state withholding form needed." },
  CA: { type: "CA_DE4", label: "California DE 4", description: "California Employee's Withholding Allowance Certificate" },
  NY: { type: "NY_IT2104", label: "New York IT-2104", description: "Employee's Withholding Allowance Certificate" },
  FL: { type: "TX_NONE", label: "None Required", description: "Florida does not have state income tax." },
  NV: { type: "TX_NONE", label: "None Required", description: "Nevada does not have state income tax." },
  WA: { type: "TX_NONE", label: "None Required", description: "Washington does not have state income tax." },
}

const NO_INCOME_TAX_STATES = ["TX", "FL", "NV", "WA", "WY", "SD", "AK", "TN", "NH"]

export function getStateTaxRequirement(stateCode: string): {
  type: StateTaxFormType
  label: string
  description: string
  formRequired: boolean
} {
  const upper = stateCode.toUpperCase()
  const mapped = STATE_FORM_MAP[upper]
  if (mapped) {
    return { ...mapped, formRequired: !NO_INCOME_TAX_STATES.includes(upper) }
  }
  return {
    type: "GENERIC_W4_STATE",
    label: `${upper} State Withholding`,
    description: `State withholding form required for ${upper}. Contact ceo@36west.org for guidance.`,
    formRequired: true,
  }
}

export function isTexasHire(stateCode: string | null | undefined): boolean {
  return !stateCode || stateCode.toUpperCase() === "TX"
}
