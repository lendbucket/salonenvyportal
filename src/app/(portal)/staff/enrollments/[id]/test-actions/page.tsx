"use client"
import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, Loader2, Play, RotateCcw, Shield, CheckCircle2 } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

const ACTIONS = [
  { key: "skip_to_pending_review", label: "Skip to Pending Review", desc: "Force advance status to PENDING_REVIEW, mark email + phone as verified", icon: <Play size={16} />, color: "#d97706" },
  { key: "mock_bg_check_clear", label: "Mock Background Check Clear", desc: "Set bgCheckStatus=clear without calling Checkr (dev only)", icon: <Shield size={16} />, color: "#059669" },
  { key: "reset_to_started", label: "Reset to Started", desc: "Reset enrollment back to STARTED status for re-testing", icon: <RotateCcw size={16} />, color: "#dc2626" },
  { key: "force_i9_section_2", label: "Force I-9 Section 2 Complete", desc: "Mark I-9 Section 2 as verified without in-person review", icon: <CheckCircle2 size={16} />, color: "#1d4ed8" },
  { key: "force_approve", label: "Force Approve", desc: "Set status directly to APPROVED (skip all checks)", icon: <CheckCircle2 size={16} />, color: "#059669" },
]

export default function TestActionsPage() {
  const { id } = useParams()
  const [acting, setActing] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function runAction(action: string) {
    setActing(action); setResult(null)
    try {
      const r = await fetch(`/api/onboarding/admin/${id}/test-action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const d = await r.json()
      setResult(r.ok ? `Done: ${action}` : `Error: ${d.error}`)
    } catch { setResult("Network error") }
    setActing(null)
  }

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 700, margin: "0 auto" }}>
      <Link href={`/staff/enrollments/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollment
      </Link>

      <div style={{ padding: "12px 16px", backgroundColor: "#fef3c7", borderRadius: 8, borderLeft: "3px solid #d97706", marginBottom: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#92400e" }}>
        <AlertTriangle size={16} /> DEV TOOLS -- Actions here are for testing only. Will be disabled in production once first real stylist enrolls.
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Test Actions</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 24px" }}>Quick actions for testing the enrollment flow</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ACTIONS.map(a => (
          <div key={a.key} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: a.color }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1313" }}>{a.label}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>{a.desc}</div>
                </div>
              </div>
              <button onClick={() => runAction(a.key)} disabled={!!acting} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: a.color, color: "#fff", border: "none", cursor: "pointer", opacity: acting ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                {acting === a.key ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null} Run
              </button>
            </div>
          </div>
        ))}
      </div>

      {result && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, backgroundColor: result.startsWith("Done") ? "#dcfce7" : "#fee2e2", color: result.startsWith("Done") ? "#059669" : "#dc2626", fontSize: 13 }}>{result}</div>}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
