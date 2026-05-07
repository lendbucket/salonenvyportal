import * as React from "react"

const VIP_TIER_MAP: Record<string, { label: string; bg: string; text: string }> = {
  VIP: { label: "VIP", bg: "#d1f5f0", text: "#134e4a" },
  ACTIVE: { label: "Active", bg: "#dcfce7", text: "#166534" },
  AT_RISK: { label: "At Risk", bg: "#fef3c7", text: "#92400e" },
  LAPSED: { label: "Lapsed", bg: "#fee2e2", text: "#991b1b" },
  DEAD: { label: "Dead", bg: "#f3f4f6", text: "#6b7280" },
  NEVER: { label: "Never", bg: "#f3f4f6", text: "#9ca3af" },
}

const VALUE_TIER_MAP: Record<string, { label: string; bg: string; text: string }> = {
  BIG_SPENDER: { label: "Big Spender", bg: "#d1f5f0", text: "#134e4a" },
  VALUABLE: { label: "Valuable", bg: "#dcfce7", text: "#166534" },
  AVERAGE: { label: "Average", bg: "#fef3c7", text: "#92400e" },
  LOW_VALUE: { label: "Low Value", bg: "#f3f4f6", text: "#6b7280" },
  NONE: { label: "None", bg: "#f3f4f6", text: "#9ca3af" },
}

interface TierBadgeProps {
  tier: string | null | undefined
  type?: "vip" | "value"
  size?: "sm" | "md"
}

export default function TierBadge({ tier, type = "vip", size = "sm" }: TierBadgeProps) {
  if (!tier) return null
  const map = type === "value" ? VALUE_TIER_MAP : VIP_TIER_MAP
  const config = map[tier]
  if (!config) return null

  const fontSize = size === "sm" ? 10 : 11
  const padding = size === "sm" ? "1px 6px" : "2px 8px"

  return (
    <span style={{
      padding,
      borderRadius: 6,
      fontSize,
      fontWeight: 600,
      backgroundColor: config.bg,
      color: config.text,
      whiteSpace: "nowrap",
      lineHeight: 1.4,
    }}>
      {config.label}
    </span>
  )
}

export { VIP_TIER_MAP, VALUE_TIER_MAP }
