"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { UserPlus, Clock, CheckCircle2, XCircle, Eye, Users } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  invited: { bg: "#dbeafe", text: "#1d4ed8", label: "Invited" },
  started: { bg: "#fef3c7", text: "#92400e", label: "Started" },
  in_progress: { bg: "#fef3c7", text: "#92400e", label: "In Progress" },
  pending: { bg: "#dbeafe", text: "#1d4ed8", label: "Invited" },
  pending_review: { bg: "#fef3c7", text: "#d97706", label: "Pending Review" },
  approved: { bg: "#dcfce7", text: "#059669", label: "Approved" },
  active: { bg: "#dcfce7", text: "#059669", label: "Active" },
  completed: { bg: "#dcfce7", text: "#059669", label: "Completed" },
  expired: { bg: "#f3f4f6", text: "#6b7280", label: "Expired" },
  cancelled: { bg: "#f3f4f6", text: "#9ca3af", label: "Cancelled" },
  rejected: { bg: "#fee2e2", text: "#dc2626", label: "Rejected" },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Enrollment = Record<string, any>

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return "Just now"
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const TABS = ["all", "pending_review", "in_progress", "active", "cancelled", "rejected"]

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/onboarding/admin/enrollments?status=${tab}`)
      const d = await r.json()
      setEnrollments(d.enrollments || [])
      setPendingCount(d.pendingCount || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px", letterSpacing: "-0.31px" }}>Enrollments</h1>
          <p style={{ fontSize: 14, color: "#525866", margin: 0 }}>Manage onboarding for new team members</p>
        </div>
        <Link href="/staff/enrollments/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>
          <UserPlus size={16} /> New Invite
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: tab === t ? 500 : 400, backgroundColor: tab === t ? "#f4f5f7" : "transparent", color: tab === t ? "#1e2a30" : "#525866", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            {t === "all" ? "All" : t === "pending_review" ? "Pending Review" : t === "in_progress" ? "In Progress" : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "pending_review" && pendingCount > 0 && <span style={{ padding: "0 6px", borderRadius: 8, fontSize: 11, fontWeight: 600, backgroundColor: "#d97706", color: "#fff", minWidth: 18, textAlign: "center" }}>{pendingCount}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
        ) : enrollments.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Users size={48} strokeWidth={1.5} color={`${ACC}40`} style={{ margin: "0 auto 16px" }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 4px" }}>No enrollments</p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>Create your first invite to get started</p>
            <Link href="/staff/enrollments/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>
              <UserPlus size={16} /> New Invite
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Name", "Email", "Location", "Role", "Status", "Created", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#9ca3af" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e: Enrollment) => {
                  const ss = STATUS_STYLES[e.status] || STATUS_STYLES.invited
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px", fontWeight: 500, color: "#1A1313" }}>{e.firstName} {e.lastName}</td>
                      <td style={{ padding: "12px", color: "#525866" }}>{e.email}</td>
                      <td style={{ padding: "12px", color: "#525866" }}>{e.location?.name}</td>
                      <td style={{ padding: "12px", color: "#525866" }}>{e.role}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: ss.bg, color: ss.text }}>{ss.label}</span>
                      </td>
                      <td style={{ padding: "12px", color: "#9ca3af", fontSize: 12 }}>{timeAgo(e.createdAt)}</td>
                      <td style={{ padding: "12px" }}>
                        <Link href={`/staff/enrollments/${e.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, backgroundColor: `${ACC}10`, color: ACC, textDecoration: "none" }}>
                          <Eye size={12} /> Review
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
