"use client"

import { useState, useEffect } from "react"
import { TEAM_NAMES } from "@/lib/staff"

interface CustomerData {
  customerId: string
  customerName: string
  email: string
  phone: string
  totalVisits: number
  ticketCount: number
  firstVisit: string
  lastVisit: string
  totalSpend: number
  avgTicket: number
  minTicket: number
  maxTicket: number
  daysSinceLastVisit: number
  lapsedSegment: string
  preferredStylist: string
  locationName: string
}

interface StylistBreakdown {
  teamMemberId: string
  name: string
  location: string
  uniqueClients: number
  repeatClients: number
  retentionRate: number
  avgTicket: number
  totalRevenue: number
}

interface RetentionData {
  totalCustomers: number
  activeCustomers: number
  retentionRate: number
  avgVisitsPerCustomer: number
  oneTimeCustomers: number
  recurringCustomers: number
  lapsedSegments: Record<string, number>
  top20Recurring: CustomerData[]
  top5HighestTickets: CustomerData[]
  retentionScore: number
  retentionGrade: string
  allCustomers: CustomerData[]
  stylistBreakdown: StylistBreakdown[]
}

const SEGMENT_LABELS: Record<string, string> = {
  active: "Active (< 90 days)",
  "<6mo": "Lapsed < 6 months",
  "<12mo": "Lapsed < 12 months",
  "<18mo": "Lapsed < 18 months",
  "<2yr": "Lapsed < 2 years",
  "3yr+": "Lapsed 3+ years",
}

const SEGMENT_COLORS: Record<string, string> = {
  active: "#22c55e",
  "<6mo": "#eab308",
  "<12mo": "#f97316",
  "<18mo": "#ef4444",
  "<2yr": "#dc2626",
  "3yr+": "#991b1b",
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "#22c55e", A: "#22c55e", "A-": "#4ade80",
  "B+": "#84cc16", B: "#a3e635", "B-": "#eab308",
  "C+": "#f59e0b", C: "#f97316", "C-": "#f97316",
  "D+": "#ef4444", D: "#ef4444", "D-": "#dc2626",
  F: "#991b1b",
}

const COACH_TIPS: Record<string, string> = {
  "A+": "Exceptional retention! Your clients love coming back. Keep up the outstanding work.",
  A: "Great retention rate. Focus on converting your one-time visitors into regulars.",
  "A-": "Strong performance. Consider a loyalty program to push into A+ territory.",
  "B+": "Good retention. Target your 6-month lapsed clients with a re-engagement campaign.",
  B: "Solid base. Focus on reducing no-shows and improving rebooking rates.",
  "B-": "Room to grow. Implement post-visit follow-ups to keep clients engaged.",
  "C+": "Needs attention. Launch a win-back campaign for lapsed clients ASAP.",
  C: "Below average. Review your client experience and address common drop-off points.",
  "C-": "Concerning trend. Prioritize client satisfaction surveys and immediate follow-ups.",
  "D+": "Critical. Schedule team meeting to address retention strategy immediately.",
  D: "Urgent action needed. Consider special offers to re-engage your lapsed base.",
  "D-": "Severe retention issue. Overhaul your client communication and rebooking process.",
  F: "Emergency. Retention requires immediate, comprehensive intervention across all areas.",
}

const card = {
  backgroundColor: "#FBFBFB",
  borderRadius: "12px" as const,
  border: "1px solid rgba(26,19,19,0.07)",
  padding: "20px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)",
}

const pill = (active: boolean) => ({
  padding: "6px 14px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: 700 as const,
  letterSpacing: "0.06em",
  cursor: "pointer" as const,
  border: active ? "1px solid #7a8f96" : "1px solid rgba(26,19,19,0.08)",
  backgroundColor: active ? "#7a8f96" : "transparent",
  color: active ? "#FBFBFB" : "rgba(26,19,19,0.5)",
})

