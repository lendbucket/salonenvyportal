"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useUserRole } from "@/hooks/useUserRole"

interface CancellationEntry {
  bookingId: string
  status: "CANCELLED_BY_CUSTOMER" | "CANCELLED_BY_SELLER" | "NO_SHOW"
  scheduledAt: string
  createdAt: string
  customerId: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  isRepeatClient: boolean
  totalPastVisits: number
  lastVisitDate: string | null
  stylistId: string
  stylistName: string
  location: string
  locationId: string
  services: string[]
  durationMinutes: number
  cancelledBy: "Customer" | "Salon" | "No Show"
  lostRevenue: number
  updatedAt: string
}

interface CancellationStats {
  totalCancellations: number
  cancelledByCustomer: number
  cancelledBySeller: number
  noShows: number
  repeatClientCancellations: number
  newClientCancellations: number
  estimatedRevenueLost: number
  avgTicket: number
  byStylist: Record<string, number>
  byDay: Record<string, number>
}

interface CancellationData {
  cancellations: CancellationEntry[]
  stats: CancellationStats
}

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "7days", label: "This Week" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "This Month" },
]

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CANCELLED_BY_CUSTOMER: { bg: "rgba(245,158,11,0.08)", text: "#F59E0B", border: "#F59E0B" },
  CANCELLED_BY_SELLER: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444" },
  NO_SHOW: { bg: "rgba(249,115,22,0.08)", text: "#F97316", border: "#F97316" },
}

const STATUS_LABELS: Record<string, string> = {
  CANCELLED_BY_CUSTOMER: "Client Cancelled",
  CANCELLED_BY_SELLER: "Salon Cancelled",
  NO_SHOW: "No Show",
}

const fmtCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

function fmtDateTime(iso: string) {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
}

