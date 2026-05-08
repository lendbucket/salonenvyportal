"use client"
import { useState, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Upload, Download, Send, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ValidationResult = { row: any; isValid: boolean; errors: string[]; warnings: string[] }

export default function BulkInvitePage() {
  const [csvText, setCsvText] = useState("")
  const [results, setResults] = useState<ValidationResult[]>([])
  const [validating, setValidating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ created: number; failed: { row: number; error: string }[] } | null>(null)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const text = await file.text()
    setCsvText(text)
    setResults([])
    setSendResult(null)
    setError("")
    // Auto-validate
    setValidating(true)
    try {
      const r = await fetch("/api/onboarding/admin/invites/bulk-validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error); setValidating(false); return }
      setResults(d.results || [])
    } catch { setError("Validation failed") }
    setValidating(false)
  }

  async function sendInvites() {
    setSending(true); setError("")
    try {
      const r = await fetch("/api/onboarding/admin/invites/bulk-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error); setSending(false); return }
      setSendResult(d)
    } catch { setError("Send failed") }
    setSending(false)
  }

  const validCount = results.filter(r => r.isValid).length
  const hasErrors = results.some(r => !r.isValid)

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <Link href="/staff/enrollments" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollments
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Bulk Invite Stylists</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 24px" }}>Upload a CSV to invite multiple stylists at once. Up to 50 invites per upload.</p>

      {!sendResult ? (
        <>
          {/* Upload zone */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: 0 }}>Upload CSV</h2>
              <a href="/api/onboarding/admin/invites/template-csv" download style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: "transparent", border: `1px solid ${ACC}`, color: ACC, textDecoration: "none" }}>
                <Download size={14} /> Download Template
              </a>
            </div>
            <div
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: "40px 24px", textAlign: "center", cursor: "pointer", backgroundColor: "#f9fafb" }}
            >
              <Upload size={32} color="#9ca3af" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, color: "#525866", margin: "0 0 4px" }}>Drag and drop your CSV file here, or click to browse</p>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>CSV with columns: firstName, lastName, email, phone, location, role, compensationType, ...</p>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
            {validating && <div style={{ marginTop: 12, fontSize: 13, color: ACC, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Validating...</div>}
          </div>

          {/* Validation results */}
          {results.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: 0 }}>
                  Validation: {validCount}/{results.length} valid
                </h2>
                <button onClick={sendInvites} disabled={sending || hasErrors || validCount === 0} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: sending || hasErrors || validCount === 0 ? 0.5 : 1 }}>
                  {sending ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />} Send {validCount} Invites
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                      {["Row", "Status", "Name", "Email", "Location", "Role", "Comp", "Issues"].map(h => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#9ca3af" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 8px", color: "#9ca3af" }}>{r.row.rowNumber}</td>
                        <td style={{ padding: "10px 8px" }}>{r.isValid ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#dc2626" />}</td>
                        <td style={{ padding: "10px 8px", color: "#1A1313" }}>{r.row.firstName} {r.row.lastName}</td>
                        <td style={{ padding: "10px 8px", color: "#525866" }}>{r.row.email}</td>
                        <td style={{ padding: "10px 8px", color: "#525866" }}>{r.row.location}</td>
                        <td style={{ padding: "10px 8px", color: "#525866" }}>{r.row.role}</td>
                        <td style={{ padding: "10px 8px", color: "#525866" }}>{r.row.compensationType}</td>
                        <td style={{ padding: "10px 8px" }}>
                          {r.errors.map((e, j) => <div key={j} style={{ fontSize: 12, color: "#dc2626" }}>{e}</div>)}
                          {r.warnings.map((w, j) => <div key={j} style={{ fontSize: 12, color: "#d97706" }}>{w}</div>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle2 size={48} color="#059669" style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1A1313", margin: "0 0 8px" }}>{sendResult.created} invites sent</h2>
            {sendResult.failed.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 14, color: "#dc2626", marginBottom: 8 }}>{sendResult.failed.length} failed:</p>
                {sendResult.failed.map((f, i) => <div key={i} style={{ fontSize: 12, color: "#dc2626" }}>Row {f.row}: {f.error}</div>)}
              </div>
            )}
            <Link href="/staff/enrollments" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none", marginTop: 20 }}>View Enrollments</Link>
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, backgroundColor: "#fee2e2", color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> {error}</div>}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
