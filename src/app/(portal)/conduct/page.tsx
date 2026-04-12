"use client"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"

type ConductRecord = {
  id: string; staffMemberId: string; issuedById: string; severity: string
  category: string; title: string; description: string; actionTaken: string | null
  followUpDate: string | null; isAcknowledged: boolean; acknowledgedAt: string | null
  createdAt: string; staffMember: { id: string; fullName: string; locationId: string }
}

const SEVERITY_COLORS: Record<string, string> = {
  verbal: "#3B82F6", written: "#F59E0B", final: "#EF4444", termination: "#DC2626",
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px", padding: "clamp(16px,4vw,28px)",
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
  backgroundColor: "#CDC9C0", color: "#0f1d24", fontSize: "12px", fontWeight: 700,
}

const btnSecondary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.2)",
  cursor: "pointer", backgroundColor: "transparent", color: "#CDC9C0", fontSize: "12px", fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", boxSizing: "border-box",
  backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px", color: "#FFFFFF", fontSize: "13px", outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "rgba(205,201,192,0.6)",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", display: "block",
}

export default function ConductPage() {
  const { isOwner, isManager, isStylist } = useUserRole()
  const canWrite = isOwner || isManager
  const [records, setRecords] = useState<ConductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [staffList, setStaffList] = useState<{ id: string; fullName: string }[]>([])

  // Form state
  const [formStaff, setFormStaff] = useState("")
  const [formSeverity, setFormSeverity] = useState("verbal")
  const [formCategory, setFormCategory] = useState("attendance")
  const [formTitle, setFormTitle] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formAction, setFormAction] = useState("")
  const [formFollowUp, setFormFollowUp] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/conduct")
    if (res.ok) { const d = await res.json(); setRecords(d.records) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (canWrite) {
      fetch("/api/staff").then(r => r.json()).then(d => {
        if (d.staff) setStaffList(d.staff)
        else if (d.staffMembers) setStaffList(d.staffMembers)
      }).catch(() => {})
    }
  }, [canWrite])

  const handleCreate = async () => {
    const res = await fetch("/api/conduct", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffMemberId: formStaff, severity: formSeverity, category: formCategory,
        title: formTitle, description: formDesc,
        actionTaken: formAction || undefined, followUpDate: formFollowUp || undefined,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setFormStaff(""); setFormTitle(""); setFormDesc(""); setFormAction(""); setFormFollowUp("")
      load()
    }
  }

  const acknowledge = async (id: string) => {
    const res = await fetch("/api/conduct", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) load()
  }

  if (loading) return (
    <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 80, background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "pulse 2s infinite" }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ color: "#FFFFFF", fontSize: "22px", fontWeight: 700, margin: 0 }}>
          {isStylist ? "My Record" : "Conduct Records"}
        </h1>
        {canWrite && (
          <button style={btnPrimary} onClick={() => setShowForm(true)}>+ New Write-Up</button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {records.map(r => (
          <div key={r.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
              <div>
                <span style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700 }}>{r.title}</span>
                {!isStylist && <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px", marginLeft: "12px" }}>{r.staffMember.fullName}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  backgroundColor: `${SEVERITY_COLORS[r.severity] || "#94A3B8"}20`,
                  color: SEVERITY_COLORS[r.severity] || "#94A3B8",
                }}>{r.severity}</span>
                <span style={{
                  padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(205,201,192,0.5)",
                }}>{r.category}</span>
              </div>
            </div>

            <p style={{ color: "rgba(205,201,192,0.7)", fontSize: "13px", lineHeight: 1.5, margin: "0 0 8px" }}>{r.description}</p>

            {r.actionTaken && (
              <p style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px", margin: "0 0 8px" }}>
                <strong style={{ color: "rgba(205,201,192,0.6)" }}>Action:</strong> {r.actionTaken}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ color: "rgba(205,201,192,0.4)", fontSize: "11px" }}>
                {new Date(r.createdAt).toLocaleDateString()}
                {r.followUpDate && ` | Follow-up: ${new Date(r.followUpDate).toLocaleDateString()}`}
              </span>

              {r.isAcknowledged ? (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>Acknowledged</span>
              ) : isStylist ? (
                <button style={btnPrimary} onClick={() => acknowledge(r.id)}>Acknowledge</button>
              ) : (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", textTransform: "uppercase" }}>Pending Acknowledgment</span>
              )}
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", color: "rgba(205,201,192,0.4)" }}>
            {isStylist ? "No conduct records on file" : "No conduct records found"}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}
          onClick={() => setShowForm(false)}>
          <div style={{ ...cardStyle, maxWidth: "560px", width: "100%", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: 700, margin: "0 0 16px" }}>New Write-Up</h2>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Staff Member</label>
              <select style={inputStyle} value={formStaff} onChange={e => setFormStaff(e.target.value)}>
                <option value="">Select staff member</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Severity</label>
                <select style={inputStyle} value={formSeverity} onChange={e => setFormSeverity(e.target.value)}>
                  <option value="verbal">Verbal Warning</option>
                  <option value="written">Written Warning</option>
                  <option value="final">Final Warning</option>
                  <option value="termination">Termination</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                  <option value="attendance">Attendance</option>
                  <option value="performance">Performance</option>
                  <option value="conduct">Conduct</option>
                  <option value="policy_violation">Policy Violation</option>
                  <option value="client_complaint">Client Complaint</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Brief title" />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Describe the incident..." />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Action Taken</label>
              <input style={inputStyle} value={formAction} onChange={e => setFormAction(e.target.value)} placeholder="Optional" />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Follow-Up Date</label>
              <input style={inputStyle} type="date" value={formFollowUp} onChange={e => setFormFollowUp(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleCreate}>Create Write-Up</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
