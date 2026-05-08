"use client"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, FileText, Shield, Users, CreditCard, Loader2 } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

const EXPORTS = [
  { type: "all_enrollments", label: "All Enrollments", desc: "Complete enrollment list with status summary", icon: <Users size={16} /> },
  { type: "i9_compliance", label: "I-9 Compliance Report", desc: "W-2 employees with Section 1 + Section 2 dates, flag overdue", icon: <Shield size={16} /> },
  { type: "bg_check_summary", label: "Background Check Summary", desc: "Checkr report IDs, statuses, resolutions", icon: <FileText size={16} /> },
  { type: "document_inventory", label: "Document Inventory", desc: "All uploaded docs with verification status", icon: <CreditCard size={16} /> },
]

export default function AuditExportPage() {
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10) })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [downloading, setDownloading] = useState<string | null>(null)

  async function downloadExport(type: string) {
    setDownloading(type)
    try {
      const r = await fetch("/api/onboarding/admin/audit-exports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, startDate, endDate }),
      })
      if (r.ok) {
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = `${type}-${startDate}.csv`; a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* ignore */ }
    setDownloading(null)
  }

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/staff/enrollments" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollments
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Audit and Compliance</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 24px" }}>Generate auditor-ready compliance exports</p>

      {/* Date range */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 12px" }}>Date Range</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313" }} />
          <span style={{ color: "#9ca3af" }}>to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313" }} />
        </div>
      </div>

      {/* Export cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {EXPORTS.map(exp => (
          <div key={exp.type} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ color: ACC }}>{exp.icon}</span>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", margin: 0 }}>{exp.label}</h3>
            </div>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 16px" }}>{exp.desc}</p>
            <button onClick={() => downloadExport(exp.type)} disabled={!!downloading} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: downloading ? 0.5 : 1 }}>
              {downloading === exp.type ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />} Export CSV
            </button>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