export default function RetentionPage() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "lapsed" | "top" | "outreach" | "at_risk">("overview")
  const [selectedSegment, setSelectedSegment] = useState("all")
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [outreachMessage, setOutreachMessage] = useState(
    "We haven't seen you in a while and we'd love to welcome you back! Book your next appointment and enjoy our refreshed services."
  )
  const [sendingOutreach, setSendingOutreach] = useState(false)
  const [outreachResults, setOutreachResults] = useState<{ sent: number; failed: number; results: { customerName: string; status: string }[] } | null>(null)
  const [location, setLocation] = useState<string>("")
  const [selectedClient, setSelectedClient] = useState<CustomerData | null>(null)

  async function runAnalysis() {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const params = location ? `?location=${encodeURIComponent(location)}` : ""
      const res = await fetch(`/api/retention${params}`)
      const json = await res.json()
      if (json.error) {
        throw new Error(json.error + (json.details ? ": " + json.details : ""))
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  function toggleCustomer(id: string) {
    setSelectedCustomers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllFiltered() {
    const filtered = getFilteredLapsed()
    const allSelected = filtered.every((c) => selectedCustomers.has(c.customerId))
    if (allSelected) {
      setSelectedCustomers(new Set())
    } else {
      setSelectedCustomers(new Set(filtered.map((c) => c.customerId)))
    }
  }

  function getFilteredLapsed(): CustomerData[] {
    if (!data) return []
    if (selectedSegment === "all") return data.allCustomers.filter((c) => c.lapsedSegment !== "active")
    return data.allCustomers.filter((c) => c.lapsedSegment === selectedSegment)
  }

  async function sendEmails() {
    if (!data) return
    setSendingOutreach(true)
    setOutreachResults(null)
    const customers = data.allCustomers.filter((c) => selectedCustomers.has(c.customerId))
    try {
      const res = await fetch("/api/retention/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers, message: outreachMessage, channel: "email" }),
      })
      const json = await res.json()
      setOutreachResults(json)
    } catch {
      setOutreachResults({ sent: 0, failed: 0, results: [{ customerName: "Error", status: "failed" }] })
    } finally {
      setSendingOutreach(false)
    }
  }

  // Churn predictor state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [churnData, setChurnData] = useState<any[]>([])
  const [churnLoading, setChurnLoading] = useState(false)
  const [churnFilter, setChurnFilter] = useState<string>("all")
  const [sendingChurnOutreach, setSendingChurnOutreach] = useState<string | null>(null)
  const [churnSummary, setChurnSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0 })

  const loadChurnData = async () => {
    setChurnLoading(true)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (churnFilter !== "all") params.set("riskLevel", churnFilter)
      if (location) params.set("locationId", location)
      const res = await fetch(`/api/churn?${params}`)
      if (res.ok) {
        const json = await res.json()
        setChurnData(json.predictions || [])
        setChurnSummary(json.summary || { critical: 0, high: 0, medium: 0, low: 0 })
      }
    } catch { /* ignore */ }
    setChurnLoading(false)
  }

  const sendChurnOutreach = async (predictionId: string) => {
    setSendingChurnOutreach(predictionId)
    try {
      await fetch("/api/churn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ predictionId }) })
      loadChurnData()
    } catch { /* ignore */ }
    setSendingChurnOutreach(null)
  }

  useEffect(() => {
    if (activeTab === "at_risk") loadChurnData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, churnFilter, location])

  const RISK_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f59e0b", medium: "#eab308", low: "#94A3B8" }

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "lapsed" as const, label: "Lapsed Clients" },
    { key: "top" as const, label: "Top Clients" },
    { key: "outreach" as const, label: "Outreach" },
    { key: "at_risk" as const, label: "At-Risk Clients" },
  ]

  return (
    <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ color: "#1A1313", fontSize: "24px", fontWeight: 700, margin: 0 }}>Client Retention Engine</h1>
          <p style={{ color: "rgba(26,19,19,0.5)", fontSize: "13px", margin: "4px 0 0" }}>
            Analyze 3 years of booking data to identify lapsed clients and drive re-engagement
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              backgroundColor: "#FBFBFB",
              border: "1px solid rgba(26,19,19,0.08)",
              color: "#CDC9C0",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <option value="">All Locations</option>
            <option value="Corpus Christi">Corpus Christi</option>
            <option value="San Antonio">San Antonio</option>
          </select>
          <button
            onClick={runAnalysis}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              height: "40px",
              borderRadius: "8px",
              backgroundColor: loading ? "rgba(205,201,192,0.1)" : "#CDC9C0",
              color: loading ? "rgba(26,19,19,0.5)" : "#0f1d24",
              border: "none",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "16px",
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            >
              sync
            </span>
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {error && (
        <div style={{ ...card, borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.06)", marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#EF4444", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "6px" }}>Error Running Analysis</div>
          <div style={{ fontSize: "13px", color: "#FCA5A5", lineHeight: 1.5, marginBottom: "12px" }}>{error}</div>
          <button onClick={runAnalysis} style={{ padding: "8px 16px", backgroundColor: "transparent", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "6px", color: "#FCA5A5", fontSize: "11px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
            Try Again
          </button>
        </div>
      )}

      {!data && !loading && (
        <div style={{ ...card, textAlign: "center", padding: "60px 20px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(26,19,19,0.2)", marginBottom: "16px", display: "block" }}>
            favorite
          </span>
          <p style={{ color: "rgba(26,19,19,0.5)", fontSize: "14px", margin: 0 }}>
            Click &quot;Run Analysis&quot; to pull 3 years of SalonTransact booking data and calculate retention metrics
          </p>
        </div>
      )}

      {loading && (
        <div style={{ ...card, textAlign: "center", padding: "60px 20px" }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "48px", color: "#CDC9C0", marginBottom: "16px", display: "block", animation: "spin 1s linear infinite" }}
          >
            sync
          </span>
          <p style={{ color: "#CDC9C0", fontSize: "14px", margin: 0 }}>
            Pulling booking &amp; order data from SalonTransact... This may take up to 60 seconds.
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Retention Score Hero */}
          <div style={{ ...card, marginBottom: "20px", textAlign: "center", padding: "28px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(26,19,19,0.5)", textTransform: "uppercase" as const, marginBottom: "8px" }}>
              Retention Score
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "16px" }}>
              <div style={{
                fontSize: "56px",
                fontWeight: 900,
                color: GRADE_COLORS[data.retentionGrade] || "#CDC9C0",
                lineHeight: 1,
              }}>
                {data.retentionGrade}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "32px", fontWeight: 700, color: "#1A1313" }}>{data.retentionScore}</div>
                <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.5)" }}>out of 100</div>
              </div>
            </div>
            <div style={{
              width: "100%",
              maxWidth: "400px",
              margin: "0 auto 16px",
              height: "8px",
              borderRadius: "4px",
              backgroundColor: "rgba(205,201,192,0.1)",
              overflow: "hidden",
            }}>
              <div style={{
                width: `${data.retentionScore}%`,
                height: "100%",
                borderRadius: "4px",
                backgroundColor: GRADE_COLORS[data.retentionGrade] || "#CDC9C0",
                transition: "width 0.5s ease",
              }} />
            </div>
            <p style={{ color: "rgba(26,19,19,0.6)", fontSize: "13px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.5 }}>
              {COACH_TIPS[data.retentionGrade] || "Keep working on client retention."}
            </p>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "Total Clients", value: data.totalCustomers.toLocaleString() },
              { label: "Active (< 90d)", value: data.activeCustomers.toLocaleString(), color: "#22c55e" },
              { label: "Retention Rate", value: `${data.retentionRate}%` },
              { label: "Avg Visits", value: data.avgVisitsPerCustomer.toFixed(1) },
              { label: "One-Time", value: data.oneTimeCustomers.toLocaleString(), color: "#f97316" },
              { label: "Recurring", value: data.recurringCustomers.toLocaleString(), color: "#22c55e" },
            ].map((s) => (
              <div key={s.label} style={card}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(26,19,19,0.45)", textTransform: "uppercase" as const, marginBottom: "6px" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: s.color || "#FBFBFB" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(26,19,19,0.06)", paddingBottom: "0", overflowX: "auto" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: "10px 18px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: activeTab === t.key ? "#1A1313" : "rgba(26,19,19,0.4)",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: activeTab === t.key ? "2px solid #7a8f96" : "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: "-1px",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div>
              <h3 style={{ fontSize: "11px", fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>Lapsed Segment Breakdown</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                {Object.entries(data.lapsedSegments).map(([seg, count]) => (
                  <div key={seg} style={{ ...card, borderLeft: `3px solid ${SEGMENT_COLORS[seg] || "#CDC9C0"}` }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(26,19,19,0.5)", textTransform: "uppercase" as const, marginBottom: "6px" }}>
                      {SEGMENT_LABELS[seg] || seg}
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: SEGMENT_COLORS[seg] || "#FBFBFB" }}>
                      {count}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.4)", marginTop: "4px" }}>
                      {data.totalCustomers > 0 ? Math.round((count / data.totalCustomers) * 100) : 0}% of total
                    </div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <h3 style={{ color: "#1A1313", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "12px" }}>Improvement Tips</h3>
                <ul style={{ color: "rgba(26,19,19,0.7)", fontSize: "13px", lineHeight: 1.8, paddingLeft: "20px", margin: 0 }}>
                  <li>Send &quot;We miss you&quot; emails to clients lapsed 3-6 months for highest win-back rate</li>
                  <li>Offer a small incentive (10-15% off) to clients gone 6-12 months</li>
                  <li>Implement automatic rebooking reminders 4-6 weeks after each visit</li>
                  <li>Track preferred stylists and notify clients when their stylist has openings</li>
                  <li>Create a VIP loyalty tier for clients with 10+ visits per year</li>
                </ul>
              </div>

              {/* Stylist Retention Breakdown */}
              {data.stylistBreakdown && data.stylistBreakdown.length > 0 && (
                <div style={{ marginTop: "24px" }}>
                  <h3 style={{ fontSize: "11px", fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>Stylist Retention Breakdown</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                    {(["Corpus Christi", "San Antonio"] as const).map((loc) => {
                      const locStylists = data.stylistBreakdown.filter((s) => s.location === loc)
                      return (
                        <div key={loc} style={card}>
                          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#CDC9C0", textTransform: "uppercase" as const, marginBottom: "12px" }}>
                            {loc === "Corpus Christi" ? "CC" : "SA"} Stylists
                          </div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#F4F5F7" }}>
                                {["Stylist", "Clients", "Repeat", "Retention %", "Avg Ticket"].map((h) => (
                                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {locStylists.map((s) => (
                                <tr key={s.teamMemberId} style={{ borderBottom: "1px solid rgba(26,19,19,0.05)" }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(26,19,19,0.02)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                                  <td style={{ padding: "12px 16px", color: "#1A1313", fontWeight: 600 }}>{s.name.split(" ")[0]}</td>
                                  <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{s.uniqueClients}</td>
                                  <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{s.repeatClients}</td>
                                  <td style={{ padding: "12px 16px", fontWeight: 700, color: s.retentionRate >= 70 ? "#22c55e" : s.retentionRate >= 50 ? "#eab308" : "#ef4444" }}>
                                    {s.retentionRate}%
                                  </td>
                                  <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>${s.avgTicket.toFixed(0)}</td>
                                </tr>
                              ))}
                              {locStylists.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: "12px 6px", color: "rgba(26,19,19,0.3)", textAlign: "center" }}>No data</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "lapsed" && (
            <div>
              <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
                <button onClick={() => setSelectedSegment("all")} style={pill(selectedSegment === "all")}>All Lapsed</button>
                {Object.entries(SEGMENT_LABELS).filter(([k]) => k !== "active").map(([k, label]) => (
                  <button key={k} onClick={() => setSelectedSegment(k)} style={pill(selectedSegment === k)}>
                    {label} ({data.lapsedSegments[k] || 0})
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
                <button
                  onClick={selectAllFiltered}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: "rgba(26,19,19,0.06)",
                    border: "1px solid rgba(26,19,19,0.06)",
                    color: "rgba(26,19,19,0.6)",
                    cursor: "pointer",
                  }}
                >
                  {getFilteredLapsed().every((c) => selectedCustomers.has(c.customerId)) && getFilteredLapsed().length > 0
                    ? "Deselect All"
                    : "Select All"}
                </button>
                {selectedCustomers.size > 0 && (
                  <button
                    onClick={() => { setActiveTab("outreach") }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: "#CDC9C0",
                      border: "none",
                      color: "#0f1d24",
                      cursor: "pointer",
                    }}
                  >
                    Email Selected ({selectedCustomers.size})
                  </button>
                )}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F4F5F7" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}></th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Client</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Visits</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Last Visit</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Days Gone</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Stylist</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Segment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredLapsed().slice(0, 100).map((c) => (
                      <tr
                        key={c.customerId}
                        onClick={() => toggleCustomer(c.customerId)}
                        style={{
                          borderBottom: "1px solid rgba(26,19,19,0.05)",
                          cursor: "pointer",
                          backgroundColor: selectedCustomers.has(c.customerId) ? "rgba(26,19,19,0.04)" : "transparent",
                        }}
                        onMouseEnter={e => { if (!selectedCustomers.has(c.customerId)) e.currentTarget.style.backgroundColor = "rgba(26,19,19,0.02)" }}
                        onMouseLeave={e => { if (!selectedCustomers.has(c.customerId)) e.currentTarget.style.backgroundColor = "transparent" }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <input
                            type="checkbox"
                            checked={selectedCustomers.has(c.customerId)}
                            onChange={() => toggleCustomer(c.customerId)}
                            style={{ accentColor: "#CDC9C0" }}
                          />
                        </td>
                        <td style={{ padding: "12px 16px", color: "#1A1313", fontWeight: 600 }}>{c.customerName}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{c.totalVisits}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{new Date(c.lastVisit).toLocaleDateString()}</td>
                        <td style={{ padding: "12px 16px", color: SEGMENT_COLORS[c.lapsedSegment] || "#CDC9C0", fontWeight: 700 }}>{c.daysSinceLastVisit}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{c.preferredStylist}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "10px",
                            fontWeight: 700,
                            backgroundColor: `${SEGMENT_COLORS[c.lapsedSegment] || "#CDC9C0"}20`,
                            color: SEGMENT_COLORS[c.lapsedSegment] || "#CDC9C0",
                          }}>
                            {c.lapsedSegment}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "top" && (
            <div>
              <h3 style={{ fontSize: "11px", fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>Top 20 Recurring Clients</h3>
              <div style={{ overflowX: "auto", marginBottom: "32px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F4F5F7" }}>
                      {["#", "Client", "Visits", "Tickets", "Total Spend", "Avg", "Min", "Max", "Last Visit", "Stylist"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top20Recurring.map((c, i) => (
                      <tr key={c.customerId} onClick={() => setSelectedClient(c)} style={{ borderBottom: "1px solid rgba(26,19,19,0.05)", cursor: "pointer", transition: "background-color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(26,19,19,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.4)", fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: "12px 16px", color: "#1A1313", fontWeight: 600 }}>{c.customerName}</td>
                        <td style={{ padding: "12px 16px", color: "#22c55e", fontWeight: 700 }}>{c.totalVisits}</td>
                        <td style={{ padding: "12px 16px", color: c.ticketCount !== c.totalVisits ? "#F59E0B" : "rgba(26,19,19,0.5)", fontWeight: 600 }}>{c.ticketCount}{c.ticketCount !== c.totalVisits && <span style={{ fontSize: "9px", color: "#94A3B8" }}> paid</span>}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>${c.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>${c.avgTicket.toFixed(0)}</td>
                        <td style={{ padding: "12px 16px", color: c.minTicket >= 50 ? "#10B981" : "#94A3B8" }}>{c.minTicket > 0 ? `$${c.minTicket.toFixed(0)}` : "\u2014"}</td>
                        <td style={{ padding: "12px 16px", color: "#CDC9C0", fontWeight: 700 }}>{c.maxTicket > 0 ? `$${c.maxTicket.toFixed(0)}` : "\u2014"}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{new Date(c.lastVisit).toLocaleDateString()}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{c.preferredStylist}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: "11px", fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>Top 5 Highest Single Tickets</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F4F5F7" }}>
                      {["#", "Client", "Max Ticket", "Avg Ticket", "Total Spend", "Visits", "Stylist"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "rgba(26,19,19,0.4)", fontWeight: 600, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top5HighestTickets.map((c, i) => (
                      <tr key={c.customerId} onClick={() => setSelectedClient(c)} style={{ borderBottom: "1px solid rgba(26,19,19,0.05)", cursor: "pointer", transition: "background-color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(26,19,19,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.4)", fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: "12px 16px", color: "#1A1313", fontWeight: 600 }}>{c.customerName}</td>
                        <td style={{ padding: "12px 16px", color: "#CDC9C0", fontWeight: 700, fontSize: "14px" }}>${c.maxTicket.toFixed(2)}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>${c.avgTicket.toFixed(0)}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>${c.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{c.totalVisits}</td>
                        <td style={{ padding: "12px 16px", color: "rgba(26,19,19,0.7)" }}>{c.preferredStylist}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "outreach" && (
            <div>
              <div style={{ ...card, marginBottom: "20px" }}>
                <h3 style={{ color: "#1A1313", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "12px" }}>Compose Outreach Message</h3>
                <textarea
                  value={outreachMessage}
                  onChange={(e) => setOutreachMessage(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(26,19,19,0.04)",
                    border: "1px solid rgba(26,19,19,0.06)",
                    color: "#1A1313",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
                  <button
                    onClick={sendEmails}
                    disabled={selectedCustomers.size === 0 || sendingOutreach}
                    style={{
                      padding: "10px 20px",
                      height: "40px",
                      borderRadius: "8px",
                      backgroundColor: selectedCustomers.size === 0 || sendingOutreach ? "rgba(205,201,192,0.1)" : "#CDC9C0",
                      color: selectedCustomers.size === 0 || sendingOutreach ? "rgba(26,19,19,0.4)" : "#0f1d24",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                      cursor: selectedCustomers.size === 0 || sendingOutreach ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>mail</span>
                    {sendingOutreach ? "Sending..." : `Send Email (${selectedCustomers.size} selected)`}
                  </button>
                  {selectedCustomers.size === 0 && (
                    <span style={{ color: "rgba(26,19,19,0.4)", fontSize: "12px" }}>
                      Select clients from the Lapsed Clients tab first
                    </span>
                  )}
                </div>
              </div>

              {outreachResults && (
                <div style={{ ...card, marginBottom: "20px" }}>
                  <h3 style={{ color: "#1A1313", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "12px" }}>Send Results</h3>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                    <div style={{ color: "#22c55e", fontSize: "14px", fontWeight: 700 }}>
                      Sent: {outreachResults.sent}
                    </div>
                    <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: 700 }}>
                      Failed: {outreachResults.failed}
                    </div>
                  </div>
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {outreachResults.results.map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px", color: r.status === "sent" ? "#22c55e" : r.status === "pending" ? "#eab308" : "#ef4444" }}>
                          {r.status === "sent" ? "check_circle" : r.status === "pending" ? "schedule" : "error"}
                        </span>
                        <span style={{ color: "rgba(26,19,19,0.7)", fontSize: "12px" }}>{r.customerName}</span>
                        <span style={{ color: "rgba(26,19,19,0.4)", fontSize: "11px", marginLeft: "auto" }}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retention Goals */}
              <div style={card}>
                <h3 style={{ color: "#1A1313", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>Retention Goals</h3>
                {[
                  { label: "Active client retention rate", current: data.retentionRate, target: 60 },
                  { label: "Recurring vs one-time ratio", current: data.totalCustomers > 0 ? Math.round((data.recurringCustomers / data.totalCustomers) * 100) : 0, target: 70 },
                  { label: "Average visits per client", current: Math.round(data.avgVisitsPerCustomer * 10), target: 40 },
                ].map((goal) => (
                  <div key={goal.label} style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: "rgba(26,19,19,0.7)", fontSize: "12px" }}>{goal.label}</span>
                      <span style={{ color: "#CDC9C0", fontSize: "12px", fontWeight: 700 }}>
                        {goal.current}% / {goal.target}%
                      </span>
                    </div>
                    <div style={{
                      width: "100%",
                      height: "6px",
                      borderRadius: "3px",
                      backgroundColor: "rgba(205,201,192,0.1)",
                      overflow: "hidden",
                      position: "relative",
                    }}>
                      <div style={{
                        width: `${Math.min((goal.current / goal.target) * 100, 100)}%`,
                        height: "100%",
                        borderRadius: "3px",
                        backgroundColor: goal.current >= goal.target ? "#22c55e" : goal.current >= goal.target * 0.7 ? "#eab308" : "#ef4444",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* At-Risk Clients (Churn Predictor) */}
      {activeTab === "at_risk" && (
        <div>
          {/* Summary badges */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { label: "Critical", count: churnSummary.critical, color: "#ef4444" },
              { label: "High", count: churnSummary.high, color: "#f59e0b" },
              { label: "Medium", count: churnSummary.medium, color: "#eab308" },
              { label: "Low", count: churnSummary.low, color: "#94A3B8" },
            ].map(s => (
              <div key={s.label} style={{ padding: "12px 16px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.06)", borderLeft: `3px solid ${s.color}`, borderRadius: "0 8px 8px 0", minWidth: "100px" }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "22px", fontWeight: 700, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: "10px", color: "rgba(26,19,19,0.5)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{s.label} Risk</div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            {["all", "critical", "high", "medium", "low"].map(level => (
              <button key={level} onClick={() => setChurnFilter(level)} style={{
                padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer",
                backgroundColor: churnFilter === level ? "rgba(26,19,19,0.08)" : "transparent",
                color: churnFilter === level ? "#1A1313" : "rgba(26,19,19,0.4)",
                fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em",
              }}>{level}</button>
            ))}
            <button onClick={() => {
              const criticals = churnData.filter(c => c.riskLevel === "critical" && !c.outreachSent)
              if (!criticals.length) return
              criticals.forEach(c => sendChurnOutreach(c.id))
            }} style={{ marginLeft: "auto", padding: "6px 14px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", color: "#ef4444", fontSize: "10px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
              Send to All Critical
            </button>
          </div>

          {/* Table */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            {churnLoading ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                {[1,2,3,4,5].map(i => <div key={i} style={{ height: "48px", backgroundColor: "rgba(26,19,19,0.03)", borderRadius: "6px", marginBottom: "6px", animation: "pulse 1.5s infinite" }} />)}
              </div>
            ) : churnData.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center", color: "rgba(26,19,19,0.4)" }}>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>No churn predictions yet</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>Run the churn analysis cron to generate predictions</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F4F5F7" }}>
                      {["Client", "Last Visit", "Days Since", "Risk", "Score", "Visits", "Spend", "Outreach", ""].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: h === "Client" ? "left" : "right", fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(26,19,19,0.4)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {churnData.map((c: any, i: number) => (
                      <tr key={c.id} style={{ borderBottom: i < churnData.length - 1 ? "1px solid rgba(26,19,19,0.05)" : "none" }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(26,19,19,0.02)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: "13px", fontWeight: 500, color: "#1A1313" }}>{c.clientName}</div>
                          {c.clientPhone && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "rgba(26,19,19,0.4)", marginTop: "1px" }}>{c.clientPhone}</div>}
                        </td>
                        <td style={{ fontFamily: "'Inter', sans-serif", padding: "12px 14px", textAlign: "right", fontSize: "12px", color: "rgba(26,19,19,0.5)" }}>{c.lastVisitDate ? new Date(c.lastVisitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"}</td>
                        <td style={{ fontFamily: "'Inter', sans-serif", padding: "12px 14px", textAlign: "right", fontSize: "12px", color: RISK_COLORS[c.riskLevel] || "#94A3B8" }}>{c.daysSinceLastVisit ?? "N/A"}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", padding: "2px 8px", borderRadius: "4px", backgroundColor: `${RISK_COLORS[c.riskLevel] || "#94A3B8"}15`, color: RISK_COLORS[c.riskLevel] || "#94A3B8", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{c.riskLevel}</span>
                        </td>
                        <td style={{ fontFamily: "'Inter', sans-serif", padding: "12px 14px", textAlign: "right", fontSize: "13px", fontWeight: 600, color: RISK_COLORS[c.riskLevel] || "#94A3B8" }}>{Math.round(c.riskScore)}</td>
                        <td style={{ fontFamily: "'Inter', sans-serif", padding: "12px 14px", textAlign: "right", fontSize: "12px", color: "rgba(26,19,19,0.5)" }}>{c.totalVisits}</td>
                        <td style={{ fontFamily: "'Inter', sans-serif", padding: "12px 14px", textAlign: "right", fontSize: "12px", color: "#22c55e" }}>${(c.totalSpend || 0).toFixed(0)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          {c.outreachSent ? (
                            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", padding: "2px 8px", borderRadius: "4px", backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 700, textTransform: "uppercase" as const }}>Sent</span>
                          ) : (
                            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "9px", color: "rgba(26,19,19,0.3)" }}>Pending</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          {!c.outreachSent && (
                            <button onClick={() => sendChurnOutreach(c.id)} disabled={sendingChurnOutreach === c.id} style={{
                              padding: "4px 10px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "5px",
                              color: "rgba(26,19,19,0.5)", fontSize: "10px", fontWeight: 600, cursor: "pointer",
                              opacity: sendingChurnOutreach === c.id ? 0.5 : 1,
                            }}>
                              {sendingChurnOutreach === c.id ? "..." : "Send"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client Profile Modal */}
      {selectedClient && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.25)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setSelectedClient(null)}
        >
          <div
            style={{
              backgroundColor: "#FBFBFB",
              borderRadius: "12px",
              border: "1px solid rgba(26,19,19,0.07)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)",
              maxWidth: "520px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px", borderBottom: "1px solid rgba(26,19,19,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: "#1A1313", fontSize: "16px", fontWeight: 700 }}>Client Profile</h3>
              <button onClick={() => setSelectedClient(null)} style={{ background: "none", border: "none", color: "rgba(26,19,19,0.5)", cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Contact Info */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(26,19,19,0.4)", marginBottom: "8px", textTransform: "uppercase" as const }}>Contact Info</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { label: "Name", value: selectedClient.customerName },
                    { label: "Email", value: selectedClient.email || "N/A", link: selectedClient.email ? `mailto:${selectedClient.email}` : undefined },
                    { label: "Phone", value: selectedClient.phone || "N/A", link: selectedClient.phone ? `sms:${selectedClient.phone}` : undefined },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(26,19,19,0.5)", fontSize: "12px" }}>{row.label}</span>
                      {row.link ? (
                        <a href={row.link} style={{ color: "#CDC9C0", fontSize: "12px", fontWeight: 600, textDecoration: "underline" }}>{row.value}</a>
                      ) : (
                        <span style={{ color: "#1A1313", fontSize: "12px", fontWeight: 600 }}>{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Visit Stats */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(26,19,19,0.4)", marginBottom: "8px", textTransform: "uppercase" as const }}>Visit Stats</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Total Visits", value: String(selectedClient.totalVisits) },
                    { label: "Tickets", value: String(selectedClient.ticketCount) },
                    { label: "Total Spend", value: `$${selectedClient.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 })}` },
                    { label: "Avg Ticket", value: `$${selectedClient.avgTicket.toFixed(0)}` },
                    { label: "Min Ticket", value: selectedClient.minTicket > 0 ? `$${selectedClient.minTicket.toFixed(0)}` : "\u2014" },
                    { label: "Max Ticket", value: selectedClient.maxTicket > 0 ? `$${selectedClient.maxTicket.toFixed(0)}` : "\u2014" },
                  ].map((s) => (
                    <div key={s.label} style={{ backgroundColor: "rgba(205,201,192,0.04)", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(26,19,19,0.4)", textTransform: "uppercase" as const, marginBottom: "4px" }}>{s.label}</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#1A1313" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Date Stats */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(26,19,19,0.4)", marginBottom: "8px", textTransform: "uppercase" as const }}>Date Stats</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(26,19,19,0.5)", fontSize: "12px" }}>First Visit</span>
                    <span style={{ color: "#1A1313", fontSize: "12px" }}>{new Date(selectedClient.firstVisit).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(26,19,19,0.5)", fontSize: "12px" }}>Last Visit</span>
                    <span style={{ color: "#1A1313", fontSize: "12px" }}>{new Date(selectedClient.lastVisit).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(26,19,19,0.5)", fontSize: "12px" }}>Days Since Last Visit</span>
                    <span style={{ color: SEGMENT_COLORS[selectedClient.lapsedSegment] || "#CDC9C0", fontSize: "12px", fontWeight: 700 }}>{selectedClient.daysSinceLastVisit}</span>
                  </div>
                </div>
              </div>
              {/* Stylist & Segment */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(26,19,19,0.4)", textTransform: "uppercase" as const, marginBottom: "4px" }}>Preferred Stylist</div>
                  <div style={{ color: "#1A1313", fontSize: "13px", fontWeight: 600 }}>{selectedClient.preferredStylist}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(26,19,19,0.4)", textTransform: "uppercase" as const, marginBottom: "4px" }}>Segment</div>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    backgroundColor: `${SEGMENT_COLORS[selectedClient.lapsedSegment] || "#CDC9C0"}20`,
                    color: SEGMENT_COLORS[selectedClient.lapsedSegment] || "#CDC9C0",
                  }}>
                    {SEGMENT_LABELS[selectedClient.lapsedSegment] || selectedClient.lapsedSegment}
                  </span>
                </div>
              </div>
              {/* Quick Actions */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                {selectedClient.phone && (
                  <a href={`sms:${selectedClient.phone}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", borderRadius: "8px", backgroundColor: "rgba(26,19,19,0.06)", border: "1px solid rgba(26,19,19,0.06)", color: "#CDC9C0", textDecoration: "none", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>sms</span>
                    Text
                  </a>
                )}
                {selectedClient.email && (
                  <a href={`mailto:${selectedClient.email}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", borderRadius: "8px", backgroundColor: "rgba(26,19,19,0.06)", border: "1px solid rgba(26,19,19,0.06)", color: "#CDC9C0", textDecoration: "none", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>mail</span>
                    Email
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
