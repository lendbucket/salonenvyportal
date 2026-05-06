"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Send, Clock, FileText, AlertCircle, CheckCircle2, Ban } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  DRAFT: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.5)", icon: <FileText size={12} /> },
  SCHEDULED: { bg: "rgba(59,130,246,0.1)", text: "#1d4ed8", icon: <Clock size={12} /> },
  SENDING: { bg: "rgba(234,179,8,0.1)", text: "#a16207", icon: <Send size={12} /> },
  SENT: { bg: "rgba(34,197,94,0.1)", text: "#15803d", icon: <CheckCircle2 size={12} /> },
  FAILED: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c", icon: <AlertCircle size={12} /> },
  CANCELLED: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.4)", icon: <Ban size={12} /> },
}
const TABS = ["all", "DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED"] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Campaign = Record<string, any>

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n) }

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>("all")

  const load = useCallback((status: string) => {
    setLoading(true)
    fetch(`/api/marketing/campaigns?status=${status}`).then(r => r.json()).then(d => setCampaigns(d.campaigns || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: 0 }}>Marketing Campaigns</h1>
        <Link href="/marketing/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          <Plus size={14} /> New Campaign
        </Link>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px solid", borderColor: tab === t ? ACC : "rgba(26,19,19,0.08)", backgroundColor: tab === t ? `${ACC}11` : "transparent", color: tab === t ? ACC : "rgba(26,19,19,0.5)", cursor: "pointer" }}>
            {t === "all" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(26,19,19,0.3)", fontSize: 13 }}>Loading...</div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Send size={32} strokeWidth={1.5} color="rgba(26,19,19,0.15)" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "rgba(26,19,19,0.4)", fontSize: 13, margin: 0 }}>No campaigns yet. Create your first one.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.08)" }}>
                  {["Date", "Channel", "Category", "Message", "Recipients", "Status", "Cost"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Recipients" || h === "Cost" ? "right" : "left", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const sc = STATUS_COLORS[c.status] || STATUS_COLORS.DRAFT
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                      <td style={{ padding: "10px 12px", color: "#1A1313", whiteSpace: "nowrap" }}>{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td style={{ padding: "10px 12px", color: "#1A1313" }}>{c.channel}</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: "rgba(122,143,150,0.08)", color: ACC }}>{c.category || "—"}</span></td>
                      <td style={{ padding: "10px 12px", color: "#1A1313", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <Link href={`/marketing/${c.id}`} style={{ color: ACC, textDecoration: "none" }}>{c.body?.slice(0, 60) || "—"}</Link>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#1A1313" }}>{c.recipientCount.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: sc.bg, color: sc.text }}>{sc.icon}{c.status}</span></td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#1A1313", fontFamily: "monospace" }}>{fmt(c.actualCost || 0)}</td>
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
