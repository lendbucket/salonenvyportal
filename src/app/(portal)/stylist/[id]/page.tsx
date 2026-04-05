"use client"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"

const TEAM_MEMBER_NAMES: Record<string, string> = {
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

const TEAM_MEMBER_LOCATIONS: Record<string, string> = {
  "TMbc13IBzS8Z43AO": "Corpus Christi",
  "TMaExUyYaWYlvSqh": "Corpus Christi",
  "TMCzd3unwciKEVX7": "Corpus Christi",
  "TMn7kInT8g7Vrgxi": "Corpus Christi",
  "TMMdDDwU8WXpCZ9m": "Corpus Christi",
  "TM_xI40vPph2_Cos": "Corpus Christi",
  "TMMJKxeQuMlMW1Dw": "San Antonio",
  "TM5CjcvcHRXZQ4hP": "San Antonio",
  "TMcc0QbHuUZfgcIB": "San Antonio",
  "TMfFCmgJ5RV-WCBq": "San Antonio",
  "TMk1YstlrnPrKw8p": "San Antonio",
}

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

interface PeriodData {
  period: string
  label: string
  metrics: StylistMetric | null
}

const PERIODS = [
  { value: "7days", label: "7 Days" },
  { value: "30days", label: "30 Days" },
  { value: "90days", label: "90 Days" },
  { value: "year", label: "This Year" },
]

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function StylistProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { isOwner, isManager } = useUserRole()
  const id = params.id as string

  const [periodData, setPeriodData] = useState<PeriodData[]>([])
  const [activePeriod, setActivePeriod] = useState("30days")
  const [loading, setLoading] = useState(true)
  const [aiInsight, setAiInsight] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  const name = TEAM_MEMBER_NAMES[id] || "Unknown Stylist"
  const location = TEAM_MEMBER_LOCATIONS[id] || "Unknown"
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        PERIODS.map(async (p) => {
          const res = await fetch(`/api/metrics/live?period=${p.value}`)
          const json = await res.json()
          const allStylists: StylistMetric[] = (json.metrics || []).flatMap((m: LocationMetric) => m.stylistBreakdown || [])
          const match = allStylists.find((s: StylistMetric) => s.teamMemberId === id) || null
          return { period: p.value, label: p.label, metrics: match }
        })
      )
      setPeriodData(results)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!isOwner && !isManager) {
      router.replace("/dashboard")
    }
  }, [isOwner, isManager, router])

  const active = periodData.find(p => p.period === activePeriod)?.metrics
  const bestRevenue = Math.max(...periodData.map(p => p.metrics?.revenue || 0))
  const revenueGoal = bestRevenue > 0 ? Math.round(bestRevenue * 1.1) : 0

  const getCoaching = async () => {
    setAiLoading(true)
    setAiInsight("")
    try {
      const metricsContext = periodData.map(p => ({
        period: p.label,
        revenue: p.metrics?.revenue || 0,
        services: p.metrics?.serviceCount || 0,
        avgTicket: p.metrics?.avgTicket || 0,
      }))
      const res = await fetch("/api/metrics/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentMetrics: [{ location, revenue: active?.revenue || 0, serviceCount: active?.serviceCount || 0, avgTicket: active?.avgTicket || 0, stylistBreakdown: active ? [active] : [] }],
          previousMetrics: [],
          period: activePeriod,
          question: `Provide a coaching assessment for ${name} at ${location}. Their performance across periods: ${JSON.stringify(metricsContext)}. Revenue goal: ${fmt(revenueGoal)}. What should they focus on to improve?`,
        }),
      })
      const json = await res.json()
      setAiInsight(json.insight || json.error || "Unable to generate insights.")
    } catch {
      setAiInsight("Error generating coaching insights.")
    }
    setAiLoading(false)
  }

  if (!isOwner && !isManager) return null

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />

      {/* Back button */}
      <button onClick={() => router.push("/metrics")} style={{
        display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
        backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.2)",
        borderRadius: "8px", color: "rgba(205,201,192,0.6)", fontSize: "11px",
        fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: "24px",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_back</span>
        Back to Metrics
      </button>

      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "28px" }}>
        <div style={{
          width: "72px", height: "72px", borderRadius: "50%",
          backgroundColor: "#1a2a32", border: "2px solid #CDC9C0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", fontWeight: 800, color: "#CDC9C0",
        }}>
          {initials}
        </div>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            {name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "4px",
              backgroundColor: location === "Corpus Christi" ? "rgba(99,102,241,0.12)" : "rgba(16,185,129,0.12)",
              color: location === "Corpus Christi" ? "#818CF8" : "#10B981",
            }}>
              {location}
            </span>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div style={{
        display: "inline-flex", gap: "2px", backgroundColor: "#1a2a32",
        padding: "3px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.08)",
        marginBottom: "24px",
      }}>
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setActivePeriod(p.value)} style={{
            padding: "7px 14px", fontSize: "10px", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            borderRadius: "6px", border: "none", cursor: "pointer",
            backgroundColor: activePeriod === p.value ? "#CDC9C0" : "transparent",
            color: activePeriod === p.value ? "#0f1d24" : "rgba(205,201,192,0.45)",
            transition: "all 0.15s",
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "24px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ backgroundColor: "#1a2a32", borderRadius: "10px", padding: "20px", height: "100px", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "24px" }}>
            {[
              { label: "Net Sales", value: fmt(active?.revenue || 0), icon: "payments" },
              { label: "Services", value: String(active?.serviceCount || 0), icon: "content_cut" },
              { label: "Avg Ticket", value: fmt(active?.avgTicket || 0), icon: "receipt_long" },
            ].map(card => (
              <div key={card.label} style={{
                backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.1)",
                borderRadius: "10px", padding: "20px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" }}>{card.label}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "rgba(205,201,192,0.25)" }}>{card.icon}</span>
                </div>
                <div style={{ fontSize: "32px", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Performance comparison table */}
          <div style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", marginBottom: "24px", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(205,201,192,0.08)" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 800, color: "#FFFFFF", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Performance Across Periods
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "rgba(205,201,192,0.04)" }}>
                    {["Period", "Net Sales", "Services", "Avg Ticket"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: "9px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: h === "Period" ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodData.map(p => (
                    <tr key={p.period} style={{
                      borderBottom: "1px solid rgba(205,201,192,0.06)",
                      backgroundColor: p.period === activePeriod ? "rgba(205,201,192,0.04)" : "transparent",
                    }}>
                      <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>{p.label}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "14px", fontWeight: 800, color: "#CDC9C0" }}>{p.metrics ? fmt(p.metrics.revenue) : "\u2014"}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{p.metrics?.serviceCount ?? "\u2014"}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>{p.metrics && p.metrics.avgTicket > 0 ? fmt(p.metrics.avgTicket) : "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue Goal */}
          {revenueGoal > 0 && (
            <div style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", padding: "20px", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Revenue Goal — 10% Above Best Period</div>
                  <div style={{ fontSize: "13px", color: "#94A3B8" }}>
                    Best: {fmt(bestRevenue)} &middot; Goal: {fmt(revenueGoal)} &middot; Current ({PERIODS.find(p => p.value === activePeriod)?.label}): {fmt(active?.revenue || 0)}
                  </div>
                </div>
                <div style={{
                  fontSize: "24px", fontWeight: 800,
                  color: (active?.revenue || 0) >= revenueGoal ? "#10B981" : (active?.revenue || 0) >= bestRevenue * 0.75 ? "#CDC9C0" : "#F59E0B",
                }}>
                  {revenueGoal > 0 ? `${Math.round(((active?.revenue || 0) / revenueGoal) * 100)}%` : "\u2014"}
                </div>
              </div>
              <div style={{ height: "8px", backgroundColor: "rgba(205,201,192,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(revenueGoal > 0 ? ((active?.revenue || 0) / revenueGoal) * 100 : 0, 100)}%`,
                  backgroundColor: (active?.revenue || 0) >= revenueGoal ? "#10B981" : (active?.revenue || 0) >= bestRevenue * 0.75 ? "#CDC9C0" : "#F59E0B",
                  borderRadius: "4px", transition: "width 1s ease",
                }} />
              </div>
            </div>
          )}

          {/* AI Coaching */}
          <div style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: "10px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(205,201,192,0.1)", border: "1px solid rgba(205,201,192,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#CDC9C0" }}>psychology</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Coaching</h3>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>Personalized performance insights for {name.split(" ")[0]}</p>
              </div>
              <button onClick={getCoaching} disabled={aiLoading} style={{
                padding: "8px 16px", backgroundColor: "#CDC9C0", border: "none",
                borderRadius: "7px", color: "#0f1d24", fontSize: "10px", fontWeight: 800,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: aiLoading ? "not-allowed" : "pointer", opacity: aiLoading ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
                {aiLoading ? "Analyzing..." : "Get Coaching"}
              </button>
            </div>

            {aiLoading && (
              <div style={{ backgroundColor: "#0f1d24", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "8px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#CDC9C0", animation: "spin 1s linear infinite" }}>sync</span>
                <span style={{ fontSize: "13px", color: "#94A3B8" }}>Reyna AI is analyzing {name.split(" ")[0]}&apos;s performance data...</span>
              </div>
            )}
            {aiInsight && !aiLoading && (
              <div style={{ backgroundColor: "#0f1d24", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "8px", padding: "16px 20px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
                  Reyna AI Coaching
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
