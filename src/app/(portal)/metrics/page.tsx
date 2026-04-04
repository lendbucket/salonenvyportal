"use client"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"

interface StylistMetric {
  teamMemberId: string
  name: string
  homeLocation: string
  revenue: number
  serviceCount: number
  avgTicket: number
}

interface LocationMetric {
  location: string
  revenue: number
  serviceCount: number
  avgTicket: number
  stylistBreakdown: StylistMetric[]
}

interface ComparisonData {
  currentMetrics: LocationMetric[]
  previousMetrics: LocationMetric[]
  prevStartAt: string
  prevEndAt: string
}

const PERIODS = [
  { value: "today", label: "Today", compareLabel: "vs yesterday" },
  { value: "yesterday", label: "Yesterday", compareLabel: "vs day before" },
  { value: "7days", label: "7 Days", compareLabel: "vs prev 7 days" },
  { value: "30days", label: "30 Days", compareLabel: "vs prev 30 days" },
  { value: "90days", label: "90 Days", compareLabel: "vs prev 90 days" },
  { value: "week", label: "This Week", compareLabel: "vs last week" },
  { value: "month", label: "This Month", compareLabel: "vs last month" },
  { value: "year", label: "This Year", compareLabel: "vs last year" },
]

const SUGGESTED_QUESTIONS = [
  "Who are my top performers and what makes them successful?",
  "Which stylists need coaching and what should I focus on?",
  "How can I increase my average ticket price?",
  "What days/times should I focus on to maximize revenue?",
  "Am I on track to hit 10% growth this year?",
]

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function getChange(current: number, previous: number) {
  if (previous === 0) return null
  return (current - previous) / previous * 100
}

function ChangeIndicator({ change }: { change: number | null }) {
  if (change === null) return null
  const isPos = change >= 0
  return (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "2px 8px",
      borderRadius: "4px",
      backgroundColor: isPos ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      color: isPos ? "#10B981" : "#EF4444",
      marginLeft: "8px",
    }}>
      {isPos ? "\u2191" : "\u2193"} {Math.abs(change).toFixed(1)}%
    </span>
  )
}

