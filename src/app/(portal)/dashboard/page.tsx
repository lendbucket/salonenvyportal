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
  checkoutCount: number
  avgTicket: number
}

interface LocationMetrics {
  location: string
  revenue: number
  checkoutCount: number
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
      backgroundColor: "rgba(26,19,19,0.08)",
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

  // Zero-checkout stylists (exclude any stylist with revenue > $0)
  const allStylists = metrics.flatMap((m) => m.stylistBreakdown || [])
  const zeroCheckoutStylists = allStylists.filter((s) => s.checkoutCount === 0 && s.revenue === 0)
  if (zeroCheckoutStylists.length > 0) {
    alerts.push({ priority: "MEDIUM", color: "#CDC9C0", icon: "info", text: `${zeroCheckoutStylists.length} stylist(s) with 0 checkouts ${pLabel}: ${zeroCheckoutStylists.map((s) => s.name.split(" ")[0]).join(", ")}.` })
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
      backgroundColor: "#FBFBFB",
      border: "1px solid rgba(26,19,19,0.05)",
      borderLeft: `3px solid ${alert.color}`,
      borderRadius: "0 12px 12px 0",
      padding: "14px 16px",
      display: "flex",
      gap: "12px",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
    }}>
      <span className="material-symbols-outlined" style={{ color: alert.color, fontSize: "18px", flexShrink: 0 }}>{alert.icon}</span>
      <div>
        <div style={{ fontSize: "9px", fontWeight: 800, color: alert.color, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "3px" }}>
          {alert.priority}
        </div>
        <div style={{ fontSize: "12px", color: "rgba(26,19,19,0.65)", lineHeight: 1.4 }}>{alert.text}</div>
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
  const [retention, setRetention] = useState<{ retentionRate: number; retentionGrade: string } | null>(null)
  const [retentionLoading, setRetentionLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [now, setNow] = useState(Date.now()) // for re-rendering timeAgo
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [licenseStatus, setLicenseStatus] = useState<{ verified: boolean; expired: boolean; expiringSoon: boolean; daysUntilExpiry: number | null; expirationDate: string | null } | null>(null)

  // Drill-down panel state
  const [drillDown, setDrillDown] = useState<{
    type: "net_sales" | "checkouts" | "cancellations" | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summary: any
    loading: boolean
    title: string
    error: string | null
  }>({ type: null, data: [], summary: null, loading: false, title: "", error: null })
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null)

  const closeDrill = () => setDrillDown({ type: null, data: [], summary: null, loading: false, title: "", error: null })

  const openDrillDown = async (type: "net_sales" | "checkouts" | "cancellations") => {
    setDrillDown({ type, data: [], summary: null, loading: true, error: null,
      title: type === "net_sales" ? "Net Sales" : type === "checkouts" ? "Checkouts" : "Cancellations",
    })
    setExpandedTxn(null)
    try {
      const params = new URLSearchParams({ type, period: activePeriod })
      if (activeLocation !== "Both") params.set("location", activeLocation)
      const res = await fetch(`/api/metrics/drill-down?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setDrillDown(prev => ({ ...prev, loading: false, data: json.transactions || json.cancellations || [], summary: json.summary || null }))
    } catch (err: unknown) {
      setDrillDown(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : "Failed" }))
    }
  }

  const exportCSV = () => {
    if (!drillDown.data.length) return
    let csv = ""
    if (drillDown.type === "cancellations") {
      csv = "Client,Phone,Appointment Date,Appointment Time,Stylist,Location,Service,Cancelled By,Cancelled At\n"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      csv += drillDown.data.map((c: any) => `"${c.clientName}","${c.clientPhone || ""}","${c.appointmentDate || ""}","${c.appointmentTime}","${c.stylist?.name}","${c.stylist?.location}","${c.service}","${c.cancelledBy}","${c.cancelledAtFormatted || ""}"`).join("\n")
    } else if (drillDown.type === "checkouts") {
      csv = "Check-in,Checkout,Client,Stylist,Location,Services,Payment,Last4,Total\n"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      csv += drillDown.data.map((t: any) => `"${t.checkInTime || ""}","${t.checkOutTime || t.time}","${t.client?.name}","${t.stylist?.name}","${t.stylist?.location}","${t.services?.map((s: { name: string }) => s.name).join("; ")}","${t.payment?.method}","${t.payment?.last4 || ""}",${t.amounts?.total}`).join("\n")
    } else {
      csv = "Time,Client,Stylist,Location,Services,Payment,Last4,Subtotal,Tips,Tax,Fee,Total\n"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      csv += drillDown.data.map((t: any) => `"${t.time}","${t.client?.name}","${t.stylist?.name}","${t.stylist?.location}","${t.services?.map((s: { name: string }) => s.name).join("; ")}","${t.payment?.method}","${t.payment?.last4 || ""}",${t.amounts?.subtotal},${t.amounts?.tip},${t.amounts?.tax},${t.amounts?.processingFee},${t.amounts?.total}`).join("\n")
    }
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${drillDown.type}_${activePeriod}_${activeLocation}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const PAYMENT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    VISA: { bg: "rgba(26,115,232,0.15)", color: "#60a5fa", border: "rgba(26,115,232,0.3)" },
    MASTERCARD: { bg: "rgba(235,95,52,0.15)", color: "#fb923c", border: "rgba(235,95,52,0.3)" },
    AMEX: { bg: "rgba(0,114,206,0.15)", color: "#7dd3fc", border: "rgba(0,114,206,0.3)" },
    DISCOVER: { bg: "rgba(255,127,0,0.15)", color: "#fb923c", border: "rgba(255,127,0,0.3)" },
    CASH: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", border: "rgba(34,197,94,0.3)" },
    CARD: { bg: "rgba(148,163,184,0.15)", color: "rgba(26,19,19,0.45)", border: "rgba(148,163,184,0.3)" },
    OTHER: { bg: "rgba(148,163,184,0.15)", color: "rgba(26,19,19,0.45)", border: "rgba(148,163,184,0.3)" },
  }
  const payStyle = (method: string) => PAYMENT_COLORS[method] || PAYMENT_COLORS.OTHER

  const userName = session?.user?.name?.split(" ")[0] || "User"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  }).toUpperCase()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams({ period: activePeriod })
      if (activeLocation !== "Both") params.set("location", activeLocation)
      if (activePeriod === "custom" && customStart && customEnd) {
        params.set("startDate", customStart)
        params.set("endDate", customEnd)
      }

      const cancelParams = new URLSearchParams({ period: activePeriod })
      if (activeLocation !== "Both") cancelParams.set("location", activeLocation)

      const [metricsRes, approvalsRes, cancellationsRes] = await Promise.all([
        fetch(`/api/metrics/live?${params}`),
        fetch("/api/approvals/pending"),
        fetch(`/api/cancellations?${cancelParams}`),
      ])
      const metricsJson = await metricsRes.json()
      const approvalsJson = await approvalsRes.json()
      const cancellationsJson = await cancellationsRes.json()

      setMetricsData(metricsJson.metrics || [])
      setPendingCount(approvalsJson.users?.length || 0)
      setCancellations(cancellationsJson.stats || null)
      setUpdatedAt(new Date())
    } catch {
      setFetchError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [activeLocation, activePeriod, customStart, customEnd])

  useEffect(() => { fetchData() }, [fetchData])

  // Update "time ago" every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Compute totals from fetched data
  const totalRevenue = metricsData.reduce((s, d) => s + d.revenue, 0)
  const totalCheckouts = metricsData.reduce((s, d) => s + d.checkoutCount, 0)
  const totalAvg = totalCheckouts > 0 ? totalRevenue / totalCheckouts : 0

  // Auto-refresh when viewing today
  useEffect(() => {
    if (activePeriod !== "today") return
    const id = setInterval(() => { fetchData() }, 60 * 1000)
    return () => clearInterval(id)
  }, [activePeriod, fetchData])

  // Retention auto-fetch on mount + every 60s
  useEffect(() => {
    const fetchRetention = async () => {
      setRetentionLoading(true)
      try {
        const rParams = new URLSearchParams()
        if (activeLocation !== "Both") rParams.set("location", activeLocation)
        const res = await fetch(`/api/retention?${rParams}`)
        if (res.ok) {
          const data = await res.json()
          setRetention({ retentionRate: data.retentionRate, retentionGrade: data.retentionGrade })
        } else {
          setRetention(null)
        }
      } catch {
        setRetention(null)
      } finally {
        setRetentionLoading(false)
      }
    }
    fetchRetention()
    const id = setInterval(fetchRetention, 60000)
    return () => clearInterval(id)
  }, [activeLocation])

  // License status fetch for stylists/managers
  useEffect(() => {
    if (isOwner) return
    fetch("/api/staff/me/license-status").then(r => r.json()).then(d => setLicenseStatus(d)).catch(() => {})
  }, [isOwner])

  const customLabel = customStart && customEnd ? `${new Date(customStart + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(customEnd + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Custom"
  const periodLabel: Record<string, string> = { today: "Today", yesterday: "Yesterday", "7days": "7 Days", "30days": "30 Days", "90days": "90 Days", week: "This Week", month: "This Month", year: "This Year", custom: customLabel }
  const pLabel = periodLabel[activePeriod] || activePeriod
  const summaryPeriodLabel: Record<string, string> = { today: "Today", yesterday: "Yesterday", "7days": "Last 7 days", "30days": "Last 30 days", "90days": "Last 90 days", week: "This week", month: "This month", year: "This year", custom: customLabel }
  const summaryLabel = summaryPeriodLabel[activePeriod] || activePeriod

  const metrics = [
    { label: `Net Sales · ${pLabel}`, value: loading ? null : fmt(totalRevenue), icon: "payments", sub: activeLocation === "Both" ? "Both locations" : activeLocation, drillType: "net_sales" as const },
    { label: `Checkouts · ${pLabel}`, value: loading ? null : String(totalCheckouts), icon: "content_cut", sub: "Unique customers checked out", drillType: "checkouts" as const },
    { label: "Avg Ticket", value: loading ? null : fmt(totalAvg), icon: "receipt_long", sub: "Per checkout", drillType: "net_sales" as const },
    { label: "Pending Approvals", value: loading ? null : String(pendingCount), icon: "rule", sub: "Needs attention", alert: pendingCount > 0, drillType: null },
  ]

  // Compute all stylists from metrics for reuse
  const allStylists: StylistMetrics[] = metricsData.flatMap((m) => m.stylistBreakdown || [])
  // Only consider stylists with actual checkouts and revenue for "top" designation
  const activeStylists = allStylists.filter((s) => s.checkoutCount > 0 && s.revenue > 0)
  const topStylist = activeStylists.length > 0 ? [...activeStylists].sort((a, b) => b.revenue - a.revenue)[0] : null

  const quickActions = [
    { href: "/inventory/add", icon: "add_box", label: "Add Inventory" },
    { href: "/schedule", icon: "calendar_today", label: "Build Schedule" },
    { href: "/approvals", icon: "task_alt", label: "Review Approvals" },
    { href: "/pos", icon: "point_of_sale", label: "POS Terminal" },
  ]

  // suppress unused var warning
  void now

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} } @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.5)} }`}</style>

      {/* HERO HEADER */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "5px" }}>
          <h1 style={{
            fontSize: "32px",
            fontWeight: 800,
            color: "#1A1313",
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
            color: "rgba(26,19,19,0.45)",
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
              color: "rgba(26,19,19,0.4)",
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

      {/* License banner for non-owners */}
      {licenseStatus && !isOwner && !licenseStatus.verified && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "13px", color: "#f59e0b", fontWeight: 600 }}>License Not Verified</div>
            <div style={{ fontSize: "12px", color: "#7a8f96", marginTop: "2px" }}>Verify your cosmetology license to complete your profile</div>
          </div>
          <Link href="/settings?tab=license" style={{ background: "transparent", border: "1px solid #f59e0b", color: "#f59e0b", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", textDecoration: "none", whiteSpace: "nowrap" }}>Verify Now</Link>
        </div>
      )}
      {licenseStatus && !isOwner && licenseStatus.verified && licenseStatus.expired && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "13px", color: "#ef4444", fontWeight: 600 }}>License Expired</div>
            <div style={{ fontSize: "12px", color: "#7a8f96", marginTop: "2px" }}>Your cosmetology license has expired. Please renew immediately.</div>
          </div>
          <Link href="/settings?tab=license" style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", textDecoration: "none", whiteSpace: "nowrap" }}>Update License</Link>
        </div>
      )}
      {licenseStatus && !isOwner && licenseStatus.verified && licenseStatus.expiringSoon && !licenseStatus.expired && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "13px", color: "#f59e0b", fontWeight: 600 }}>License Expiring Soon</div>
            <div style={{ fontSize: "12px", color: "#7a8f96", marginTop: "2px" }}>Your license expires in {licenseStatus.daysUntilExpiry} days. Renew before {licenseStatus.expirationDate ? new Date(licenseStatus.expirationDate).toLocaleDateString() : "expiry"}.</div>
          </div>
          <Link href="/settings?tab=license" style={{ background: "transparent", border: "1px solid #f59e0b", color: "#f59e0b", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", textDecoration: "none", whiteSpace: "nowrap" }}>Update License</Link>
        </div>
      )}

      {/* QUICK STATS BAR */}
      {!loading && (
        <div style={{ marginBottom: "16px", fontSize: "12px", color: "rgba(26,19,19,0.45)", fontWeight: 500 }}>
          {summaryLabel}{activeLocation === "Both" ? " · Both locations" : ` · ${activeLocation}`}: {fmt(totalRevenue)} net sales &middot; {totalCheckouts} checkouts{cancellations ? ` \u00b7 ${cancellations.totalCancellations} cancellations` : ""} &middot; Avg ticket {fmt(totalAvg)}
        </div>
      )}

      {/* PERIOD + LOCATION TABS */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" as const }}>
        <div style={{
          display: "inline-flex",
          gap: "2px",
          backgroundColor: "#FBFBFB",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid rgba(26,19,19,0.06)",
        }}>
          {[
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yest" },
            { key: "7days", label: "7D" },
            { key: "30days", label: "30D" },
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
            { key: "year", label: "Year" },
            { key: "custom", label: "Custom" },
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
                backgroundColor: activePeriod === key ? "#7a8f96" : "transparent",
                color: activePeriod === key ? "#FBFBFB" : "rgba(26,19,19,0.45)",
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
          backgroundColor: "#FBFBFB",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid rgba(26,19,19,0.06)",
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
              backgroundColor: activeLocation === loc ? "#7a8f96" : "transparent",
              color: activeLocation === loc ? "#FBFBFB" : "rgba(26,19,19,0.45)",
              transition: "all 0.15s",
            }}
          >
            {loc === "Corpus Christi" ? "CC" : loc === "San Antonio" ? "SA" : loc}
          </button>
        ))}
        </div>
      </div>

      {/* Custom date range inputs */}
      {activePeriod === "custom" && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#606E74", marginBottom: "4px" }}>From</div>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: "8px 12px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.12)", borderRadius: "8px", color: "#1A1313", fontSize: "14px", outline: "none", colorScheme: "light" }} />
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#606E74", marginBottom: "4px" }}>To</div>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: "8px 12px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.12)", borderRadius: "8px", color: "#1A1313", fontSize: "14px", outline: "none", colorScheme: "light" }} />
          </div>
          <button onClick={() => fetchData()} disabled={!customStart || !customEnd} style={{ padding: "6px 14px", border: "1px solid #606E74", borderRadius: "8px", backgroundColor: "transparent", color: "#7a8f96", fontSize: "13px", cursor: "pointer", opacity: (!customStart || !customEnd) ? 0.5 : 1 }}>Apply</button>
        </div>
      )}

      {/* Error state */}
      {fetchError && !loading && (
        <div style={{ background: '#FBFBFB', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 20, textAlign: 'center', margin: '20px 0' }}>
          <div style={{ color: '#ef4444', fontSize: 14, fontFamily: 'Inter, sans-serif', marginBottom: 8 }}>{fetchError}</div>
          <button onClick={() => { setFetchError(null); fetchData() }} style={{ background: 'transparent', border: '1px solid #606E74', color: '#7a8f96', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Retry</button>
        </div>
      )}

      {/* METRIC CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
        marginBottom: 24,
      }}>
        {metrics.map((m) => (
          <div key={m.label} onClick={() => m.drillType && openDrillDown(m.drillType)} style={{
            backgroundColor: "#FBFBFB",
            border: m.alert ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(26,19,19,0.05)",
            borderRadius: 12,
            padding: "20px",
            transition: "transform 0.15s, box-shadow 0.15s, background-color 0.15s",
            cursor: m.drillType ? "pointer" : "default",
            position: "relative",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
          }} onMouseEnter={e => { if (m.drillType) { e.currentTarget.style.backgroundColor = "#F4F5F7"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.06)" } }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#FBFBFB"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }}>
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
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: m.alert ? "#EF4444" : "rgba(26,19,19,0.25)" }}>
                {m.icon}
              </span>
            </div>
            <div style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#1A1313",
              lineHeight: 1,
              marginBottom: "6px",
              letterSpacing: "-0.02em",
            }}>
              {m.value === null ? <Skeleton /> : m.value}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.45)", fontWeight: 500 }}>
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
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Cancellations */}
        <div onClick={() => openDrillDown("cancellations")} style={{ cursor: "pointer" }}>
          <div style={{
            backgroundColor: "#FBFBFB",
            border: "1px solid rgba(26,19,19,0.05)",
            borderRadius: 12,
            padding: "20px",
            cursor: "pointer",
            transition: "background-color 0.15s, box-shadow 0.15s",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
          }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.06)" }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0" }}>event_busy</span>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Cancellations</span>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#1A1313", lineHeight: 1, marginBottom: "6px", letterSpacing: "-0.02em" }}>
              {cancellations?.totalCancellations ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.45)", fontWeight: 500 }}>
              {cancellations ? `${cancellations.noShows} no-shows \u00b7 ${cancellations.cancelledByCustomer} client cancelled` : "Loading..."}
            </div>
          </div>
        </div>

        {/* Top Stylist */}
        <Link href="/metrics" style={{ textDecoration: "none" }}>
          <div style={{
            backgroundColor: "#FBFBFB",
            border: "1px solid rgba(26,19,19,0.05)",
            borderRadius: 12,
            padding: "20px",
            cursor: "pointer",
            transition: "background-color 0.15s, box-shadow 0.15s",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
          }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.06)" }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0" }}>star</span>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Top Stylist</span>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#1A1313", lineHeight: 1, marginBottom: "6px", letterSpacing: "-0.02em" }}>
              {topStylist ? topStylist.name.split(" ")[0] : "\u2014"}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.45)", fontWeight: 500 }}>
              {topStylist ? `${topStylist.homeLocation === "Corpus Christi" ? "CC" : "SA"} \u00b7 ${topStylist.checkoutCount} checkouts \u00b7 ${fmt(topStylist.revenue)}` : "No checkouts yet"}
            </div>
          </div>
        </Link>

        {/* Retention */}
        <Link href="/retention" style={{ textDecoration: "none" }}>
          <div style={{
            backgroundColor: "#FBFBFB",
            border: "1px solid rgba(26,19,19,0.05)",
            borderRadius: 12,
            padding: "20px",
            cursor: "pointer",
            transition: "background-color 0.15s, box-shadow 0.15s",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
          }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.06)" }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0" }}>favorite</span>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Retention</span>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#1A1313", lineHeight: 1, marginBottom: "6px", letterSpacing: "-0.02em" }}>
              {retentionLoading ? <Skeleton /> : retention ? `${retention.retentionRate}%` : "\u2014"}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.45)", fontWeight: 500 }}>
              {retentionLoading ? "Loading retention..." : retention ? `${retention.retentionGrade} · Active clients returning` : "Retention unavailable"}
            </div>
          </div>
        </Link>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{
        backgroundColor: "#FBFBFB",
        border: "1px solid rgba(26,19,19,0.05)",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        flexWrap: "nowrap" as const,
        overflowX: "auto",
        gap: "10px",
        alignItems: "center",
        marginBottom: 24,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
      }}>
        <span style={{
          fontSize: "9px",
          fontWeight: 700,
          color: "rgba(26,19,19,0.35)",
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          marginRight: "6px",
          flexShrink: 0,
        }}>
          Quick Actions
        </span>
        {quickActions.map(({ href, icon, label }) => (
          <Link key={href} href={href} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            height: 32,
            borderRadius: 6,
            backgroundColor: "transparent",
            border: "1px solid rgba(26,19,19,0.1)",
            color: "rgba(26,19,19,0.65)",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap" as const,
            transition: "all 0.15s ease",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{icon}</span>
            {label}
          </Link>
        ))}
        <Link href="/reyna-ai" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "0 16px",
          height: 40,
          borderRadius: 8,
          backgroundColor: "#7a8f96",
          border: "1px solid #7a8f96",
          color: "#FBFBFB",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap" as const,
          marginLeft: "auto",
          boxShadow: "0 1px 2px rgba(122,143,150,0.3)",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
          Ask Reyna AI
        </Link>
      </div>

      {/* BENTO: ACTIVITY + ALERTS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 24,
      }}>
        {/* Recent Activity / Stylist Leaderboard */}
        <div style={{
          backgroundColor: "#FBFBFB",
          border: "1px solid rgba(26,19,19,0.05)",
          borderRadius: 12,
          padding: "24px",
          minHeight: "340px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: 800, color: "#1A1313", textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: 0 }}>
              {allStylists.length > 0 ? "Stylist Leaderboard" : "Recent Activity"}
            </h3>
            <span className="material-symbols-outlined" style={{ color: "rgba(26,19,19,0.25)", fontSize: "18px" }}>
              {allStylists.length > 0 ? "leaderboard" : "history"}
            </span>
          </div>
          {allStylists.length > 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              {[...allStylists].sort((a, b) => b.checkoutCount - a.checkoutCount).slice(0, 5).map((s, i) => (
                <div key={s.teamMemberId} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: i === 0 ? "rgba(26,19,19,0.04)" : "transparent",
                  border: i === 0 ? "1px solid rgba(26,19,19,0.06)" : "1px solid transparent",
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
                    backgroundColor: i === 0 ? "rgba(234,179,8,0.15)" : "rgba(26,19,19,0.04)",
                    color: i === 0 ? "#EAB308" : "rgba(26,19,19,0.5)",
                    border: i === 0 ? "1px solid rgba(234,179,8,0.3)" : "1px solid rgba(26,19,19,0.1)",
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: i === 0 ? "#1A1313" : "rgba(26,19,19,0.8)", fontSize: "13px", fontWeight: 600 }}>{s.name}</span>
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
                    <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.4)", marginTop: "2px" }}>
                      {s.checkoutCount} checkouts
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: i === 0 ? "#1A1313" : "rgba(26,19,19,0.7)" }}>
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
                border: "1.5px dashed rgba(26,19,19,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "14px",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#CDC9C0" }}>sync</span>
              </div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1A1313", margin: "0 0 3px" }}>Awaiting Activity</p>
              <p style={{ fontSize: "11px", color: "rgba(26,19,19,0.45)", margin: 0 }}>The portal is synchronized.</p>
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
            backgroundColor: "#F4F5F7",
            border: "1px solid rgba(26,19,19,0.05)",
            borderRadius: 12,
            padding: "20px",
            textAlign: "center" as const,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: "8px", fontWeight: 700, color: "rgba(26,19,19,0.3)", letterSpacing: "0.25em", textTransform: "uppercase" as const, marginBottom: "6px" }}>
              System Health
            </div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#1A1313", marginBottom: "10px" }}>Optimal</div>
            <div style={{ display: "flex", justifyContent: "center", gap: "3px" }}>
              <div style={{ height: "2px", width: "28px", backgroundColor: "#CDC9C0", borderRadius: "4px" }} />
              <div style={{ height: "2px", width: "28px", backgroundColor: "rgba(26,19,19,0.15)", borderRadius: "4px" }} />
              <div style={{ height: "2px", width: "28px", backgroundColor: "rgba(26,19,19,0.15)", borderRadius: "4px" }} />
            </div>
          </div>
        </div>
      </div>

      {/* DRILL-DOWN PANEL */}
      {drillDown.type && (
        <>
          <div onClick={closeDrill} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 200 }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 95vw)",
            backgroundColor: "#FBFBFB", borderLeft: "1px solid rgba(26,19,19,0.08)",
            zIndex: 201, display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid rgba(26,19,19,0.06)", flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1A1313", margin: "0 0 2px" }}>{drillDown.title}</h3>
                <p style={{ fontSize: "11px", color: "rgba(26,19,19,0.45)", margin: 0 }}>{pLabel} {activeLocation === "Both" ? "· Both locations" : `· ${activeLocation}`}</p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {drillDown.data.length > 0 && (
                  <button onClick={exportCSV} style={{ padding: "5px 12px", backgroundColor: "transparent", border: "1px solid rgba(26,19,19,0.2)", borderRadius: "6px", color: "#7a8f96", fontSize: "10px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>CSV</button>
                )}
                <button onClick={closeDrill} style={{ background: "none", border: "none", color: "rgba(26,19,19,0.45)", cursor: "pointer", fontSize: "24px", padding: "4px", lineHeight: 1 }}>&times;</button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
              {drillDown.loading ? (
                <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: "72px", backgroundColor: "rgba(26,19,19,0.04)", borderRadius: "8px", animation: "pulse 1.5s ease-in-out infinite" }} />)}
                </div>
              ) : drillDown.error ? (
                <div style={{ padding: "40px 24px", textAlign: "center", color: "#ef4444", fontSize: "13px" }}>{drillDown.error}</div>
              ) : drillDown.type === "cancellations" ? (
                drillDown.data.length === 0 ? (
                  <div style={{ padding: "60px 24px", textAlign: "center", color: "#606E74" }}>No cancellations in this period</div>
                ) : (
                  <div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {drillDown.data.map((c: any, i: number) => (
                      <div key={i} style={{ padding: "16px 24px", borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>{c.clientInitials || "?"}</div>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: "#1A1313" }}>{c.clientName || "Client"}</div>
                              {c.clientPhone && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "#7a8f96", marginTop: "1px" }}>{c.clientPhone}</div>}
                            </div>
                          </div>
                          <span style={{ fontSize: "9px", padding: "3px 10px", borderRadius: "4px", backgroundColor: c.cancelledBy === "client" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: c.cancelledBy === "client" ? "#ef4444" : "#f59e0b", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>{c.cancelledBy === "client" ? "BY CLIENT" : "BY SALON"}</span>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "6px" }}>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "#7a8f96" }}>{c.appointmentDate} {c.appointmentTime}</span>
                          <span style={{ fontSize: "11px", color: "#606E74" }}>{c.stylist?.name}</span>
                          <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", backgroundColor: c.stylist?.location === "CC" ? "rgba(99,102,241,0.12)" : "rgba(16,185,129,0.12)", color: c.stylist?.location === "CC" ? "#818CF8" : "#10B981", fontWeight: 700 }}>{c.stylist?.location}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", backgroundColor: "rgba(26,19,19,0.04)", border: "1px solid rgba(26,19,19,0.06)", color: "#7a8f96" }}>{c.service}</span>
                          <button onClick={(e) => { e.stopPropagation(); window.open(`https://squareup.com/appointments/buyer/widget/${c.locationId === "LTJSA6QR1HGW6" ? "LTJSA6QR1HGW6" : "LXJYXDXWR0XZF"}`, "_blank") }} style={{ padding: "5px 14px", backgroundColor: "transparent", border: "1px solid rgba(26,19,19,0.2)", borderRadius: "6px", color: "#7a8f96", fontSize: "10px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>event_repeat</span>
                            Rebook
                          </button>
                        </div>
                        {c.cancelledAtFormatted && <div style={{ fontSize: "10px", color: "#606E74", marginTop: "6px", fontStyle: "italic" }}>Cancelled at {c.cancelledAtFormatted}</div>}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Net Sales / Checkouts — full transaction detail */
                drillDown.data.length === 0 ? (
                  <div style={{ padding: "60px 24px", textAlign: "center", color: "#606E74" }}>No transactions in this period</div>
                ) : (
                  <>
                    {/* Summary strip */}
                    {drillDown.summary && (
                      <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid rgba(26,19,19,0.06)", flexShrink: 0 }}>
                        {[
                          { label: "Total", value: fmt(drillDown.summary.totalRevenue), color: "#1A1313" },
                          { label: "Tips", value: fmt(drillDown.summary.totalTips), color: "#22c55e" },
                          { label: "Tax", value: fmt(drillDown.summary.totalTax), color: "#606E74" },
                          { label: "Fees", value: `~${fmt(drillDown.summary.totalProcessingFees)}`, color: "#fb923c" },
                          { label: "Net", value: fmt(drillDown.summary.netAfterFees), color: "#1A1313" },
                          { label: "Count", value: String(drillDown.summary.transactionCount), color: "#7a8f96" },
                        ].map(s => (
                          <div key={s.label} style={{ flex: "1 0 auto", padding: "14px 16px", textAlign: "center", minWidth: "70px" }}>
                            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 700, color: s.color, marginBottom: "2px" }}>{s.value}</div>
                            <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(26,19,19,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Transaction list */}
                    <div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {drillDown.data.map((t: any) => {
                        const ps = payStyle(t.payment?.method || "OTHER")
                        const isExpanded = expandedTxn === t.id
                        return (
                          <div key={t.id} onClick={() => setExpandedTxn(isExpanded ? null : t.id)} style={{ padding: "14px 24px", borderBottom: "1px solid rgba(26,19,19,0.04)", cursor: "pointer", backgroundColor: isExpanded ? "rgba(26,19,19,0.02)" : "transparent", transition: "background-color 0.1s" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                              {/* Avatar for checkouts */}
                              {drillDown.type === "checkouts" && (
                                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "rgba(26,19,19,0.08)", border: "1px solid rgba(26,19,19,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#CDC9C0", flexShrink: 0 }}>{t.client?.initials || "W"}</div>
                              )}
                              {/* Left: time + client + services */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                                  {drillDown.type === "checkouts" && t.checkInTime ? (
                                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "#606E74", flexShrink: 0 }}>{t.checkInTime} <span style={{ color: "#22c55e" }}>&rarr;</span> <span style={{ color: "#22c55e" }}>{t.checkOutTime}</span></span>
                                  ) : (
                                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#7a8f96", flexShrink: 0 }}>{t.time}</span>
                                  )}
                                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1313", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.client?.name}</span>
                                </div>
                                <div style={{ fontSize: "12px", color: "#606E74", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {t.services?.map((s: { name: string }) => s.name).join(", ").slice(0, 45) || "Services"}
                                </div>
                              </div>

                              {/* Right: payment + stylist + total */}
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", marginBottom: "4px" }}>
                                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", padding: "2px 8px", borderRadius: "4px", backgroundColor: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, fontWeight: 600 }}>{t.payment?.method}</span>
                                  {t.payment?.last4 && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "#606E74" }}>{t.payment.last4}</span>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                                  <span style={{ fontSize: "11px", color: "#7a8f96" }}>{t.stylist?.name?.split(" ")[0]}</span>
                                  <span style={{ fontSize: "8px", padding: "1px 5px", borderRadius: "3px", backgroundColor: t.stylist?.location === "CC" ? "rgba(99,102,241,0.12)" : "rgba(16,185,129,0.12)", color: t.stylist?.location === "CC" ? "#818CF8" : "#10B981", fontWeight: 700 }}>{t.stylist?.location}</span>
                                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 700, color: "#1A1313", marginLeft: "4px" }}>{fmt(t.amounts?.total)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Expanded breakdown */}
                            {isExpanded && (
                              <div style={{ marginTop: "12px", padding: "12px 16px", backgroundColor: "rgba(26,19,19,0.04)", borderRadius: "8px", border: "1px solid rgba(26,19,19,0.04)" }}>
                                {[
                                  { label: "Subtotal", value: fmt(t.amounts?.subtotal), color: "#1A1313" },
                                  { label: "Tip", value: fmt(t.amounts?.tip), color: "#22c55e" },
                                  { label: "Tax", value: fmt(t.amounts?.tax), color: "#606E74" },
                                  { label: "Proc. Fee", value: `~${fmt(t.amounts?.processingFee)}`, color: "#fb923c", note: "estimated" },
                                  null,
                                  { label: "Total", value: fmt(t.amounts?.total), color: "#1A1313", bold: true },
                                ].map((row, ri) => row === null ? (
                                  <div key={ri} style={{ borderTop: "1px solid rgba(26,19,19,0.06)", margin: "6px 0" }} />
                                ) : (
                                  <div key={ri} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                                    <span style={{ fontSize: "12px", color: "#7a8f96" }}>{row.label}{row.note ? <span style={{ fontSize: "10px", color: "#606E74", fontStyle: "italic", marginLeft: "4px" }}>{row.note}</span> : ""}</span>
                                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: row.bold ? "14px" : "12px", fontWeight: row.bold ? 700 : 400, color: row.color }}>{row.value}</span>
                                  </div>
                                ))}
                                {/* Services list */}
                                <div style={{ marginTop: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                  {t.services?.map((s: { name: string; price: number }, si: number) => (
                                    <span key={si} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "6px", backgroundColor: "rgba(26,19,19,0.04)", border: "1px solid rgba(26,19,19,0.06)", color: "#7a8f96" }}>{s.name} <span style={{ fontFamily: "'Inter', sans-serif", color: "#1A1313" }}>{fmt(s.price)}</span></span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
