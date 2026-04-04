"use client"

import { useState } from "react"

const TEAM_NAMES: Record<string, string> = {
  "TMbc13IBzS8Z43AO": "Clarissa Reyna",
  "TMaExUyYaWYlvSqh": "Alexis Rodriguez",
  "TMCzd3unwciKEVX7": "Kaylie Espinoza",
  "TMn7kInT8g7Vrgxi": "Ashlynn Ochoa",
  "TMMdDDwU8WXpCZ9m": "Jessy Blamey",
  "TM_xI40vPph2_Cos": "Mia Gonzales",
  "TMMJKxeQuMlMW1Dw": "Melissa Cruz",
  "TM5CjcvcHRXZQ4hP": "Madelynn Martinez",
  "TMcc0QbHuUZfgcIB": "Jaylee Jaeger",
  "TMfFCmgJ5RV-WCBq": "Aubree Saldana",
  "TMk1YstlrnPrKw8p": "Kiyara Smith",
}

interface CustomerData {
  customerId: string
  customerName: string
  email: string
  phone: string
  totalVisits: number
  firstVisit: string
  lastVisit: string
  totalSpend: number
  avgTicket: number
  daysSinceLastVisit: number
  lapsedSegment: string
  preferredStylist: string
  locationName: string
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
  backgroundColor: "#1a2a32",
  borderRadius: "12px",
  border: "1px solid rgba(205,201,192,0.08)",
  padding: "20px",
}

const pill = (active: boolean) => ({
  padding: "6px 14px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: 700 as const,
  letterSpacing: "0.05em",
  cursor: "pointer" as const,
  border: active ? "1px solid #CDC9C0" : "1px solid rgba(205,201,192,0.15)",
  backgroundColor: active ? "rgba(205,201,192,0.15)" : "transparent",
  color: active ? "#CDC9C0" : "rgba(205,201,192,0.5)",
})

