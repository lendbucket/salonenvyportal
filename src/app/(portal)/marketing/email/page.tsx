"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Send, Clock, FileText, AlertCircle, CheckCircle2, Ban, Mail, Search, TrendingUp, Users, Eye, MousePointerClick } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  draft: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.5)", icon: <FileText size={12} /> },
  scheduled: { bg: "rgba(59,130,246,0.1)", text: "#1d4ed8", icon: <Clock size={12} /> },
  sending: { bg: "rgba(234,179,8,0.1)", text: "#a16207", icon: <Send size={12} /> },
  sent: { bg: "rgba(34,197,94,0.1)", text: "#15803d", icon: <CheckCircle2 size={12} /> },
  failed: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c", icon: <AlertCircle size={12} /> },
  cancelled: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.4)", icon: <Ban size={12} /> },
}
const STATUS_TABS = ["all", "draft", "scheduled", "sending", "sent", "failed"] as const
const TIME_RANGES = [
  { value: "7d", label: "7d", ms: 7 * 86400000 },
  { value: "30d", label: "30d", ms: 30 * 86400000 },
  { value: "90d", label: "90d", ms: 90 * 86400000 },
  { value: "all", label: "All time", ms: 0 },
]
const TEMPLATE_TYPES = ["all", "promo", "newsletter", "birthday", "retention", "lastchance", "welcome"]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Campaign = Record<string, any>

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return "Just now"
  if (h < 24) return `${h}h ago`
  if (h < 48) return "Yesterday"
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function pct(n: number, d: number) {
  if (d === 0) return "0%"
  return `${Math.round((n / d) * 100)}%`
}

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<string>("all")
  const [timeRange, setTimeRange] = useState("30d")
  const [templateFilter, setTemplateFilter] = useState("all")
  const [search, setSearch] = useState("")

  const load = useCallback((status: string) => {
    setLoading(true)
    fetch(`/api/marketing/email?status=${status}`).then(r => r.json()).then(d => setCampaigns(d.campaigns || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(statusTab) }, [statusTab, load])

  const filtered = campaigns.filter(c => {
    if (templateFilter !== "all" && c.templateKey !== templateFilter) return false
    if (search && !c.subject?.toLowerCase().includes(search.toLowerCase()) && !c.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (timeRange !== "all") {
      const tr = TIME_RANGES.find(t => t.value === timeRange)
      if (tr && Date.now() - new Date(c.createdAt).getTime() > tr.ms) return false
    }
    return true
  })

  // Stats
  const sentCampaigns = campaigns.filter(c => c.status === "sent")
  const totalSent = sentCampaigns.reduce((s, c) => s + (c.totalSent || 0), 0)
  const totalOpened = sentCampaigns.reduce((s, c) => s + (c.totalOpened || 0), 0)
  const totalClicked = sentCampaigns.reduce((s, c) => s + (c.totalClicked || 0), 0)
  const totalUnsub = sentCampaigns.reduce((s, c) => s + (c.totalUnsubscribed || 0), 0)
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
  const avgClickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0
  const unsubRate = totalSent > 0 ? ((totalUnsub / totalSent) * 100).toFixed(2) : "0"

  const stats = [
    { label: "Total sent", value: totalSent.toLocaleString(), icon: <Send size={14} />, color: "#15803d" },
    { label: "Avg open rate", value: `${avgOpenRate}%`, icon: <Eye size={14} />, color: "#1d4ed8" },
    { label: "Avg click rate", value: `${avgClickRate}%`, icon: <MousePointerClick size={14} />, color: ACC },
    { label: "Unsub rate", value: `${unsubRate}%`, icon: <Users size={14} />, color: totalSent > 0 && parseFloat(unsubRate) > 0.1 ? "#dc2626" : "rgba(26,19,19,0.4)" },
  ]

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: 0, letterSpacing: "-0.31px" }}>Email Campaigns</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/marketing" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", backgroundColor: "transparent", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "rgba(26,19,19,0.6)", textDecoration: "none" }}>
            <TrendingUp size={14} /> SMS Campaigns
          </Link>
          <Link href="/marketing/email/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            <Plus size={14} /> New Email Campaign
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 2 }}>
          {TIME_RANGES.map(t => <button key={t.value} onClick={() => setTimeRange(t.value)} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, border: "1px solid", borderColor: timeRange === t.value ? ACC : "rgba(26,19,19,0.06)", backgroundColor: timeRange === t.value ? `${ACC}11` : "transparent", color: timeRange === t.value ? ACC : "rgba(26,19,19,0.4)", cursor: "pointer" }}>{t.label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {STATUS_TABS.map(t => <button key={t} onClick={() => setStatusTab(t)} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, border: "1px solid", borderColor: statusTab === t ? ACC : "rgba(26,19,19,0.06)", backgroundColor: statusTab === t ? `${ACC}11` : "transparent", color: statusTab === t ? ACC : "rgba(26,19,19,0.4)", cursor: "pointer" }}>{t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
        </div>
        <select value={templateFilter} onChange={e => setTemplateFilter(e.target.value)} style={{ padding: "4px 8px", borderRadius: 4, fontSize: 11, border: "1px solid rgba(26,19,19,0.08)", color: "rgba(26,19,19,0.6)", backgroundColor: "#FBFBFB" }}>
          {TEMPLATE_TYPES.map(c => <option key={c} value={c}>{c === "all" ? "All templates" : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <div style={{ position: "relative", flex: 1, maxWidth: 220 }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "rgba(26,19,19,0.3)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject..." style={{ width: "100%", padding: "4px 8px 4px 26px", borderRadius: 4, fontSize: 11, border: "1px solid rgba(26,19,19,0.08)", color: "#1A1313", backgroundColor: "#FBFBFB", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(26,19,19,0.3)", fontSize: 13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Mail size={36} strokeWidth={1.5} color="rgba(26,19,19,0.12)" style={{ margin: "0 auto 14px" }} />
            <p style={{ color: "rgba(26,19,19,0.45)", fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>No email campaigns yet</p>
            <p style={{ color: "rgba(26,19,19,0.35)", fontSize: 12, margin: "0 0 16px" }}>Create your first email campaign to reach your clients</p>
            <Link href="/marketing/email/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}><Plus size={14} /> Create first campaign</Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.08)" }}>
                  {["Date", "Template", "Subject", "Recipients", "Delivery", "Open", "Click", "Unsub", "Status"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: ["Recipients", "Delivery", "Open", "Click", "Unsub"].includes(h) ? "right" : "left", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const sc = STATUS_COLORS[c.status] || STATUS_COLORS.draft
                  const isSending = c.status === "sending"
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                      <td style={{ padding: "10px", color: "rgba(26,19,19,0.55)", whiteSpace: "nowrap", fontSize: 11 }}>{timeAgo(c.createdAt)}</td>
                      <td style={{ padding: "10px" }}><span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 600, backgroundColor: "rgba(122,143,150,0.08)", color: ACC }}>{c.templateKey}</span></td>
                      <td style={{ padding: "10px", color: "#1A1313", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <Link href={`/marketing/email/${c.id}`} style={{ color: ACC, textDecoration: "none", fontWeight: 500 }}>{c.subject || "—"}</Link>
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", color: "#1A1313", fontWeight: 500 }}>{(c.recipientCount || 0).toLocaleString()}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "rgba(26,19,19,0.55)", fontSize: 11 }}>{pct(c.totalDelivered || 0, c.totalSent || 0)}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "rgba(26,19,19,0.55)", fontSize: 11 }}>{pct(c.totalOpened || 0, c.totalSent || 0)}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "rgba(26,19,19,0.55)", fontSize: 11 }}>{pct(c.totalClicked || 0, c.totalSent || 0)}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "rgba(26,19,19,0.55)", fontSize: 11 }}>{pct(c.totalUnsubscribed || 0, c.totalSent || 0)}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: sc.bg, color: sc.text, ...(isSending ? { animation: "pulse 2s infinite" } : {}) }}>
                          {sc.icon}{c.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
