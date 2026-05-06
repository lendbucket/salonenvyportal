"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, TrendingUp, DollarSign, Send, Users, MousePointerClick, UserMinus, BarChart3 } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const PERIODS = [
  { value: "7d", label: "7 days", ms: 7 * 86400000 },
  { value: "30d", label: "30 days", ms: 30 * 86400000 },
  { value: "90d", label: "90 days", ms: 90 * 86400000 },
]

interface KPIs { totalCampaigns: number; totalSent: number; totalSpent: number; deliveryRate: number; clickRate: number; totalOptOuts: number; netGrowth: number; costPerClick: number }
interface CampaignRow { id: string; category: string | null; channel: string; body: string; recipientCount: number; actualCost: number; createdAt: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalyticsData = { kpis: KPIs; campaigns: CampaignRow[]; audienceHealth: { currentOptedIn: number; optInHistory: any[] } }

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n) }

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const ms = PERIODS.find(p => p.value === period)?.ms || 30 * 86400000
    const from = new Date(Date.now() - ms).toISOString()
    const to = new Date().toISOString()
    fetch(`/api/marketing/analytics?from=${from}&to=${to}`)
      .then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }, [period])

  const k = data?.kpis

  const KPI_CARDS = k ? [
    { label: "Campaigns", value: k.totalCampaigns.toString(), icon: <Send size={14} />, color: ACC },
    { label: "Messages Sent", value: k.totalSent.toLocaleString(), icon: <Send size={14} />, color: "#1d4ed8" },
    { label: "Total Spent", value: fmt(k.totalSpent), icon: <DollarSign size={14} />, color: "#15803d" },
    { label: "Delivery Rate", value: `${k.deliveryRate}%`, icon: <TrendingUp size={14} />, color: "#0d9488" },
    { label: "Click Rate", value: `${k.clickRate}%`, icon: <MousePointerClick size={14} />, color: "#7c3aed" },
    { label: "Opt-outs", value: k.totalOptOuts.toString(), icon: <UserMinus size={14} />, color: "#dc2626" },
    { label: "Net Growth", value: (k.netGrowth >= 0 ? "+" : "") + k.netGrowth.toString(), icon: <Users size={14} />, color: k.netGrowth >= 0 ? "#15803d" : "#dc2626" },
    { label: "Cost / Click", value: fmt(k.costPerClick), icon: <BarChart3 size={14} />, color: ACC },
  ] : []

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <Link href="/marketing" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: 0 }}>Marketing Analytics</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px solid", borderColor: period === p.value ? ACC : "rgba(26,19,19,0.08)", backgroundColor: period === p.value ? `${ACC}11` : "transparent", color: period === p.value ? ACC : "rgba(26,19,19,0.5)", cursor: "pointer" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(26,19,19,0.3)", fontSize: 13 }}>Loading analytics...</div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
            {KPI_CARDS.map(kpi => (
              <div key={kpi.label} style={{ ...cardStyle, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${kpi.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: kpi.color, flexShrink: 0 }}>{kpi.icon}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Audience Health */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: "0 0 12px" }}>Audience Health</h2>
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
              <div>
                <span style={{ color: "rgba(26,19,19,0.5)" }}>Currently opted in: </span>
                <strong style={{ color: "#15803d" }}>{data?.audienceHealth.currentOptedIn.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: "rgba(26,19,19,0.5)" }}>Opt-in events (period): </span>
                <strong>{data?.audienceHealth.optInHistory.filter((r: { action: string }) => r.action === "OPT_IN" || r.action === "RE_OPT_IN").length}</strong>
              </div>
              <div>
                <span style={{ color: "rgba(26,19,19,0.5)" }}>Opt-out events (period): </span>
                <strong style={{ color: "#dc2626" }}>{data?.audienceHealth.optInHistory.filter((r: { action: string }) => r.action === "OPT_OUT").length}</strong>
              </div>
            </div>
          </div>

          {/* Campaign Table */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: "0 0 12px" }}>Campaign Performance</h2>
            {(data?.campaigns || []).length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(26,19,19,0.3)", fontSize: 12 }}>No campaigns in selected period</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.08)" }}>
                      {["Date", "Channel", "Category", "Message", "Recipients", "Cost"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: h === "Recipients" || h === "Cost" ? "right" : "left", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.campaigns || []).map(c => (
                      <tr key={c.id} style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                        <td style={{ padding: "10px 12px", color: "#1A1313", whiteSpace: "nowrap" }}>{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                        <td style={{ padding: "10px 12px", color: "#1A1313" }}>{c.channel}</td>
                        <td style={{ padding: "10px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: "rgba(122,143,150,0.08)", color: ACC }}>{c.category || "—"}</span></td>
                        <td style={{ padding: "10px 12px", color: "#1A1313", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Link href={`/marketing/${c.id}`} style={{ color: ACC, textDecoration: "none" }}>{c.body || "—"}</Link>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "#1A1313" }}>{c.recipientCount.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{fmt(c.actualCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
