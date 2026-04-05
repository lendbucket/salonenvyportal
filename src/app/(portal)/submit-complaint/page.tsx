"use client"
import { useState, useEffect } from "react"

const cardStyle: React.CSSProperties = {
  backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)",
  borderRadius: "12px", padding: "clamp(16px,4vw,28px)",
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", boxSizing: "border-box",
  backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.15)",
  borderRadius: "8px", color: "#FFFFFF", fontSize: "14px", outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "rgba(205,201,192,0.6)",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", display: "block",
}

const btnPrimary: React.CSSProperties = {
  padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer",
  backgroundColor: "#CDC9C0", color: "#0f1d24", fontSize: "13px", fontWeight: 700,
  width: "100%",
}

export default function SubmitComplaintPage() {
  const [category, setCategory] = useState("")
  const [locationId, setLocationId] = useState("")
  const [message, setMessage] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      if (d.locations) setLocations(d.locations)
    }).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!category || !message) return
    setSubmitting(true)
    const res = await fetch("/api/complaints", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, locationId: locationId || undefined, message }),
    })
    setSubmitting(false)
    if (res.ok) setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "560px", margin: "0 auto" }}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#10B981", display: "block", marginBottom: "12px" }}>check_circle</span>
          <h2 style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>Report Submitted</h2>
          <p style={{ color: "rgba(205,201,192,0.6)", fontSize: "14px", margin: "0 0 20px", lineHeight: 1.5 }}>
            Your anonymous report has been submitted securely. Management will review it promptly.
          </p>
          <button style={{ ...btnPrimary, width: "auto", display: "inline-block" }} onClick={() => {
            setSubmitted(false); setCategory(""); setLocationId(""); setMessage("")
          }}>Submit Another</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "560px", margin: "0 auto" }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#CDC9C0" }}>shield</span>
          <h1 style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: 700, margin: 0 }}>Report an Issue</h1>
        </div>
        <p style={{ color: "rgba(205,201,192,0.5)", fontSize: "13px", margin: "0 0 24px", lineHeight: 1.5 }}>
          This form is completely anonymous. Your identity is not tracked or stored.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Category *</label>
          <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Select a category</option>
            <option value="workplace_safety">Workplace Safety</option>
            <option value="harassment">Harassment</option>
            <option value="discrimination">Discrimination</option>
            <option value="management_concern">Management Concern</option>
            <option value="policy_issue">Policy Issue</option>
            <option value="equipment_issue">Equipment Issue</option>
            <option value="scheduling">Scheduling</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Location (optional)</label>
          <select style={inputStyle} value={locationId} onChange={e => setLocationId(e.target.value)}>
            <option value="">All / Not specific</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Message *</label>
          <textarea style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Describe the issue in detail..." />
        </div>

        <button style={{ ...btnPrimary, opacity: (!category || !message || submitting) ? 0.5 : 1 }}
          disabled={!category || !message || submitting} onClick={handleSubmit}>
          {submitting ? "Submitting..." : "Submit Anonymously"}
        </button>

        <p style={{ color: "rgba(205,201,192,0.3)", fontSize: "11px", textAlign: "center", marginTop: "16px", lineHeight: 1.5 }}>
          Your submission is encrypted and anonymous. No identifying information is collected.
        </p>
      </div>
    </div>
  )
}
