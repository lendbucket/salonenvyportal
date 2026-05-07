export type AgentName = "reyna_recovery" | "no_show_predictor" | "cross_sell" | "stylist_coach" | "inventory"

export interface AgentRunResult {
  candidatesEvaluated: number
  draftsCreated: number
  errors: string[]
}

export interface DraftSpec {
  clientId: string
  reasoning: string
  priority: number
  messageBody: string
  proposedOffer?: string
  proposedSendAt: Date
}
