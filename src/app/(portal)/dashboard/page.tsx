"use client"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"

interface StylistMetrics {
  teamMemberId: string
  name: string
  homeLocation: string
  revenue: number
  serviceCount: number
  avgTicket: number
}

interface LocationMetrics {
  location: string
  revenue: number
  serviceCount: number
  avgTicket: number
  stylistBreakdown: StylistMetrics[]
}

interface CancellationStats {
  totalCancellations: number
  cancelledByCustomer: number
  cancelledBySeller: number
  noShows: number
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function timeAgo(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  if (mins < 60) return `${mins} mins ago`
  return `${Math.round(mins / 60)}h ago`
}

function Skeleton() {
  return (
    <div style={{
      height: "32px",
      width: "80px",
      backgroundColor: "rgba(205,201,192,0.1)",
      borderRadius: "6px",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  )
}

function generateAlerts(
  metrics: LocationMetrics[],
  cancellations: CancellationStats | null,
  activePeriod: string
) {
  const periodLabel: Record<string, string> = {
    today: "today", yesterday: "yesterday", "7days": "in the last 7 days",
    "30days": "in the last 30 days", "90days": "in the last 90 days",
    week: "this week", month: "this month", year: "this year",
  }
  const pLabel = periodLabel[activePeriod] || activePeriod
  const alerts: { priority: string; color: string; icon: string; text: string }[] = []

  // No-shows
  if (cancellations && cancellations.noShows >= 5) {
    alerts.push({ priority: "URGENT", color: "#EF4444", icon: "priority_high", text: `${cancellations.noShows} no-shows ${pLabel}. Immediate action required — consider deposits or confirmation calls.` })
  } else if (cancellations && cancellations.noShows >= 2) {
    alerts.push({ priority: "HIGH", color: "#F59E0B", icon: "warning", text: `${cancellations.noShows} no-shows ${pLabel}. Consider implementing a confirmation policy.` })
  }

  // Total cancellations
  if (cancellations && cancellations.totalCancellations >= 15) {
    alerts.push({ priority: "URGENT", color: "#EF4444", icon: "priority_high", text: `High cancellation volume ${pLabel}: ${cancellations.totalCancellations} total cancellations.` })
  }

  // Client cancellations
  if (cancellations && cancellations.cancelledByCustomer >= 8) {
    alerts.push({ priority: "HIGH", color: "#F59E0B", icon: "warning", text: `${cancellations.cancelledByCustomer} client-initiated cancellations ${pLabel}. Review booking flow.` })
  }

  // Zero-service stylists
  const allStylists = metrics.flatMap((m) => m.stylistBreakdown || [])
  const zeroServiceStylists = allStylists.filter((s) => s.serviceCount === 0)
  if (zeroServiceStylists.length > 0) {
    alerts.push({ priority: "MEDIUM", color: "#CDC9C0", icon: "info", text: `${zeroServiceStylists.length} stylist(s) with 0 services ${pLabel}: ${zeroServiceStylists.map((s) => s.name.split(" ")[0]).join(", ")}.` })
  }

  // No revenue
  const totalRevenue = metrics.reduce((s, d) => s + d.revenue, 0)
  if (totalRevenue === 0 && metrics.length > 0) {
    alerts.push({ priority: "MEDIUM", color: "#CDC9C0", icon: "info", text: `No revenue recorded ${pLabel}. Data may still be syncing.` })
  }

  // Location performance gap
  if (metrics.length >= 2) {
    const sorted = [...metrics].sort((a, b) => b.revenue - a.revenue)
    const gap = sorted[0].revenue - sorted[sorted.length - 1].revenue
    if (gap > 1000) {
      alerts.push({ priority: "MEDIUM", color: "#CDC9C0", icon: "info", text: `Location performance gap of ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(gap)} ${pLabel} between ${sorted[0].location} and ${sorted[sorted.length - 1].location}.` })
    }
  }

  // All good
  if (alerts.length === 0) {
    alerts.push({ priority: "ALL GOOD", color: "#22c55e", icon: "check_circle", text: "No issues detected. All systems running smoothly." })
  }

  return alerts.map((alert, idx) => (
    <div key={idx} style={{
      backgroundColor: "#1a2a32",
      border: "1px solid rgba(205,201,192,0.08)",
      borderLeft: `3px solid ${alert.color}`,
      borderRadius: "0 8px 8px 0",
      padding: "14px 16px",
      display: "flex",
      gap: "12px",
    }}>
      <span className="material-symbols-outlined" style={{ color: alert.color, fontSize: "18px", flexShrink: 0 }}>{alert.icon}</span>
      <div>
        <div style={{ fontSize: "9px", fontWeight: 800, color: alert.color, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "3px" }}>
          {alert.priority}
        </div>
        <div style={{ fontSize: "12px", color: "#CBD5E1", lineHeight: 1.4 }}>{alert.text}</div>
      </div>
    </div>
  ))
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { isOwner, isManager, locationName: userLocation } = useUserRole()
  const [activeLocation, setActiveLocation] = useState("Both")
  const [activePeriod, setActivePeriod] = useState("today")
  const [metricsData, setMetricsData] = useState<LocationMetrics[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [cancellations, setCancellations] = useState<CancellationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [now, setNow] = useState(Date.now()) // for re-rendering timeAgo

  const userName = session?.user?.name?.split(" ")[0] || "Robert"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  }).toUpperCase()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: activePeriod })
      if (activeLocation !== "Both") params.set("location", activeLocation)

