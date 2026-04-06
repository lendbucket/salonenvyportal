"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"

interface PayrollEntry {
  teamMemberId: string
  name: string
  location: "Corpus Christi" | "San Antonio"
  services: number
  subtotal: number
  commission: number
  tips: number
  periodStart: string
  periodEnd: string
}

type Preset = "current" | "last" | "this-month" | "custom"
type LocationFilter = "All" | "Corpus Christi" | "San Antonio"

function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Pay period runs Wednesday 12:00 AM CST → Tuesday 11:59:59 PM CST
function getPresetDates(preset: Preset): { start: string; end: string } {
  const now = new Date()
  const cstNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const day = cstNow.getDay() // 0=Sun..6=Sat

  switch (preset) {
    case "current": {
      // Find most recent Wednesday
      const daysBack = day >= 3 ? day - 3 : day + 4
      const wed = new Date(cstNow)
      wed.setDate(cstNow.getDate() - daysBack)
      const tue = new Date(wed)
      tue.setDate(wed.getDate() + 6)
      return { start: fmt(wed), end: fmt(tue) }
    }
    case "last": {
      const daysBack = day >= 3 ? day - 3 : day + 4
      const thisWed = new Date(cstNow)
      thisWed.setDate(cstNow.getDate() - daysBack)
      const prevTue = new Date(thisWed)
      prevTue.setDate(thisWed.getDate() - 1)
      const prevWed = new Date(prevTue)
      prevWed.setDate(prevTue.getDate() - 6)
      return { start: fmt(prevWed), end: fmt(prevTue) }
    }
    case "this-month": {
      const first = new Date(cstNow.getFullYear(), cstNow.getMonth(), 1)
      return { start: fmt(first), end: fmt(cstNow) }
    }
    default:
      return { start: fmt(cstNow), end: fmt(cstNow) }
  }
}