export default function RetentionPage() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "lapsed" | "top" | "outreach">("overview")
  const [selectedSegment, setSelectedSegment] = useState("all")
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [outreachMessage, setOutreachMessage] = useState(
    "We haven't seen you in a while and we'd love to welcome you back! Book your next appointment and enjoy our refreshed services."
  )
  const [sendingOutreach, setSendingOutreach] = useState(false)
  const [outreachResults, setOutreachResults] = useState<{ sent: number; failed: number; results: { customerName: string; status: string }[] } | null>(null)
  const [location, setLocation] = useState<string>("")

  async function runAnalysis() {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const params = location ? `?location=${encodeURIComponent(location)}` : ""
      const res = await fetch(`/api/retention${params}`)
      if (!res.ok) throw new Error("Failed to fetch retention data")
      const json = await res.json()
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

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "lapsed" as const, label: "Lapsed Clients" },
    { key: "top" as const, label: "Top Clients" },
    { key: "outreach" as const, label: "Outreach" },
  ]

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ color: "#FFFFFF", fontSize: "22px", fontWeight: 700, margin: 0 }}>Client Retention Engine</h1>
          <p style={{ color: "rgba(205,201,192,0.5)", fontSize: "13px", margin: "4px 0 0" }}>
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
              backgroundColor: "#1a2a32",
              border: "1px solid rgba(205,201,192,0.15)",
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
              borderRadius: "8px",
              backgroundColor: loading ? "rgba(205,201,192,0.1)" : "#CDC9C0",
              color: loading ? "rgba(205,201,192,0.5)" : "#0f1d24",
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
        <div style={{ ...card, borderColor: "#ef4444", marginBottom: "16px", color: "#ef4444", fontSize: "13px" }}>
          Error: {error}
        </div>
      )}

      {!data && !loading && (
        <div style={{ ...card, textAlign: "center", padding: "60px 20px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)", marginBottom: "16px", display: "block" }}>
            favorite
          </span>
          <p style={{ color: "rgba(205,201,192,0.5)", fontSize: "14px", margin: 0 }}>
            Click &quot;Run Analysis&quot; to pull 3 years of Square booking data and calculate retention metrics
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
            Pulling booking &amp; order data from Square... This may take up to 60 seconds.
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Retention Score Hero */}
          <div style={{ ...card, marginBottom: "20px", textAlign: "center", padding: "28px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(205,201,192,0.5)", textTransform: "uppercase" as const, marginBottom: "8px" }}>
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
                <div style={{ fontSize: "32px", fontWeight: 800, color: "#FFFFFF" }}>{data.retentionScore}</div>
                <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)" }}>out of 100</div>
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
            <p style={{ color: "rgba(205,201,192,0.6)", fontSize: "13px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.5 }}>
              {COACH_TIPS[data.retentionGrade] || "Keep working on client retention."}
            </p>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Total Clients", value: data.totalCustomers.toLocaleString() },
              { label: "Active (< 90d)", value: data.activeCustomers.toLocaleString(), color: "#22c55e" },
              { label: "Retention Rate", value: `${data.retentionRate}%` },
              { label: "Avg Visits", value: data.avgVisitsPerCustomer.toFixed(1) },
              { label: "One-Time", value: data.oneTimeCustomers.toLocaleString(), color: "#f97316" },
              { label: "Recurring", value: data.recurringCustomers.toLocaleString(), color: "#22c55e" },
            ].map((s) => (
              <div key={s.label} style={card}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(205,201,192,0.45)", textTransform: "uppercase" as const, marginBottom: "6px" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: s.color || "#FFFFFF" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(205,201,192,0.08)", paddingBottom: "0" }}>
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
                  color: activeTab === t.key ? "#CDC9C0" : "rgba(205,201,192,0.4)",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: activeTab === t.key ? "2px solid #CDC9C0" : "2px solid transparent",
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
              <h3 style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Lapsed Segment Breakdown</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "24px" }}>
                {Object.entries(data.lapsedSegments).map(([seg, count]) => (
                  <div key={seg} style={{ ...card, borderLeft: `3px solid ${SEGMENT_COLORS[seg] || "#CDC9C0"}` }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(205,201,192,0.5)", textTransform: "uppercase" as const, marginBottom: "6px" }}>
                      {SEGMENT_LABELS[seg] || seg}
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: SEGMENT_COLORS[seg] || "#FFFFFF" }}>
                      {count}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)", marginTop: "4px" }}>
                      {data.totalCustomers > 0 ? Math.round((count / data.totalCustomers) * 100) : 0}% of total
                    </div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <h3 style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "12px" }}>Improvement Tips</h3>
                <ul style={{ color: "rgba(205,201,192,0.7)", fontSize: "13px", lineHeight: 1.8, paddingLeft: "20px", margin: 0 }}>
                  <li>Send &quot;We miss you&quot; emails to clients lapsed 3-6 months for highest win-back rate</li>
                  <li>Offer a small incentive (10-15% off) to clients gone 6-12 months</li>
                  <li>Implement automatic rebooking reminders 4-6 weeks after each visit</li>
                  <li>Track preferred stylists and notify clients when their stylist has openings</li>
                  <li>Create a VIP loyalty tier for clients with 10+ visits per year</li>
                </ul>
              </div>
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
                    backgroundColor: "rgba(205,201,192,0.08)",
                    border: "1px solid rgba(205,201,192,0.12)",
                    color: "rgba(205,201,192,0.6)",
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
                    <tr style={{ borderBottom: "1px solid rgba(205,201,192,0.12)" }}>
                      <th style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}></th>
                      <th style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Client</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Visits</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Last Visit</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Days Gone</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Stylist</th>
                      <th style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Segment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredLapsed().slice(0, 100).map((c) => (
                      <tr
                        key={c.customerId}
                        onClick={() => toggleCustomer(c.customerId)}
                        style={{
                          borderBottom: "1px solid rgba(205,201,192,0.06)",
                          cursor: "pointer",
                          backgroundColor: selectedCustomers.has(c.customerId) ? "rgba(205,201,192,0.06)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "8px" }}>
                          <input
                            type="checkbox"
                            checked={selectedCustomers.has(c.customerId)}
                            onChange={() => toggleCustomer(c.customerId)}
                            style={{ accentColor: "#CDC9C0" }}
                          />
                        </td>
                        <td style={{ padding: "8px", color: "#FFFFFF", fontWeight: 600 }}>{c.customerName}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{c.totalVisits}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{new Date(c.lastVisit).toLocaleDateString()}</td>
                        <td style={{ padding: "8px", color: SEGMENT_COLORS[c.lapsedSegment] || "#CDC9C0", fontWeight: 700 }}>{c.daysSinceLastVisit}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{c.preferredStylist}</td>
                        <td style={{ padding: "8px" }}>
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
              <h3 style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Top 20 Recurring Clients</h3>
              <div style={{ overflowX: "auto", marginBottom: "32px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(205,201,192,0.12)" }}>
                      {["#", "Client", "Visits", "Total Spend", "Avg Ticket", "Last Visit", "Stylist", "Location"].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top20Recurring.map((c, i) => (
                      <tr key={c.customerId} style={{ borderBottom: "1px solid rgba(205,201,192,0.06)" }}>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.4)", fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: "8px", color: "#FFFFFF", fontWeight: 600 }}>{c.customerName}</td>
                        <td style={{ padding: "8px", color: "#22c55e", fontWeight: 700 }}>{c.totalVisits}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>${c.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>${c.avgTicket.toFixed(2)}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{new Date(c.lastVisit).toLocaleDateString()}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{c.preferredStylist}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{c.locationName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Top 5 Highest Average Tickets</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(205,201,192,0.12)" }}>
                      {["#", "Client", "Avg Ticket", "Total Spend", "Visits", "Stylist"].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "rgba(205,201,192,0.45)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top5HighestTickets.map((c, i) => (
                      <tr key={c.customerId} style={{ borderBottom: "1px solid rgba(205,201,192,0.06)" }}>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.4)", fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: "8px", color: "#FFFFFF", fontWeight: 600 }}>{c.customerName}</td>
                        <td style={{ padding: "8px", color: "#CDC9C0", fontWeight: 700, fontSize: "14px" }}>${c.avgTicket.toFixed(2)}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>${c.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{c.totalVisits}</td>
                        <td style={{ padding: "8px", color: "rgba(205,201,192,0.7)" }}>{c.preferredStylist}</td>
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
                <h3 style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "12px" }}>Compose Outreach Message</h3>
                <textarea
                  value={outreachMessage}
                  onChange={(e) => setOutreachMessage(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(205,201,192,0.06)",
                    border: "1px solid rgba(205,201,192,0.12)",
                    color: "#FFFFFF",
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
                      borderRadius: "8px",
                      backgroundColor: selectedCustomers.size === 0 || sendingOutreach ? "rgba(205,201,192,0.1)" : "#CDC9C0",
                      color: selectedCustomers.size === 0 || sendingOutreach ? "rgba(205,201,192,0.4)" : "#0f1d24",
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
                    <span style={{ color: "rgba(205,201,192,0.4)", fontSize: "12px" }}>
                      Select clients from the Lapsed Clients tab first
                    </span>
                  )}
                </div>
              </div>

              {outreachResults && (
                <div style={{ ...card, marginBottom: "20px" }}>
                  <h3 style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "12px" }}>Send Results</h3>
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
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid rgba(205,201,192,0.06)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px", color: r.status === "sent" ? "#22c55e" : r.status === "pending" ? "#eab308" : "#ef4444" }}>
                          {r.status === "sent" ? "check_circle" : r.status === "pending" ? "schedule" : "error"}
                        </span>
                        <span style={{ color: "rgba(205,201,192,0.7)", fontSize: "12px" }}>{r.customerName}</span>
                        <span style={{ color: "rgba(205,201,192,0.4)", fontSize: "11px", marginLeft: "auto" }}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retention Goals */}
              <div style={card}>
                <h3 style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>Retention Goals</h3>
                {[
                  { label: "Active client retention rate", current: data.retentionRate, target: 60 },
                  { label: "Recurring vs one-time ratio", current: data.totalCustomers > 0 ? Math.round((data.recurringCustomers / data.totalCustomers) * 100) : 0, target: 70 },
                  { label: "Average visits per client", current: Math.round(data.avgVisitsPerCustomer * 10), target: 40 },
                ].map((goal) => (
                  <div key={goal.label} style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: "rgba(205,201,192,0.7)", fontSize: "12px" }}>{goal.label}</span>
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
    </div>
  )
}
