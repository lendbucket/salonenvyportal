"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useUserRole } from "@/hooks/useUserRole"

/* ── Types ── */
interface KPI {
  revenue: number
  checkouts: number
  avgTicket: number
  rebookRate: number
  targets: { revenue: number; checkouts: number; avgTicket: number; rebookRate: number }
  deltas: { revenue: number | null; checkouts: number | null; avgTicket: number | null; rebookRate: number | null }
  commission: { servicesSubtotal: number; commissionRate: number; commissionAmount: number; tips: number; totalPayout: number }
}

interface Goal {
  id: string
  type: string
  label: string
  current: number
  target: number
  bonus: number | null
  period: string
  status: "ON_TRACK" | "BEHIND" | "MISSED" | "HIT"
  staffMemberName?: string
}

interface LeaderboardEntry {
  rank: number
  staffMemberId: string
  name: string
  checkouts: number
  revenue: number
  avgTicket: number
  isCurrentUser: boolean
}

interface Bonus {
  id: string
  staffMemberName: string
  goalLabel: string
  amount: number
  status: "PENDING" | "APPROVED" | "PAID" | "DENIED"
  createdAt: string
}

/* ── Helpers ── */
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

const PERIODS = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
]

const TABS = ["Overview", "Goals", "Leaderboard", "Bonuses"] as const
type Tab = (typeof TABS)[number]

const GOAL_STATUS_COLORS: Record<string, string> = {
  ON_TRACK: "#0d9488",
  BEHIND: "#d97706",
  MISSED: "#dc2626",
  HIT: "#2563eb",
}

const BONUS_STATUS_COLORS: Record<string, string> = {
  PENDING: "#ca8a04",
  APPROVED: "#0d9488",
  PAID: "#16a34a",
  DENIED: "#dc2626",
}

const GOAL_ICONS: Record<string, string> = {
  revenue: "payments",
  checkouts: "content_cut",
  avgTicket: "receipt",
  rebookRate: "event_repeat",
  retail: "shopping_bag",
  reviews: "star",
}

/* ── Styles ── */
const cardStyle: React.CSSProperties = {
  backgroundColor: "#FBFBFB",
  border: "1px solid rgba(26,19,19,0.07)",
  borderRadius: 12,
  padding: "20px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)",
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    backgroundColor: active ? "#7a8f96" : "transparent",
    color: active ? "#FBFBFB" : "rgba(26,19,19,0.5)",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  }
}

function selectStyle(): React.CSSProperties {
  return {
    padding: "6px 12px",
    fontSize: "11px",
    fontWeight: 600,
    backgroundColor: "#FBFBFB",
    border: "1px solid rgba(26,19,19,0.15)",
    borderRadius: "6px",
    color: "#1A1313",
    outline: "none",
    cursor: "pointer",
    appearance: "auto" as React.CSSProperties["appearance"],
  }
}