      const [metricsRes, approvalsRes, cancellationsRes] = await Promise.all([
        fetch(`/api/metrics/live?${params}`),
        fetch("/api/approvals/pending"),
        fetch("/api/cancellations?period=7days"),
      ])
      const metricsJson = await metricsRes.json()
      const approvalsJson = await approvalsRes.json()
      const cancellationsJson = await cancellationsRes.json()

      setMetricsData(metricsJson.metrics || [])
      setPendingCount(approvalsJson.users?.length || 0)
      setCancellations(cancellationsJson.stats || null)
      setUpdatedAt(new Date())
    } catch {
      // silent fail — show zeros
    } finally {
      setLoading(false)
    }
  }, [activeLocation, activePeriod])

  useEffect(() => { fetchData() }, [fetchData])

  // Update "time ago" every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Compute totals from fetched data
  const totalRevenue = metricsData.reduce((s, d) => s + d.revenue, 0)
  const totalServices = metricsData.reduce((s, d) => s + d.serviceCount, 0)
  const totalAvg = totalServices > 0 ? totalRevenue / totalServices : 0

  // Auto-refresh when viewing today
  useEffect(() => {
    if (activePeriod !== "today") return
    const id = setInterval(() => { fetchData() }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [activePeriod, fetchData])

  const periodLabel: Record<string, string> = { today: "Today", yesterday: "Yesterday", "7days": "7 Days", "30days": "30 Days", "90days": "90 Days", week: "This Week", month: "This Month", year: "This Year" }
  const pLabel = periodLabel[activePeriod] || activePeriod

  const metrics = [
    { label: `Net Sales · ${pLabel}`, value: loading ? null : fmt(totalRevenue), icon: "payments", sub: activeLocation === "Both" ? "Both locations" : activeLocation },
    { label: `Services · ${pLabel}`, value: loading ? null : String(totalServices), icon: "content_cut", sub: "Across all stylists" },
    { label: "Avg Ticket", value: loading ? null : fmt(totalAvg), icon: "receipt_long", sub: "Per service" },
    { label: "Pending Approvals", value: loading ? null : String(pendingCount), icon: "rule", sub: "Needs attention", alert: pendingCount > 0 },
  ]

  // Compute all stylists from metrics for reuse
  const allStylists: StylistMetrics[] = metricsData.flatMap((m) => m.stylistBreakdown || [])
  const topStylist = allStylists.length > 0 ? [...allStylists].sort((a, b) => b.revenue - a.revenue)[0] : null

  const quickActions = [
    { href: "/inventory/add", icon: "add_box", label: "Add Inventory" },
    { href: "/schedule", icon: "calendar_today", label: "Build Schedule" },
    { href: "/approvals", icon: "task_alt", label: "Review Approvals" },
    { href: "/pos", icon: "point_of_sale", label: "POS Terminal" },
  ]

  // suppress unused var warning
  void now

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} } @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.5)} }`}</style>

      {/* HERO HEADER */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "5px" }}>
          <h1 style={{
            fontSize: "32px",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}>
            {greeting}, {userName}{isManager && userLocation ? ` \u2014 ${userLocation}` : ""}          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <p style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#94A3B8",
            letterSpacing: "0.15em",
            textTransform: "uppercase" as const,
            margin: 0,
          }}>
            {dateStr}
          </p>
          {updatedAt && (
            <span style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "rgba(205,201,192,0.4)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#10B981", display: "inline-block", animation: activePeriod === "today" ? "pulse-dot 2s ease-in-out infinite" : "none" }} />
              {activePeriod === "today" ? "Live" : "Updated"} · {timeAgo(updatedAt)}
              {activePeriod === "today" && <span style={{ fontSize: "9px", color: "rgba(16,185,129,0.6)", marginLeft: "4px" }}>auto-refreshes</span>}
            </span>
          )}
        </div>
      </div>

      {/* QUICK STATS BAR */}
      {!loading && (
        <div style={{ marginBottom: "16px", fontSize: "12px", color: "rgba(205,201,192,0.45)", fontWeight: 500 }}>
          This week: {fmt(totalRevenue)} net sales &middot; {totalServices} services{cancellations ? ` \u00b7 ${cancellations.totalCancellations} cancellations` : ""} &middot; Avg ticket {fmt(totalAvg)}
        </div>
      )}

      {/* PERIOD + LOCATION TABS */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" as const }}>
        <div style={{
          display: "inline-flex",
          gap: "2px",
          backgroundColor: "#1a2a32",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid rgba(205,201,192,0.08)",
        }}>
          {[
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yest" },
            { key: "7days", label: "7D" },
            { key: "30days", label: "30D" },
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
            { key: "year", label: "Year" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActivePeriod(key)}
              style={{
                padding: "7px 14px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                backgroundColor: activePeriod === key ? "#CDC9C0" : "transparent",
                color: activePeriod === key ? "#0f1d24" : "rgba(205,201,192,0.45)",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{
          display: "inline-flex",
          gap: "2px",
          backgroundColor: "#1a2a32",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid rgba(205,201,192,0.08)",
        }}>
        {(isOwner ? ["Both", "Corpus Christi", "San Antonio"] : [userLocation || "Both"]).map((loc) => (
          <button
            key={loc}
            onClick={() => setActiveLocation(loc)}
            style={{
              padding: "7px 16px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeLocation === loc ? "#CDC9C0" : "transparent",
              color: activeLocation === loc ? "#0f1d24" : "rgba(205,201,192,0.45)",
              transition: "all 0.15s",
            }}
          >
            {loc === "Corpus Christi" ? "CC" : loc === "San Antonio" ? "SA" : loc}
          </button>
        ))}
        </div>
      </div>

      {/* METRIC CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "14px",
        marginBottom: "20px",
      }}>
        {metrics.map((m) => (
          <div key={m.label} style={{
            backgroundColor: "#1a2a32",
            border: m.alert ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(205,201,192,0.1)",
            borderRadius: "10px",
            padding: "20px",
            transition: "transform 0.15s, box-shadow 0.15s",
            cursor: "default",
            position: "relative",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <span style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "#CDC9C0",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
              }}>
                {m.label}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: m.alert ? "#EF4444" : "rgba(205,201,192,0.25)" }}>
                {m.icon}
              </span>
            </div>
            <div style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1,
              marginBottom: "6px",
              letterSpacing: "-0.02em",
            }}>
              {m.value === null ? <Skeleton /> : m.value}
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500 }}>
              {m.sub}
            </div>
            {m.alert && (
              <div style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#EF4444",
              }} />
            )}
          </div>
        ))}
      </div>

      {/* STATUS CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "14px",
        marginBottom: "20px",
      }}>
        {/* Cancellations */}
        <Link href="/cancellations" style={{ textDecoration: "none" }}>
          <div style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(205,201,192,0.1)",
            borderRadius: "10px",
            padding: "20px",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0" }}>event_busy</span>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Cancellations</span>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, marginBottom: "6px", letterSpacing: "-0.02em" }}>
              {cancellations?.totalCancellations ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500 }}>
              {cancellations ? `${cancellations.noShows} no-shows \u00b7 ${cancellations.cancelledByCustomer} client cancelled` : "Loading..."}
            </div>
          </div>
        </Link>

        {/* Top Stylist */}
        <Link href="/metrics" style={{ textDecoration: "none" }}>
          <div style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(205,201,192,0.1)",
            borderRadius: "10px",
            padding: "20px",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0" }}>star</span>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Top Stylist</span>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, marginBottom: "6px", letterSpacing: "-0.02em" }}>
              {topStylist ? topStylist.name.split(" ")[0] : "\u2014"}
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500 }}>
              {topStylist ? `${topStylist.homeLocation === "Corpus Christi" ? "CC" : "SA"} \u00b7 ${topStylist.serviceCount} services` : "No data yet"}
            </div>
          </div>
        </Link>

        {/* Retention */}
        <Link href="/retention" style={{ textDecoration: "none" }}>
          <div style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(205,201,192,0.1)",
            borderRadius: "10px",
            padding: "20px",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0" }}>favorite</span>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Retention</span>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#FFFFFF", lineHeight: 1, marginBottom: "6px", letterSpacing: "-0.02em" }}>
              Run
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500 }}>
              Full analysis available
            </div>
          </div>
        </Link>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{
        backgroundColor: "#1a2a32",
        border: "1px solid rgba(205,201,192,0.1)",
        borderRadius: "10px",
        padding: "16px 20px",
        display: "flex",
        flexWrap: "nowrap" as const,
        overflowX: "auto",
        gap: "10px",
        alignItems: "center",
        marginBottom: "20px",
      }}>
        <span style={{
          fontSize: "9px",
          fontWeight: 700,
          color: "rgba(205,201,192,0.35)",
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          marginRight: "6px",
          flexShrink: 0,
        }}>
          Quick Actions
        </span>
        {quickActions.map(({ href, icon, label }) => (
          <Link key={href} href={href} style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 16px",
            backgroundColor: "transparent",
            border: "1px solid rgba(205,201,192,0.25)",
            borderRadius: "7px",
            color: "#CDC9C0",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{icon}</span>
            {label}
          </Link>
        ))}
        <Link href="/reyna-ai" style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "9px 20px",
          backgroundColor: "#CDC9C0",
          borderRadius: "7px",
          color: "#0f1d24",
          textDecoration: "none",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          marginLeft: "auto",
          boxShadow: "0 2px 8px rgba(205,201,192,0.15)",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
          Ask Reyna AI
        </Link>
      </div>

      {/* BENTO: ACTIVITY + ALERTS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "20px",
      }}>
        {/* Recent Activity / Stylist Leaderboard */}
        <div style={{
          backgroundColor: "#1a2a32",
          border: "1px solid rgba(205,201,192,0.1)",
          borderRadius: "10px",
          padding: "24px",
          minHeight: "340px",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: 0 }}>
              {allStylists.length > 0 ? "Stylist Leaderboard" : "Recent Activity"}
            </h3>
            <span className="material-symbols-outlined" style={{ color: "rgba(205,201,192,0.25)", fontSize: "18px" }}>
              {allStylists.length > 0 ? "leaderboard" : "history"}
            </span>
          </div>
          {allStylists.length > 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              {[...allStylists].sort((a, b) => b.serviceCount - a.serviceCount).slice(0, 5).map((s, i) => (
                <div key={s.teamMemberId} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: i === 0 ? "rgba(205,201,192,0.06)" : "transparent",
                  border: i === 0 ? "1px solid rgba(205,201,192,0.12)" : "1px solid transparent",
                }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 800,
                    backgroundColor: i === 0 ? "rgba(234,179,8,0.15)" : "rgba(205,201,192,0.06)",
                    color: i === 0 ? "#EAB308" : "rgba(205,201,192,0.5)",
                    border: i === 0 ? "1px solid rgba(234,179,8,0.3)" : "1px solid rgba(205,201,192,0.1)",
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: i === 0 ? "#FFFFFF" : "rgba(205,201,192,0.8)", fontSize: "13px", fontWeight: 600 }}>{s.name}</span>
                      <span style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: s.homeLocation === "Corpus Christi" ? "rgba(99,102,241,0.12)" : "rgba(16,185,129,0.12)",
                        color: s.homeLocation === "Corpus Christi" ? "#818CF8" : "#10B981",
                      }}>
                        {s.homeLocation === "Corpus Christi" ? "CC" : "SA"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)", marginTop: "2px" }}>
                      {s.serviceCount} services
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: i === 0 ? "#FFFFFF" : "rgba(205,201,192,0.7)" }}>
                      {fmt(s.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.35 }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "1.5px dashed rgba(205,201,192,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "14px",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#CDC9C0" }}>sync</span>
              </div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 3px" }}>Awaiting Activity</p>
              <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>The portal is synchronized.</p>
            </div>
          )}
        </div>

        {/* Admin Alerts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ fontSize: "9px", fontWeight: 800, color: "#CDC9C0", letterSpacing: "0.2em", textTransform: "uppercase" as const, margin: "0 0 2px" }}>
            Admin Alerts
          </h3>
          {generateAlerts(metricsData, cancellations, activePeriod)}
          <div style={{
            backgroundColor: "#0a151b",
            border: "1px solid rgba(205,201,192,0.08)",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center" as const,
          }}>
            <div style={{ fontSize: "8px", fontWeight: 700, color: "rgba(205,201,192,0.3)", letterSpacing: "0.25em", textTransform: "uppercase" as const, marginBottom: "6px" }}>
              System Health
            </div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", marginBottom: "10px" }}>Optimal</div>
            <div style={{ display: "flex", justifyContent: "center", gap: "3px" }}>
              <div style={{ height: "2px", width: "28px", backgroundColor: "#CDC9C0", borderRadius: "4px" }} />
              <div style={{ height: "2px", width: "28px", backgroundColor: "rgba(205,201,192,0.15)", borderRadius: "4px" }} />
              <div style={{ height: "2px", width: "28px", backgroundColor: "rgba(205,201,192,0.15)", borderRadius: "4px" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