export default function MetricsPage() {
  const { isOwner, locationName: userLocation } = useUserRole()
  const [period, setPeriod] = useState("today")
  const [location, setLocation] = useState("Both")
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiInsight, setAiInsight] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQuestion, setAiQuestion] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (location !== "Both") params.set("location", location)
      const res = await fetch(`/api/metrics/comparison?${params}`)
      const json = await res.json()
      setData(json)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [period, location])

  useEffect(() => { fetchData() }, [fetchData])

  const getAiInsights = async (customQuestion?: string) => {
    if (!data) return
    setAiLoading(true)
    setAiInsight("")
    try {
      const res = await fetch("/api/metrics/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentMetrics: data.currentMetrics,
          previousMetrics: data.previousMetrics,
          period,
          question: customQuestion,
        }),
      })
      const json = await res.json()
      setAiInsight(json.insight || json.error || "Unable to generate insights.")
    } catch { setAiInsight("Error generating insights.") }
    setAiLoading(false)
  }

  const periodLabel = PERIODS.find(p => p.value === period)

  const currentTotal = {
    revenue: data?.currentMetrics.reduce((s, m) => s + m.revenue, 0) || 0,
    serviceCount: data?.currentMetrics.reduce((s, m) => s + m.serviceCount, 0) || 0,
    avgTicket: 0,
  }
  currentTotal.avgTicket = currentTotal.serviceCount > 0 ? currentTotal.revenue / currentTotal.serviceCount : 0

  const prevTotal = {
    revenue: data?.previousMetrics.reduce((s, m) => s + m.revenue, 0) || 0,
    serviceCount: data?.previousMetrics.reduce((s, m) => s + m.serviceCount, 0) || 0,
    avgTicket: 0,
  }
  prevTotal.avgTicket = prevTotal.serviceCount > 0 ? prevTotal.revenue / prevTotal.serviceCount : 0

  const revenueChange = getChange(currentTotal.revenue, prevTotal.revenue)
  const servicesChange = getChange(currentTotal.serviceCount, prevTotal.serviceCount)
  const ticketChange = getChange(currentTotal.avgTicket, prevTotal.avgTicket)
  const annualGoalProgress = period === "year" && prevTotal.revenue > 0 ? (currentTotal.revenue / (prevTotal.revenue * 1.1) * 100) : null

  const pill = (active: boolean) => ({
    padding: "6px 12px",
    fontSize: "10px",
    fontWeight: 700 as const,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    borderRadius: "6px",
    border: "none",
    cursor: "pointer" as const,
    backgroundColor: active ? "#CDC9C0" : "transparent",
    color: active ? "#0f1d24" : "rgba(205,201,192,0.5)",
    transition: "all 0.15s",
    whiteSpace: "nowrap" as const,
  })

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "28px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Business Intelligence
          </h1>
          <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 4px" }}>
            Live Square data · {periodLabel?.compareLabel} · Net sales via booking matching
          </p>
          <p style={{ fontSize: "11px", color: "rgba(148,163,184,0.5)", margin: 0, maxWidth: "550px", lineHeight: 1.5 }}>
            Net sales (excluding tax and tips) estimated via booking-to-order time-proximity matching. Walk-ins not booked through Square Appointments may not be attributed to individual stylists.
          </p>
        </div>
        <button onClick={fetchData} style={{ padding: "8px 16px", fontSize: "10px", fontWeight: 700, borderRadius: "8px", border: "1px solid rgba(205,201,192,0.2)", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>refresh</span>
          Refresh
        </button>
      </div>

      {/* Selectors */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "nowrap" as const, overflowX: "auto" }}>
        <div style={{ display: "inline-flex", gap: "2px", backgroundColor: "#1a2a32", padding: "3px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)" }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={pill(period === p.value)}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: "inline-flex", gap: "2px", backgroundColor: "#1a2a32", padding: "3px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)" }}>
          {(isOwner ? ["Both", "Corpus Christi", "San Antonio"] : [userLocation || "Both"]).map(loc => (
            <button key={loc} onClick={() => setLocation(loc)} style={pill(location === loc)}>
              {loc === "Corpus Christi" ? "CC" : loc === "San Antonio" ? "SA" : loc}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ backgroundColor: "#1a2a32", borderRadius: "10px", padding: "20px", height: "100px", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            {[
              { label: "Total Net Sales", current: fmt(currentTotal.revenue), change: revenueChange, prev: fmt(prevTotal.revenue), icon: "payments" },
              { label: "Total Services", current: String(currentTotal.serviceCount), change: servicesChange, prev: String(prevTotal.serviceCount), icon: "content_cut" },
              { label: "Avg Ticket", current: fmt(currentTotal.avgTicket), change: ticketChange, prev: fmt(prevTotal.avgTicket), icon: "receipt" },
              { label: "Locations Active", current: String(data?.currentMetrics.filter(m => m.serviceCount > 0).length || 0), change: null, prev: "2 total", icon: "location_on" },
            ].map(card => (
              <div key={card.label} style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" }}>{card.label}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "rgba(205,201,192,0.3)" }}>{card.icon}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{card.current}</span>
                  <ChangeIndicator change={card.change} />
                </div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>Prev: {card.prev}</div>
              </div>
            ))}
          </div>

          {/* Annual Goal */}
          {annualGoalProgress !== null && (
            <div style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", padding: "20px", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Annual Net Sales Goal — +10% vs Last Year</div>
                  <div style={{ fontSize: "13px", color: "#94A3B8" }}>
                    Target: {fmt(prevTotal.revenue * 1.1)} · Current: {fmt(currentTotal.revenue)} · {annualGoalProgress.toFixed(1)}% of goal
                  </div>
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: annualGoalProgress >= 100 ? "#10B981" : annualGoalProgress >= 75 ? "#CDC9C0" : "#F59E0B" }}>
                  {annualGoalProgress.toFixed(0)}%
                </div>
              </div>
              <div style={{ height: "8px", backgroundColor: "rgba(205,201,192,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(annualGoalProgress, 100)}%`, backgroundColor: annualGoalProgress >= 100 ? "#10B981" : annualGoalProgress >= 75 ? "#CDC9C0" : "#F59E0B", borderRadius: "4px", transition: "width 1s ease" }} />
              </div>
            </div>
          )}

          {/* Location Comparison */}
          {location === "Both" && data && data.currentMetrics.length >= 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              {data.currentMetrics.map(loc => {
                const prevLoc = data.previousMetrics.find(p => p.location === loc.location)
                const revChange = prevLoc ? getChange(loc.revenue, prevLoc.revenue) : null
                return (
                  <div key={loc.location} style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", padding: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#FFFFFF", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>{loc.location}</h3>
                      <ChangeIndicator change={revChange} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      {[
                        { label: "Net Sales", value: fmt(loc.revenue) },
                        { label: "Services", value: String(loc.serviceCount) },
                        { label: "Avg Ticket", value: fmt(loc.avgTicket) },
                      ].map(stat => (
                        <div key={stat.label}>
                          <div style={{ fontSize: "9px", color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px" }}>{stat.label}</div>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: "#CDC9C0" }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: "1px solid rgba(205,201,192,0.08)", paddingTop: "12px" }}>
                      {loc.stylistBreakdown.slice(0, 3).map((s, i) => (
                        <div key={s.teamMemberId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "9px", fontWeight: 800, color: i === 0 ? "#CDC9C0" : "rgba(205,201,192,0.3)", width: "14px" }}>#{i + 1}</span>
                            <span style={{ fontSize: "12px", color: "#FFFFFF", fontWeight: 600 }}>{s.name.split(" ")[0]}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#CDC9C0" }}>{fmt(s.revenue)}</span>
                            <span style={{ fontSize: "10px", color: "#94A3B8", marginLeft: "6px" }}>{s.serviceCount} svcs</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Stylist Comparison Table */}
          <div style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", marginBottom: "24px", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(205,201,192,0.08)" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 800, color: "#FFFFFF", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Stylist Performance — Current vs Previous Period
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "rgba(205,201,192,0.04)" }}>
                    {["Stylist", "Loc", "Services", "vs Prev", "Net Sales", "vs Prev", "Avg Ticket", "vs Prev"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: "9px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: h === "Stylist" || h === "Loc" ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.currentMetrics.flatMap(loc =>
                    loc.stylistBreakdown.map(stylist => {
                      const prevLoc = data.previousMetrics.find(p => p.location === loc.location)
                      const prevStylist = prevLoc?.stylistBreakdown.find(s => s.teamMemberId === stylist.teamMemberId)
                      const revCh = prevStylist ? getChange(stylist.revenue, prevStylist.revenue) : null
                      const svcCh = prevStylist ? getChange(stylist.serviceCount, prevStylist.serviceCount) : null
                      const tktCh = prevStylist && prevStylist.avgTicket > 0 ? getChange(stylist.avgTicket, prevStylist.avgTicket) : null

                      return (
                        <tr key={stylist.teamMemberId} style={{ borderBottom: "1px solid rgba(205,201,192,0.06)" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(205,201,192,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800, color: "#CDC9C0", flexShrink: 0 }}>
                                {stylist.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>{stylist.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8", backgroundColor: "rgba(205,201,192,0.06)", padding: "2px 8px", borderRadius: "4px" }}>
                              {stylist.homeLocation === "Corpus Christi" ? "CC" : "SA"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{stylist.serviceCount}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right" }}><ChangeIndicator change={svcCh} /></td>
                          <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "14px", fontWeight: 800, color: "#CDC9C0" }}>{stylist.revenue > 0 ? fmt(stylist.revenue) : "\u2014"}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right" }}><ChangeIndicator change={revCh} /></td>
                          <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>{stylist.avgTicket > 0 ? fmt(stylist.avgTicket) : "\u2014"}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right" }}><ChangeIndicator change={tktCh} /></td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Business Coach */}
          <div style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(205,201,192,0.1)", border: "1px solid rgba(205,201,192,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#CDC9C0" }}>auto_awesome</span>
              </div>
              <div>
                <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Business Coach</h3>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>Powered by Reyna AI — analyzing your current vs previous period data</p>
              </div>
              <button onClick={() => getAiInsights()} disabled={aiLoading} style={{ marginLeft: "auto", padding: "8px 16px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "7px", color: "#0f1d24", fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: aiLoading ? "not-allowed" : "pointer", opacity: aiLoading ? 0.7 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>insights</span>
                {aiLoading ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {/* Suggested questions */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button key={q} onClick={() => { setAiQuestion(q); getAiInsights(q) }} disabled={aiLoading} style={{ padding: "6px 12px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "20px", color: "#CBD5E1", fontSize: "11px", cursor: aiLoading ? "not-allowed" : "pointer", textAlign: "left" }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Custom question */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <input
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && aiQuestion && getAiInsights(aiQuestion)}
                placeholder="Ask a custom question about your business data..."
                style={{ flex: 1, padding: "10px 14px", backgroundColor: "#0f1d24", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "7px", color: "#FFFFFF", fontSize: "13px", outline: "none" }}
              />
              <button onClick={() => getAiInsights(aiQuestion)} disabled={aiLoading || !aiQuestion} style={{ padding: "10px 16px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.25)", borderRadius: "7px", color: "#CDC9C0", fontSize: "11px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", opacity: (!aiQuestion || aiLoading) ? 0.5 : 1 }}>
                Ask
              </button>
            </div>

            {/* AI Response */}
            {aiLoading && (
              <div style={{ backgroundColor: "#0f1d24", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "8px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#CDC9C0", animation: "spin 1s linear infinite" }}>sync</span>
                <span style={{ fontSize: "13px", color: "#94A3B8" }}>Reyna AI is analyzing your salon data...</span>
              </div>
            )}
            {aiInsight && !aiLoading && (
              <div style={{ backgroundColor: "#0f1d24", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "8px", padding: "16px 20px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
                  Reyna AI Analysis
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiInsight}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