function btnStyle(variant: "primary" | "ghost" = "ghost"): React.CSSProperties {
  return {
    padding: variant === "primary" ? "0 16px" : "0 16px",
    height: variant === "primary" ? "40px" : "32px",
    fontSize: "10px",
    fontWeight: 700,
    borderRadius: variant === "primary" ? "8px" : "6px",
    border: variant === "primary" ? "none" : "1px solid rgba(26,19,19,0.2)",
    backgroundColor: variant === "primary" ? "#CDC9C0" : "transparent",
    color: variant === "primary" ? "#0f1d24" : "rgba(26,19,19,0.6)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  }
}

/* ── Progress bar component ── */
function ProgressBar({ pct, color = "#7a8f96", height = 6 }: { pct: number; color?: string; height?: number }) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  return (
    <div style={{ height: `${height}px`, backgroundColor: "rgba(205,201,192,0.1)", borderRadius: `${height / 2}px`, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${clamped}%`, backgroundColor: color, borderRadius: `${height / 2}px`, transition: "width 0.8s ease" }} />
    </div>
  )
}

/* ── Delta badge ── */
function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const isPos = delta >= 0
  return (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "2px 8px",
      borderRadius: "4px",
      backgroundColor: isPos ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      color: isPos ? "#10B981" : "#EF4444",
    }}>
      {isPos ? "\u2191" : "\u2193"} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

/* ── Status badge ── */
function StatusBadge({ status, colors }: { status: string; colors: Record<string, string> }) {
  const c = colors[status] || "#94A3B8"
  return (
    <span style={{
      fontSize: "9px", fontWeight: 800, padding: "3px 8px",
      borderRadius: "4px", letterSpacing: "0.1em",
      textTransform: "uppercase",
      backgroundColor: `${c}18`,
      color: c,
    }}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

/* ══════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════ */
export default function PerformancePage() {
  const { data: session } = useSession()
  const { isOwner, isManager, isStylist } = useUserRole()

  const [tab, setTab] = useState<Tab>("Overview")
  const [period, setPeriod] = useState("this_week")
  const [location, setLocation] = useState("Both")
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string }[]>([])
  const [selectedStaff, setSelectedStaff] = useState("")
  const [loading, setLoading] = useState(true)

  // Data states
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [bonuses, setBonuses] = useState<Bonus[]>([])

  // Goal modal
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [goalForm, setGoalForm] = useState({ type: "revenue", target: "", bonus: "", period: "monthly", staffMemberId: "" })
  const [goalSaving, setGoalSaving] = useState(false)

  // Bonus modal
  const [bonusModalOpen, setBonusModalOpen] = useState(false)
  const [bonusForm, setBonusForm] = useState({ staffMemberId: "", amount: "", reason: "" })
  const [bonusSaving, setBonusSaving] = useState(false)

  /* ── Load staff list for owner/manager ── */
  useEffect(() => {
    if (isStylist) return
    fetch("/api/staff")
      .then(r => r.json())
      .then(d => {
        const list = d.staff || d.members || []
        setStaffMembers(list.map((s: { id?: string; teamMemberId?: string; givenName?: string; familyName?: string; name?: string }) => ({
          id: s.id || s.teamMemberId || "",
          name: s.name || `${s.givenName || ""} ${s.familyName || ""}`.trim(),
        })))
      })
      .catch(() => {})
  }, [isStylist])

  /* ── Fetch data based on tab ── */
  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (selectedStaff) params.set("staffMemberId", selectedStaff)
      if (location !== "Both") params.set("locationId", location)
      const res = await fetch(`/api/performance/summary?${params}`)
      if (res.ok) {
        const data = await res.json()
        setKpi(data)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [period, selectedStaff, location])

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (selectedStaff) params.set("staffMemberId", selectedStaff)
      const res = await fetch(`/api/performance/goals?${params}`)
      if (res.ok) {
        const data = await res.json()
        setGoals(data.goals || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [period, selectedStaff])

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (location !== "Both") params.set("locationId", location)
      const res = await fetch(`/api/performance/leaderboard?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(data.entries || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [period, location])

  const fetchBonuses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (selectedStaff) params.set("staffMemberId", selectedStaff)
      const res = await fetch(`/api/performance/bonuses?${params}`)
      if (res.ok) {
        const data = await res.json()
        setBonuses(data.bonuses || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [period, selectedStaff])

  useEffect(() => {
    if (tab === "Overview") { fetchSummary(); fetchGoals() }
    else if (tab === "Goals") fetchGoals()
    else if (tab === "Leaderboard") fetchLeaderboard()
    else if (tab === "Bonuses") fetchBonuses()
  }, [tab, fetchSummary, fetchGoals, fetchLeaderboard, fetchBonuses])

  /* ── Goal creation ── */
  const handleCreateGoal = async () => {
    setGoalSaving(true)
    try {
      await fetch("/api/performance/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalForm),
      })
      setGoalModalOpen(false)
      setGoalForm({ type: "revenue", target: "", bonus: "", period: "monthly", staffMemberId: "" })
      fetchGoals()
    } catch { /* silent */ }
    setGoalSaving(false)
  }

  /* ── Bonus creation ── */
  const handleCreateBonus = async () => {
    setBonusSaving(true)
    try {
      await fetch("/api/performance/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bonusForm),
      })
      setBonusModalOpen(false)
      setBonusForm({ staffMemberId: "", amount: "", reason: "" })
      fetchBonuses()
    } catch { /* silent */ }
    setBonusSaving(false)
  }

  /* ── Bonus actions ── */
  const handleBonusAction = async (bonusId: string, action: "approve" | "deny" | "mark_paid") => {
    try {
      await fetch(`/api/performance/bonuses/${bonusId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      fetchBonuses()
    } catch { /* silent */ }
  }

  /* ── Current user rank for leaderboard ── */
  const currentUserEntry = useMemo(() => leaderboard.find(e => e.isCurrentUser), [leaderboard])

  /* ── Active goals for overview ── */
  const activeGoals = useMemo(() => goals.filter(g => g.status !== "MISSED" && g.status !== "HIT").slice(0, 3), [goals])

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "28px" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1A1313", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
          Performance
        </h1>
        <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>
          {isStylist ? "Your performance metrics and goals" : "Staff performance tracking, goals, and bonuses"}
        </p>
      </div>

      {/* ── Controls row ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Period selector */}
        <div style={{ display: "inline-flex", gap: "2px", backgroundColor: "#FBFBFB", padding: "3px", borderRadius: "8px", border: "1px solid rgba(26,19,19,0.1)" }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={pill(period === p.value)}>{p.label}</button>
          ))}
        </div>

        {/* Location selector (owner only) */}
        {isOwner && (
          <div style={{ display: "inline-flex", gap: "2px", backgroundColor: "#FBFBFB", padding: "3px", borderRadius: "8px", border: "1px solid rgba(26,19,19,0.1)" }}>
            {["Both", "Corpus Christi", "San Antonio"].map(loc => (
              <button key={loc} onClick={() => setLocation(loc)} style={pill(location === loc)}>
                {loc === "Corpus Christi" ? "CC" : loc === "San Antonio" ? "SA" : loc}
              </button>
            ))}
          </div>
        )}

        {/* Staff selector (owner/manager) */}
        {!isStylist && staffMembers.length > 0 && (
          <select
            value={selectedStaff}
            onChange={e => setSelectedStaff(e.target.value)}
            style={selectStyle()}
          >
            <option value="">All Staff</option>
            {staffMembers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "0", borderBottom: "1px solid rgba(26,19,19,0.06)", marginBottom: "24px" }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "none",
              borderBottom: tab === t ? "2px solid #7a8f96" : "2px solid transparent",
              backgroundColor: "transparent",
              color: tab === t ? "#1A1313" : "rgba(26,19,19,0.45)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
         TAB: Overview
         ══════════════════════════════════════ */}
      {tab === "Overview" && (
        <>
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ backgroundColor: "#FBFBFB", borderRadius: 12, padding: "20px", height: "120px", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : kpi ? (
            <>
              {/* KPI cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                {[
                  { label: "Revenue", value: fmt(kpi.revenue), target: `Target: ${fmt(kpi.targets.revenue)}`, pct: kpi.targets.revenue > 0 ? (kpi.revenue / kpi.targets.revenue) * 100 : 0, delta: kpi.deltas.revenue, icon: "payments" },
                  { label: "Checkouts", value: String(kpi.checkouts), target: `Target: ${kpi.targets.checkouts}`, pct: kpi.targets.checkouts > 0 ? (kpi.checkouts / kpi.targets.checkouts) * 100 : 0, delta: kpi.deltas.checkouts, icon: "content_cut" },
                  { label: "Avg Ticket", value: fmt(kpi.avgTicket), target: `Target: ${fmt(kpi.targets.avgTicket)}`, pct: kpi.targets.avgTicket > 0 ? (kpi.avgTicket / kpi.targets.avgTicket) * 100 : 0, delta: kpi.deltas.avgTicket, icon: "receipt" },
                  { label: "Rebook Rate", value: fmtPct(kpi.rebookRate), target: `Target: ${fmtPct(kpi.targets.rebookRate)}`, pct: kpi.targets.rebookRate > 0 ? (kpi.rebookRate / kpi.targets.rebookRate) * 100 : 0, delta: kpi.deltas.rebookRate, icon: "event_repeat" },
                ].map(card => (
                  <div key={card.label} style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.06em", textTransform: "uppercase" }}>{card.label}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "rgba(26,19,19,0.3)" }}>{card.icon}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "28px", fontWeight: 800, color: "#1A1313", letterSpacing: "-0.02em", fontFamily: "Inter, sans-serif" }}>{card.value}</span>
                      <DeltaBadge delta={card.delta} />
                    </div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "10px" }}>{card.target}</div>
                    <ProgressBar pct={card.pct} color={card.pct >= 100 ? "#10B981" : card.pct >= 75 ? "#7a8f96" : "#f59e0b"} />
                  </div>
                ))}
              </div>

              {/* Commission breakdown */}
              <div style={{ ...cardStyle, marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#7a8f96" }}>account_balance_wallet</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.06em", textTransform: "uppercase" }}>Commission Breakdown</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px" }}>
                  {[
                    { label: "Services Subtotal", value: fmt(kpi.commission.servicesSubtotal), color: "#1A1313" },
                    { label: `Commission (${(kpi.commission.commissionRate * 100).toFixed(0)}%)`, value: fmt(kpi.commission.commissionAmount), color: "#10B981" },
                    { label: "Tips", value: fmt(kpi.commission.tips), color: "#10B981" },
                    { label: "Total Payout", value: fmt(kpi.commission.totalPayout), color: "#22c55e" },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: "10px", fontWeight: 600, color: "#606E74", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: item.color, fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active goals preview */}
              {activeGoals.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#7a8f96" }}>flag</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.06em", textTransform: "uppercase" }}>Active Goals</span>
                    </div>
                    <button onClick={() => setTab("Goals")} style={{ ...btnStyle(), padding: "4px 10px", fontSize: "9px" }}>
                      View All
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {activeGoals.map(g => {
                      const pct = g.target > 0 ? (g.current / g.target) * 100 : 0
                      return (
                        <div key={g.id} style={{ padding: "12px", backgroundColor: "rgba(26,19,19,0.02)", borderRadius: "8px", border: "1px solid rgba(26,19,19,0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#7a8f96" }}>{GOAL_ICONS[g.type] || "flag"}</span>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#1A1313" }}>{g.label}</span>
                            </div>
                            <StatusBadge status={g.status} colors={GOAL_STATUS_COLORS} />
                          </div>
                          <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }}>
                            <span style={{ fontFamily: "Inter, sans-serif", color: "#CDC9C0" }}>{g.current}</span> / {g.target} ({pct.toFixed(0)}%)
                          </div>
                          <ProgressBar pct={pct} color={GOAL_STATUS_COLORS[g.status] || "#7a8f96"} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ ...cardStyle, textAlign: "center", padding: "40px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "rgba(26,19,19,0.2)", marginBottom: "12px", display: "block" }}>trending_up</span>
              <div style={{ fontSize: "13px", color: "#94A3B8" }}>No performance data available for this period.</div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
         TAB: Goals
         ══════════════════════════════════════ */}
      {tab === "Goals" && (
        <>
          {(isOwner || isManager) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button onClick={() => setGoalModalOpen(true)} style={btnStyle("primary")}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                Create Goal
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ backgroundColor: "#FBFBFB", borderRadius: 12, padding: "20px", height: "100px", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : goals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {goals.map(g => {
                const pct = g.target > 0 ? (g.current / g.target) * 100 : 0
                return (
                  <div key={g.id} style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "8px",
                          backgroundColor: "rgba(122,143,150,0.1)", border: "1px solid rgba(122,143,150,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#7a8f96" }}>{GOAL_ICONS[g.type] || "flag"}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", marginBottom: "2px" }}>{g.label}</div>
                          {g.staffMemberName && <div style={{ fontSize: "11px", color: "#606E74" }}>{g.staffMemberName}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {g.bonus !== null && g.bonus > 0 && (
                          <span style={{
                            fontSize: "9px", fontWeight: 800, padding: "3px 8px",
                            borderRadius: "4px", letterSpacing: "0.08em",
                            backgroundColor: "rgba(16,185,129,0.1)", color: "#10B981",
                          }}>
                            {fmt(g.bonus)} BONUS
                          </span>
                        )}
                        <StatusBadge status={g.status} colors={GOAL_STATUS_COLORS} />
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "8px" }}>
                      <span style={{ fontFamily: "Inter, sans-serif", color: "#CDC9C0", fontWeight: 700 }}>{g.current}</span>
                      {" / "}
                      <span style={{ fontFamily: "Inter, sans-serif" }}>{g.target}</span>
                      {" "}
                      <span style={{ color: "#606E74" }}>({pct.toFixed(0)}%)</span>
                    </div>
                    <ProgressBar pct={pct} color={GOAL_STATUS_COLORS[g.status] || "#7a8f96"} height={8} />
                    <div style={{ marginTop: "8px", fontSize: "10px", color: "#606E74", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {g.period}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: "center", padding: "40px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "rgba(26,19,19,0.2)", marginBottom: "12px", display: "block" }}>flag</span>
              <div style={{ fontSize: "13px", color: "#94A3B8" }}>No goals set for this period.</div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
         TAB: Leaderboard
         ══════════════════════════════════════ */}
      {tab === "Leaderboard" && (
        <>
          {currentUserEntry && (
            <div style={{ ...cardStyle, marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#f59e0b" }}>emoji_events</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313" }}>
                You are ranked <span style={{ fontFamily: "Inter, sans-serif", color: "#4da6ff" }}>#{currentUserEntry.rank}</span> of <span style={{ fontFamily: "Inter, sans-serif", color: "#CDC9C0" }}>{leaderboard.length}</span> stylists
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ backgroundColor: "#FBFBFB", borderRadius: 12, padding: "20px", height: "300px", animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : leaderboard.length > 0 ? (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.06)" }}>
                    {["Rank", "Name", "Checkouts", "Revenue", "Avg Ticket"].map(h => (
                      <th key={h} style={{
                        padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "rgba(26,19,19,0.4)",
                        letterSpacing: "0.06em", textTransform: "uppercase", textAlign: h === "Name" ? "left" : "right",
                        background: "#F4F5F7",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map(entry => {
                    const isMe = entry.isCurrentUser
                    const displayName = isStylist && !isMe
                      ? entry.name.charAt(0) + "****** " + entry.name.split(" ").pop()?.charAt(0) + "."
                      : entry.name
                    return (
                      <tr key={entry.staffMemberId} style={{
                        borderBottom: "1px solid rgba(26,19,19,0.05)",
                        backgroundColor: isMe ? "rgba(77,166,255,0.06)" : "transparent",
                      }}>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <span style={{
                            fontFamily: "Inter, sans-serif", fontSize: "14px", fontWeight: 800,
                            color: entry.rank <= 3 ? "#f59e0b" : "#CDC9C0",
                          }}>
                            {entry.rank}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "left" }}>
                          <span style={{ fontSize: "14px", fontWeight: isMe ? 800 : 600, color: isMe ? "#4da6ff" : "#1A1313" }}>
                            {displayName}
                          </span>
                          {isMe && <span style={{ fontSize: "9px", color: "#4da6ff", marginLeft: "6px", fontWeight: 700 }}>(YOU)</span>}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#CDC9C0" }}>
                          {entry.checkouts}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#10B981" }}>
                          {fmt(entry.revenue)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#CDC9C0" }}>
                          {fmt(entry.avgTicket)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: "center", padding: "40px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "rgba(26,19,19,0.2)", marginBottom: "12px", display: "block" }}>leaderboard</span>
              <div style={{ fontSize: "13px", color: "#94A3B8" }}>No leaderboard data available for this period.</div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
         TAB: Bonuses
         ══════════════════════════════════════ */}
      {tab === "Bonuses" && (
        <>
          {isOwner && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button onClick={() => setBonusModalOpen(true)} style={btnStyle("primary")}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                Create Bonus
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ backgroundColor: "#FBFBFB", borderRadius: 12, padding: "20px", height: "80px", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : bonuses.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {bonuses.map(b => (
                <div key={b.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313" }}>{b.staffMemberName}</span>
                        <StatusBadge status={b.status} colors={BONUS_STATUS_COLORS} />
                      </div>
                      <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }}>{b.goalLabel}</div>
                      <div style={{ fontSize: "10px", color: "#606E74" }}>
                        {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "22px", fontWeight: 800, color: "#10B981", fontFamily: "Inter, sans-serif" }}>
                        {fmt(b.amount)}
                      </span>
                      {isOwner && b.status === "PENDING" && (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => handleBonusAction(b.id, "approve")}
                            style={{ ...btnStyle(), padding: "5px 10px", fontSize: "9px", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleBonusAction(b.id, "deny")}
                            style={{ ...btnStyle(), padding: "5px 10px", fontSize: "9px", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
                          >
                            Deny
                          </button>
                        </div>
                      )}
                      {isOwner && b.status === "APPROVED" && (
                        <button
                          onClick={() => handleBonusAction(b.id, "mark_paid")}
                          style={{ ...btnStyle(), padding: "5px 10px", fontSize: "9px", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: "center", padding: "40px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "rgba(26,19,19,0.2)", marginBottom: "12px", display: "block" }}>redeem</span>
              <div style={{ fontSize: "13px", color: "#94A3B8" }}>No bonuses recorded for this period.</div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
         MODAL: Create Goal
         ══════════════════════════════════════ */}
      {goalModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setGoalModalOpen(false)}
        >
          <div style={{ ...cardStyle, width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#1A1313", margin: 0 }}>Create Goal</h2>
              <button onClick={() => setGoalModalOpen(false)} style={{ background: "none", border: "none", color: "rgba(26,19,19,0.5)", cursor: "pointer" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Type */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Goal Type</label>
                <select value={goalForm.type} onChange={e => setGoalForm(f => ({ ...f, type: e.target.value }))} style={{ ...selectStyle(), width: "100%", padding: "10px 12px" }}>
                  <option value="revenue">Revenue</option>
                  <option value="checkouts">Checkouts</option>
                  <option value="avgTicket">Avg Ticket</option>
                  <option value="rebookRate">Rebook Rate</option>
                  <option value="retail">Retail Sales</option>
                  <option value="reviews">Reviews</option>
                </select>
              </div>

              {/* Staff member */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Staff Member</label>
                <select value={goalForm.staffMemberId} onChange={e => setGoalForm(f => ({ ...f, staffMemberId: e.target.value }))} style={{ ...selectStyle(), width: "100%", padding: "10px 12px" }}>
                  <option value="">All Staff</option>
                  {staffMembers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Target */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Target</label>
                <input
                  type="number"
                  value={goalForm.target}
                  onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))}
                  placeholder="e.g. 5000"
                  style={{ width: "100%", padding: "10px 12px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.08)", borderRadius: "8px", color: "#1A1313", fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Bonus */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Bonus Amount (optional)</label>
                <input
                  type="number"
                  value={goalForm.bonus}
                  onChange={e => setGoalForm(f => ({ ...f, bonus: e.target.value }))}
                  placeholder="e.g. 100"
                  style={{ width: "100%", padding: "10px 12px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.08)", borderRadius: "8px", color: "#1A1313", fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Period */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Period</label>
                <select value={goalForm.period} onChange={e => setGoalForm(f => ({ ...f, period: e.target.value }))} style={{ ...selectStyle(), width: "100%", padding: "10px 12px" }}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              <button
                onClick={handleCreateGoal}
                disabled={goalSaving || !goalForm.target}
                style={{
                  ...btnStyle("primary"),
                  justifyContent: "center",
                  padding: "12px",
                  opacity: goalSaving || !goalForm.target ? 0.5 : 1,
                }}
              >
                {goalSaving ? "Saving..." : "Create Goal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
         MODAL: Create Bonus
         ══════════════════════════════════════ */}
      {bonusModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setBonusModalOpen(false)}
        >
          <div style={{ ...cardStyle, width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#1A1313", margin: 0 }}>Create Bonus</h2>
              <button onClick={() => setBonusModalOpen(false)} style={{ background: "none", border: "none", color: "rgba(26,19,19,0.5)", cursor: "pointer" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Staff member */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Staff Member</label>
                <select value={bonusForm.staffMemberId} onChange={e => setBonusForm(f => ({ ...f, staffMemberId: e.target.value }))} style={{ ...selectStyle(), width: "100%", padding: "10px 12px" }}>
                  <option value="">Select staff member...</option>
                  {staffMembers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Amount</label>
                <input
                  type="number"
                  value={bonusForm.amount}
                  onChange={e => setBonusForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 150"
                  style={{ width: "100%", padding: "10px 12px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.08)", borderRadius: "8px", color: "#1A1313", fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Reason */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Reason</label>
                <input
                  type="text"
                  value={bonusForm.reason}
                  onChange={e => setBonusForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Hit monthly revenue goal"
                  style={{ width: "100%", padding: "10px 12px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.08)", borderRadius: "8px", color: "#1A1313", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <button
                onClick={handleCreateBonus}
                disabled={bonusSaving || !bonusForm.staffMemberId || !bonusForm.amount}
                style={{
                  ...btnStyle("primary"),
                  justifyContent: "center",
                  padding: "12px",
                  opacity: bonusSaving || !bonusForm.staffMemberId || !bonusForm.amount ? 0.5 : 1,
                }}
              >
                {bonusSaving ? "Saving..." : "Create Bonus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
