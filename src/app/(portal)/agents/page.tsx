"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Bot, Play, Pause, TrendingUp, Send, UserCheck, DollarSign } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }

const AGENTS = [
  { name: "reyna_recovery", displayName: "Reyna Recovery", desc: "Identifies high-value lapsed clients and drafts personalized recovery SMS for owner approval.", href: "/agents/reyna-recovery", icon: <UserCheck size={20} strokeWidth={1.5} /> },
  { name: "no_show_predictor", displayName: "No-Show Predictor", desc: "Predicts clients likely to no-show and suggests pre-appointment confirmations.", href: "#", icon: <Bot size={20} strokeWidth={1.5} />, coming: true },
  { name: "cross_sell", displayName: "Cross-Sell Engine", desc: "Recommends complementary services based on visit history and popular add-ons.", href: "#", icon: <TrendingUp size={20} strokeWidth={1.5} />, coming: true },
  { name: "stylist_coach", displayName: "Stylist Coach", desc: "Analyzes stylist performance and suggests coaching opportunities.", href: "#", icon: <Bot size={20} strokeWidth={1.5} />, coming: true },
  { name: "inventory", displayName: "Inventory Agent", desc: "Monitors product usage patterns and suggests reorder points.", href: "#", icon: <Bot size={20} strokeWidth={1.5} />, coming: true },
]

export default function AgentsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [agentData, setAgentData] = useState<any>(null)

  useEffect(() => {
    fetch("/api/agents/reyna-recovery").then(r => r.json()).then(d => setAgentData(d)).catch(() => {})
  }, [])

  const agent = agentData?.agent

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Bot size={20} strokeWidth={1.5} color={ACC} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: 0, letterSpacing: "-0.31px" }}>AI Agents</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {AGENTS.map(a => {
          const isReyna = a.name === "reyna_recovery"
          const status = isReyna && agent ? agent.status : "coming"
          const statusColor = status === "active" ? "#15803d" : status === "paused" ? "#a16207" : "rgba(26,19,19,0.35)"
          const statusBg = status === "active" ? "rgba(34,197,94,0.1)" : status === "paused" ? "rgba(234,179,8,0.1)" : "rgba(26,19,19,0.04)"

          return (
            <div key={a.name} style={{ ...cardStyle, opacity: a.coming ? 0.5 : 1, position: "relative" }}>
              {a.coming && <div style={{ position: "absolute", top: 12, right: 12, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, backgroundColor: "rgba(26,19,19,0.04)", color: "rgba(26,19,19,0.35)" }}>Coming soon</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${ACC}15`, color: ACC, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>{a.displayName}</div>
                  <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 600, backgroundColor: statusBg, color: statusColor }}>{status === "coming" ? "Coming soon" : status}</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "rgba(26,19,19,0.5)", lineHeight: 1.5, margin: "0 0 16px" }}>{a.desc}</p>
              {isReyna && agent && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "Drafted", value: agent.totalDrafted, icon: <Send size={12} /> },
                    { label: "Approved", value: agent.totalApproved, icon: <Play size={12} /> },
                    { label: "Sent", value: agent.totalSent, icon: <Send size={12} /> },
                    { label: "Revenue", value: `$${(agent.revenueAttributed || 0).toFixed(0)}`, icon: <DollarSign size={12} /> },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1313" }}>{s.value}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {!a.coming && (
                <Link href={a.href} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  Open Dashboard
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
