"use client"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditEntry = Record<string, any>

const ACTION_LABELS: Record<string, string> = {
  "enrollment.status_change": "Status changed",
  "enrollment.invite.created": "Invite created",
  "enrollment.section.submitted": "Section submitted",
  "enrollment.email_verification.sent": "Email verification sent",
  "enrollment.email_verification.success": "Email verified",
  "enrollment.phone_verification.sent": "Phone verification sent",
  "enrollment.phone_verification.success": "Phone verified",
  "enrollment.manager_approved": "Approved by manager",
  "enrollment.manager_rejected": "Rejected by manager",
  "enrollment.square_sync.attempted": "Square sync attempted",
  "enrollment.square_sync.success": "Square sync succeeded",
  "enrollment.square_sync.failed": "Square sync failed",
}

export default function EnrollmentAuditPage() {
  const { id } = useParams()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/onboarding/admin/${id}/audit`).then(r => r.json()).then(d => setLogs(d.logs || [])).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 800, margin: "0 auto" }}>
      <Link href={`/staff/enrollments/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollment
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Audit Trail</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 24px" }}>Complete history of actions for this enrollment</p>

      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No audit entries yet</div>
        ) : (
          <div style={{ position: "relative", paddingLeft: 24 }}>
            <div style={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 2, backgroundColor: "#e5e7eb" }} />
            {logs.map((log, i) => (
              <div key={log.id || i} style={{ position: "relative", marginBottom: 20, paddingLeft: 20 }}>
                <div style={{ position: "absolute", left: -5, top: 4, width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FBFBFB", border: `2px solid ${ACC}` }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{ACTION_LABELS[log.action] || log.action}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, display: "flex", gap: 8 }}>
                  <span><Clock size={11} style={{ marginRight: 3 }} />{new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  {log.userId && <span>by {log.userEmail || log.userId}</span>}
                  {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div style={{ marginTop: 6, padding: "6px 10px", backgroundColor: "#f9fafb", borderRadius: 6, fontSize: 12, color: "#525866", fontFamily: "monospace" }}>
                    {Object.entries(log.metadata as Record<string, unknown>).map(([k, v]) => (
                      <div key={k}><span style={{ color: "#9ca3af" }}>{k}:</span> {String(v)}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
