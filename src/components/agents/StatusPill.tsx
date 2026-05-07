import * as React from "react"

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  paused: { label: "Paused", bg: "#fef3c7", text: "#92400e" },
  active: { label: "Active", bg: "#dcfce7", text: "#059669" },
  suspended: { label: "Suspended", bg: "#fee2e2", text: "#dc2626" },
  pending: { label: "Pending", bg: "#fef3c7", text: "#92400e" },
  approved: { label: "Approved", bg: "#dbeafe", text: "#1d4ed8" },
  rejected: { label: "Rejected", bg: "#fee2e2", text: "#dc2626" },
  sent: { label: "Sent", bg: "#dcfce7", text: "#059669" },
  converted: { label: "Converted", bg: "#d1f5f0", text: "#134e4a" },
  bounced: { label: "Bounced", bg: "#f3f4f6", text: "#6b7280" },
  unread: { label: "Unread", bg: "#dbeafe", text: "#1d4ed8" },
  read: { label: "Read", bg: "#f3f4f6", text: "#6b7280" },
  archived: { label: "Archived", bg: "#f3f4f6", text: "#9ca3af" },
  actioned: { label: "Actioned", bg: "#dcfce7", text: "#059669" },
}

interface StatusPillProps {
  status: string | null | undefined
  size?: "sm" | "md"
}

export default function StatusPill({ status, size = "sm" }: StatusPillProps) {
  if (!status) return null
  const config = STATUS_MAP[status]
  if (!config) return <span style={{ fontSize: 11, color: "#6b7280" }}>{status}</span>

  const fontSize = size === "sm" ? 11 : 12
  const padding = size === "sm" ? "2px 8px" : "4px 12px"
  const borderRadius = size === "sm" ? 8 : 20

  return (
    <span style={{
      padding,
      borderRadius,
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

export { STATUS_MAP }
