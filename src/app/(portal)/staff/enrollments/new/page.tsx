"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, Copy, Loader2, Check, MessageSquare } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }
const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313", backgroundColor: "#fff", boxSizing: "border-box" as const, outline: "none" }

export default function NewEnrollmentPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [locationId, setLocationId] = useState("")
  const [role, setRole] = useState("STYLIST")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [locations, setLocations] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      const locs = d.locations || d || []
      setLocations(locs)
      if (locs.length > 0 && !locationId) setLocationId(locs[0].id)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit() {
    if (!firstName || !lastName || !email || !locationId) { setError("All fields except phone are required"); return }
    setSubmitting(true); setError("")
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone: phone || undefined, locationId, enrollRole: role }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "Failed to create invite"); setSubmitting(false); return }
      setResult(d.enrollment)
    } catch { setError("Network error") }
    setSubmitting(false)
  }

  function getInviteUrl() {
    if (!result) return ""
    return `${window.location.origin}/onboarding/enroll/${result.inviteToken}`
  }

  function copyLink() {
    navigator.clipboard.writeText(getInviteUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 600, margin: "0 auto" }}>
      <Link href="/staff/enrollments" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollments
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>New Invite</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 24px" }}>Send an onboarding link to a new team member</p>

      {!result ? (
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>First name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>Last name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>Phone (optional)</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (361) 555-0000" style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>Location</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)} style={inp}>
                {locations.map((l: { id: string; name: string }) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
                <option value="STYLIST">Stylist</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          </div>

          {error && <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: "#fee2e2", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button onClick={submit} disabled={submitting} style={{ width: "100%", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />} Send Invite
          </button>
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Check size={24} color="#059669" /></div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Invite created for {result.firstName} {result.lastName}</h2>
            <p style={{ fontSize: 14, color: "#525866", margin: 0 }}>Email sent to {result.email}</p>
          </div>

          <div style={{ padding: 12, backgroundColor: "#f9fafb", borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", marginBottom: 4 }}>Invite link</div>
            <div style={{ fontSize: 13, color: "#1A1313", wordBreak: "break-all", fontFamily: "monospace" }}>{getInviteUrl()}</div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={copyLink} style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Link</>}
            </button>
            {result.phone && (
              <button onClick={() => { /* SMS is already sent by the API */ }} style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: "transparent", border: `1px solid ${ACC}`, color: ACC, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <MessageSquare size={14} /> SMS Sent
              </button>
            )}
          </div>

          <div style={{ padding: "10px 14px", backgroundColor: "#fef3c7", borderRadius: 8, fontSize: 13, color: "#92400e", marginBottom: 16 }}>
            This link expires in 7 days. The stylist will receive the link via email{result.phone ? " and SMS" : ""}.
          </div>

          <button onClick={() => router.push("/staff/enrollments")} style={{ width: "100%", padding: "10px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#525866", cursor: "pointer" }}>Done</button>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