export default function CancellationsPage() {
  const { isOwner, locationName } = useUserRole()
  const [location, setLocation] = useState(locationName === "San Antonio" ? "SA" : "CC")
  const [period, setPeriod] = useState("7days")
  const [data, setData] = useState<CancellationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("All")
  const [search, setSearch] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cancellations?period=${period}&location=${location}`)
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`) }
      setData(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setLoading(false)
  }, [period, location])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.cancellations
    if (statusFilter !== "All") list = list.filter(c => c.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.customerName.toLowerCase().includes(q) || c.stylistName.toLowerCase().includes(q) || c.customerPhone.includes(q))
    }
    return list
  }, [data, statusFilter, search])

  return (
    <div style={{ padding: "24px", maxWidth: "960px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#fff", margin: 0 }}>Cancellations</h1>
        {isOwner && (
          <div style={{ display: "flex", gap: "4px" }}>
            {(["CC", "SA"] as const).map(l => (
              <button key={l} onClick={() => setLocation(l)} style={{
                padding: "7px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                borderRadius: "6px", border: "none", cursor: "pointer",
                backgroundColor: location === l ? "#CDC9C0" : "rgba(205,201,192,0.06)",
                color: location === l ? "#0f1d24" : "rgba(205,201,192,0.45)",
              }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {PERIODS.map((p, i) => (
          <button key={`${p.value}-${i}`} onClick={() => setPeriod(p.value)} style={{
            padding: "6px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
            borderRadius: "20px", border: "none", cursor: "pointer", whiteSpace: "nowrap",
            backgroundColor: period === p.value ? "#CDC9C0" : "rgba(205,201,192,0.06)",
            color: period === p.value ? "#0f1d24" : "rgba(205,201,192,0.45)",
          }}>{p.label}</button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "14px", marginBottom: "16px", color: "#EF4444", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(205,201,192,0.4)", fontSize: "13px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", display: "block", marginBottom: "8px", opacity: 0.4 }}>hourglass_empty</span>
          Analyzing cancellations...
        </div>
      )}

      {/* Data */}
      {data && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            {[
              { label: "Total", value: String(data.stats.totalCancellations), icon: "cancel" },
              { label: "By Customer", value: String(data.stats.cancelledByCustomer), icon: "person_off", color: "#F59E0B" },
              { label: "By Salon", value: String(data.stats.cancelledBySeller), icon: "store", color: "#EF4444" },
              { label: "No Shows", value: String(data.stats.noShows), icon: "visibility_off", color: "#F97316" },
              { label: "Lost Revenue", value: fmtCurrency(data.stats.estimatedRevenueLost), icon: "money_off", color: "#F59E0B" },
            ].map(c => (
              <div key={c.label} style={{ backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.08)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "rgba(205,201,192,0.35)" }}>{c.icon}</span>
                  <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)" }}>{c.label}</span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: c.color || "#CDC9C0", fontFamily: c.label === "Lost Revenue" ? "'Fira Code', monospace" : "inherit" }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
            {[{ v: "All", l: "All" }, { v: "CANCELLED_BY_CUSTOMER", l: "Client" }, { v: "CANCELLED_BY_SELLER", l: "Salon" }, { v: "NO_SHOW", l: "No Show" }].map(f => (
              <button key={f.v} onClick={() => setStatusFilter(f.v)} style={{
                padding: "5px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                borderRadius: "20px", border: "none", cursor: "pointer",
                backgroundColor: statusFilter === f.v ? "rgba(205,201,192,0.15)" : "rgba(205,201,192,0.04)",
                color: statusFilter === f.v ? "#fff" : "rgba(205,201,192,0.45)",
              }}>{f.l}</button>
            ))}
            <input
              type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(205,201,192,0.12)", backgroundColor: "rgba(205,201,192,0.04)", color: "#fff", fontSize: "12px", outline: "none", width: "180px" }}
            />
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#1a2a32", borderRadius: "12px", border: "1px solid rgba(205,201,192,0.08)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", display: "block", marginBottom: "12px", color: "rgba(16,185,129,0.3)" }}>check_circle</span>
              <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "14px", fontWeight: 600 }}>No cancellations for this period</div>
            </div>
          )}

          {/* Table */}
          {filtered.length > 0 && (
            <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(205,201,192,0.08)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "750px" }}>
                <thead>
                  <tr style={{ backgroundColor: "rgba(205,201,192,0.04)" }}>
                    {["Date/Time", "Client", "Stylist", "Services", "Duration", "Cancelled By", "Lost Revenue"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", borderBottom: "1px solid rgba(205,201,192,0.08)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const sc = STATUS_COLORS[c.status]
                    const isExpanded = expandedId === c.bookingId
                    return (
                      <tr key={c.bookingId}
                        onClick={() => setExpandedId(isExpanded ? null : c.bookingId)}
                        style={{ cursor: "pointer", transition: "background 0.1s", borderLeft: `3px solid ${sc.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(205,201,192,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "rgba(205,201,192,0.7)", borderBottom: "1px solid rgba(205,201,192,0.04)", whiteSpace: "nowrap" }}>
                          {fmtDateTime(c.scheduledAt)}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(205,201,192,0.04)" }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>{c.customerName}</div>
                          {c.isRepeatClient && <span style={{ fontSize: "8px", fontWeight: 700, padding: "1px 5px", borderRadius: "3px", backgroundColor: "rgba(16,185,129,0.12)", color: "#10B981" }}>REPEAT</span>}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "rgba(205,201,192,0.7)", borderBottom: "1px solid rgba(205,201,192,0.04)" }}>{c.stylistName}</td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(205,201,192,0.04)", maxWidth: "200px" }}>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {c.services.map((s, i) => (
                              <span key={i} style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "3px", backgroundColor: "rgba(205,201,192,0.06)", color: "rgba(205,201,192,0.55)" }}>{s}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "rgba(205,201,192,0.5)", borderBottom: "1px solid rgba(205,201,192,0.04)", whiteSpace: "nowrap" }}>
                          {c.durationMinutes > 0 ? `${c.durationMinutes} min` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(205,201,192,0.04)" }}>
                          <span style={{ fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", backgroundColor: sc.bg, color: sc.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {STATUS_LABELS[c.status]}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 700, color: "#F59E0B", fontFamily: "'Fira Code', monospace", borderBottom: "1px solid rgba(205,201,192,0.04)", textAlign: "right" }}>
                          {fmtCurrency(c.lostRevenue)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Expanded detail panel */}
          {expandedId && (() => {
            const c = filtered.find(x => x.bookingId === expandedId)
            if (!c) return null
            return (
              <div style={{
                position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end",
              }}>
                <div onClick={() => setExpandedId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
                <div style={{
                  position: "relative", width: "400px", maxWidth: "100%",
                  background: "#0d1117", borderLeft: "1px solid rgba(205,201,192,0.12)",
                  display: "flex", flexDirection: "column", overflow: "auto",
                }}>
                  <button onClick={() => setExpandedId(null)} style={{
                    position: "absolute", top: "16px", right: "16px", zIndex: 2,
                    background: "none", border: "none", color: "rgba(205,201,192,0.5)", cursor: "pointer", fontSize: "22px",
                  }}>&times;</button>

                  <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Status */}
                    <span style={{
                      alignSelf: "flex-start", fontSize: "9px", fontWeight: 700, padding: "4px 10px", borderRadius: "4px",
                      backgroundColor: STATUS_COLORS[c.status].bg, color: STATUS_COLORS[c.status].text,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>{STATUS_LABELS[c.status]}</span>

                    {/* Client */}
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{c.customerName}</div>
                      {c.customerPhone && <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.55)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>phone</span>{c.customerPhone}
                      </div>}
                      {c.customerEmail && <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.55)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>mail</span>{c.customerEmail}
                      </div>}
                    </div>

                    {/* Booking details */}
                    <div>
                      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "8px" }}>Booking Details</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                          <span style={{ color: "rgba(205,201,192,0.5)" }}>Scheduled</span>
                          <span style={{ color: "#fff" }}>{fmtDateTime(c.scheduledAt)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                          <span style={{ color: "rgba(205,201,192,0.5)" }}>Stylist</span>
                          <span style={{ color: "#fff" }}>{c.stylistName}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                          <span style={{ color: "rgba(205,201,192,0.5)" }}>Location</span>
                          <span style={{ color: "#fff" }}>{c.location}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                          <span style={{ color: "rgba(205,201,192,0.5)" }}>Duration</span>
                          <span style={{ color: "#fff" }}>{c.durationMinutes > 0 ? `${c.durationMinutes} min` : "N/A"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                          <span style={{ color: "rgba(205,201,192,0.5)" }}>Cancelled</span>
                          <span style={{ color: "#fff" }}>{c.updatedAt ? fmtDateTime(c.updatedAt) : "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    {c.services.length > 0 && (
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "8px" }}>Services</div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {c.services.map((s, i) => (
                            <span key={i} style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "4px", backgroundColor: "rgba(205,201,192,0.06)", color: "rgba(205,201,192,0.6)" }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lost revenue */}
                    <div style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "8px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(205,201,192,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Lost Revenue</span>
                      <span style={{ fontSize: "18px", fontWeight: 800, color: "#F59E0B", fontFamily: "'Fira Code', monospace" }}>{fmtCurrency(c.lostRevenue)}</span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {c.customerId && (
                        <a href={`/appointments`} style={{
                          flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px",
                          color: "#0f1d24", fontWeight: 700, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase",
                          textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>event_repeat</span>
                          Rebook
                        </a>
                      )}
                      {c.customerPhone && (
                        <a href={`sms:${c.customerPhone}`} style={{
                          flex: 1, padding: "10px", backgroundColor: "rgba(205,201,192,0.08)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px",
                          color: "#CDC9C0", textDecoration: "none", textAlign: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                        }}>SMS</a>
                      )}
                      {c.customerEmail && (
                        <a href={`mailto:${c.customerEmail}`} style={{
                          flex: 1, padding: "10px", backgroundColor: "rgba(205,201,192,0.08)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px",
                          color: "#CDC9C0", textDecoration: "none", textAlign: "center", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                        }}>Email</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
