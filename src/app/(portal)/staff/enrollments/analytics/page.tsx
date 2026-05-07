"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Users, Clock, CheckCircle2, TrendingUp } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

const STATUS_LABELS: Record<string, string> = {
  pending: "Invited", invited: "Invited", started: "Started", in_progress: "In Progress",
  personal_info: "Personal Info", email_verified: "Email Verified", phone_verified: "Phone Verified",
  w9_complete: "W-9", dd_complete: "Direct Deposit", signed: "Signed",
  pending_review: "Pending Review", approved: "Approved", active: "Active", completed: "Completed",
  expired: "Expired", cancelled: "Cancelled", rejected: "Rejected",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Analytics = Record<string, any>

export default function EnrollmentAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/onboarding/admin/analytics").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: "48px 32px", color: "#9ca3af" }}>Loading...</div>
  if (!data) return <div style={{ padding: "48px 32px", color: "#9ca3af" }}>Failed to load analytics</div>

  const statusEntries = Object.entries(data.statusCounts as Record<string, number>).sort((a, b) => b[1] - a[1])
  const maxCount = Math.max(...statusEntries.map(e => e[1]), 1)

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1200px", margin: "0 auto" }}>
      <Link href="/staff/enrollments" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollments
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Enrollment Analytics</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 24px" }}>Onboarding pipeline performance</p>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total invites", value: data.total, icon: <Users size={16} />, color: ACC },
          { label: "Last 30 days", value: data.last30d, icon: <TrendingUp size={16} />, color: "#1d4ed8" },
          { label: "Completion rate", value: `${data.completionRate}%`, icon: <CheckCircle2 size={16} />, color: "#059669" },
          { label: "Avg days to complete", value: data.avgDays || "N/A", icon: <Clock size={16} />, color: "#d97706" },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#525866" }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#1A1313" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 16px" }}>Status Funnel</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {statusEntries.map(([status, count]) => (
            <div key={status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 140, fontSize: 13, color: "#525866", textAlign: "right", flexShrink: 0 }}>{STATUS_LABELS[status] || status}</div>
              <div style={{ flex: 1, height: 24, backgroundColor: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, backgroundColor: ACC, borderRadius: 6, minWidth: 2 }} />
              </div>
              <div style={{ width: 40, fontSize: 14, fontWeight: 600, color: "#1A1313", textAlign: "right" }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BG check stats */}
      {Object.keys(data.bgStats || {}).length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 12px" }}>Background Checks</h2>
          <div style={{ display: "flex", gap: 16 }}>
            {Object.entries(data.bgStats as Record<string, number>).map(([status, count]) => (
              <div key={status} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: status === "clear" ? "#059669" : status === "consider" ? "#d97706" : "#dc2626" }}>{count}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