export default function PayrollPage() {
  const { isOwner } = useUserRole()

  const [preset, setPreset] = useState<Preset>("current")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("All")
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const dates = useMemo(() => {
    if (preset === "custom") return { start: customStart, end: customEnd }
    return getPresetDates(preset)
  }, [preset, customStart, customEnd])

  const fetchPayroll = useCallback(async () => {
    if (!dates.start || !dates.end) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/payroll?start=${dates.start}&end=${dates.end}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to load payroll")
      }
      const data = await res.json()
      setPayroll(data.payroll || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [dates.start, dates.end])

  useEffect(() => { fetchPayroll() }, [fetchPayroll])

  const filtered = useMemo(() => {
    if (locationFilter === "All") return payroll
    return payroll.filter(p => p.location === locationFilter)
  }, [payroll, locationFilter])

  const ccEntries = useMemo(() => filtered.filter(p => p.location === "Corpus Christi"), [filtered])
  const saEntries = useMemo(() => filtered.filter(p => p.location === "San Antonio"), [filtered])

  const totals = useMemo(() => {
    const t = { services: 0, subtotal: 0, commission: 0, tips: 0 }
    for (const p of filtered) {
      t.services += p.services
      t.subtotal += p.subtotal
      t.commission += p.commission
      t.tips += p.tips
    }
    return t
  }, [filtered])

  const stylistCount = filtered.filter(p => p.services > 0).length

  if (!isOwner) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "rgba(205,201,192,0.5)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "48px", marginBottom: "16px", display: "block" }}>lock</span>
        <div style={{ fontSize: "16px", fontWeight: 700 }}>Owner Access Only</div>
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#1a2a32",
    borderRadius: "12px",
    border: "1px solid rgba(205,201,192,0.08)",
    padding: "16px 20px",
  }

  const presetBtn = (p: Preset, label: string) => (
    <button
      key={p}
      onClick={() => setPreset(p)}
      style={{
        padding: "8px 14px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        border: preset === p ? "1px solid #CDC9C0" : "1px solid rgba(205,201,192,0.15)",
        borderRadius: "8px",
        backgroundColor: preset === p ? "rgba(205,201,192,0.12)" : "transparent",
        color: preset === p ? "#CDC9C0" : "rgba(205,201,192,0.5)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  )

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "12px",
    borderRadius: "8px",
    border: "1px solid rgba(205,201,192,0.15)",
    backgroundColor: "rgba(205,201,192,0.06)",
    color: "#CDC9C0",
    outline: "none",
  }

  function LocationTable({ entries, title }: { entries: PayrollEntry[]; title: string }) {
    const locTotals = entries.reduce(
      (acc, p) => ({
        services: acc.services + p.services,
        subtotal: acc.subtotal + p.subtotal,
        commission: acc.commission + p.commission,
        tips: acc.tips + p.tips,
      }),
      { services: 0, subtotal: 0, commission: 0, tips: 0 }
    )

    if (entries.length === 0) return null

    return (
      <div style={{ ...cardStyle, marginBottom: "16px", padding: 0, overflow: "hidden" }}>
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(205,201,192,0.08)",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#CDC9C0",
        }}>
          {title}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(205,201,192,0.08)" }}>
                {["Stylist", "Checkouts", "Subtotal", "Commission (40%)", "Tips", "Total Pay"].map(h => (
                  <th key={h} style={{
                    padding: "10px 16px",
                    textAlign: h === "Stylist" ? "left" : "right",
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(205,201,192,0.4)",
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries
                .sort((a, b) => b.subtotal - a.subtotal)
                .map(p => (
                  <tr key={p.teamMemberId} style={{ borderBottom: "1px solid rgba(205,201,192,0.04)" }}>
                    <td style={{ padding: "10px 16px", color: "#FFFFFF", fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "rgba(205,201,192,0.7)" }}>{p.services}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "rgba(205,201,192,0.7)" }}>{fmtCurrency(p.subtotal)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#10B981", fontWeight: 700 }}>{fmtCurrency(p.commission)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "rgba(205,201,192,0.7)" }}>{fmtCurrency(p.tips)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#CDC9C0", fontWeight: 700 }}>{fmtCurrency(p.commission + p.tips)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid rgba(205,201,192,0.12)" }}>
                <td style={{ padding: "12px 16px", color: "#CDC9C0", fontWeight: 800, fontSize: "12px" }}>TOTAL</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: "#CDC9C0", fontWeight: 700 }}>{locTotals.services}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: "#CDC9C0", fontWeight: 700 }}>{fmtCurrency(locTotals.subtotal)}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: "#10B981", fontWeight: 800 }}>{fmtCurrency(locTotals.commission)}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: "#CDC9C0", fontWeight: 700 }}>{fmtCurrency(locTotals.tips)}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: "#CDC9C0", fontWeight: 800 }}>{fmtCurrency(locTotals.commission + locTotals.tips)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Payroll Summary</h1>
        <p style={{ fontSize: "12px", color: "#94A3B8", margin: "4px 0 0" }}>
          Wed — Tue pay period · Pay date every Tuesday · 40% of service subtotal · CST
        </p>
      </div>

      {/* Controls */}
      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
          {presetBtn("current", "This Period")}
          {presetBtn("last", "Last Period")}
          {presetBtn("this-month", "This Month")}
          {presetBtn("custom", "Custom")}
        </div>

        {preset === "custom" && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={inputStyle}
            />
            <span style={{ color: "rgba(205,201,192,0.4)", alignSelf: "center", fontSize: "12px" }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          {(["All", "Corpus Christi", "San Antonio"] as LocationFilter[]).map(loc => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              style={{
                padding: "6px 12px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                border: locationFilter === loc ? "1px solid #CDC9C0" : "1px solid rgba(205,201,192,0.12)",
                borderRadius: "6px",
                backgroundColor: locationFilter === loc ? "rgba(205,201,192,0.1)" : "transparent",
                color: locationFilter === loc ? "#CDC9C0" : "rgba(205,201,192,0.4)",
                cursor: "pointer",
              }}
            >
              {loc === "Corpus Christi" ? "CC" : loc === "San Antonio" ? "SA" : loc}
            </button>
          ))}
        </div>

        {dates.start && dates.end && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: "rgba(205,201,192,0.4)" }}>
            Period: {dates.start} to {dates.end}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{
            width: "32px",
            height: "32px",
            border: "3px solid rgba(205,201,192,0.1)",
            borderTop: "3px solid #CDC9C0",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.4)" }}>Loading payroll data...</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px", color: "#EF4444" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", marginBottom: "8px", display: "block" }}>error</span>
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length > 0 && totals.services === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "rgba(205,201,192,0.2)", marginBottom: "8px", display: "block" }}>inbox</span>
          <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.4)" }}>No services found for this period</div>
        </div>
      )}

      {/* Summary stats */}
      {!loading && !error && totals.services > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Total Checkouts", value: String(totals.services) },
              { label: "Total Subtotal", value: fmtCurrency(totals.subtotal) },
              { label: "Total Commissions", value: fmtCurrency(totals.commission), green: true },
              { label: "Total Tips", value: fmtCurrency(totals.tips) },
              { label: "Total Pay", value: fmtCurrency(totals.commission + totals.tips), green: true },
              { label: "Avg per Stylist", value: stylistCount > 0 ? fmtCurrency((totals.commission + totals.tips) / stylistCount) : "$0.00", green: true },
            ].map(stat => (
              <div key={stat.label} style={cardStyle}>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: stat.green ? "#10B981" : "#FFFFFF" }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Location tables */}
          {(locationFilter === "All" || locationFilter === "Corpus Christi") && (
            <LocationTable entries={ccEntries} title="Corpus Christi" />
          )}
          {(locationFilter === "All" || locationFilter === "San Antonio") && (
            <LocationTable entries={saEntries} title="San Antonio" />
          )}

          {/* Grand total bar when viewing both */}
          {locationFilter === "All" && (
            <div style={{
              ...cardStyle,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              background: "linear-gradient(135deg, #1a2a32 0%, rgba(16,185,129,0.08) 100%)",
              border: "1px solid rgba(16,185,129,0.2)",
            }}>
              <div>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)" }}>
                  Grand Total — All Locations
                </div>
                <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", marginTop: "2px" }}>
                  {totals.services} services across {stylistCount} stylists
                </div>
              </div>
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)" }}>Subtotal</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF" }}>{fmtCurrency(totals.subtotal)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)" }}>Commission</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#10B981" }}>{fmtCurrency(totals.commission)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)" }}>Tips</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF" }}>{fmtCurrency(totals.tips)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)" }}>Total Pay</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#CDC9C0" }}>{fmtCurrency(totals.commission + totals.tips)}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
