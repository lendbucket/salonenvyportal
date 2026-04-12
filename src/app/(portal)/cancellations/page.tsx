// restored
"use client"

import { useState, useMemo } from "react"

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
  visitCount?: number
  cancelledBy?: string
  lostRevenue?: number
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
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "7 Days" },
  { value: "30days", label: "30 Days" },
  { value: "90days", label: "90 Days" },
]

const LOCATIONS = [
  { value: "Both", label: "Both" },
  { value: "CC", label: "CC" },
  { value: "SA", label: "SA" },
]

const STATUS_FILTERS = [
  { value: "All", label: "All" },
  { value: "CANCELLED_BY_CUSTOMER", label: "Client" },
  { value: "NO_SHOW", label: "No Show" },
  { value: "CANCELLED_BY_SELLER", label: "Salon" },
]

const STATUS_COLORS: Record<string, string> = {
  CANCELLED_BY_CUSTOMER: "#F59E0B",
  CANCELLED_BY_SELLER: "#94A3B8",
  NO_SHOW: "#EF4444",
}

const STATUS_LABELS: Record<string, string> = {
  CANCELLED_BY_CUSTOMER: "Client Cancelled",
  CANCELLED_BY_SELLER: "Salon Cancelled",
  NO_SHOW: "No Show",
}

function formatDate(iso: string) {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(iso: string) {
  if (!iso) return "N/A"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function BarChart({ data, color }: { data: Record<string, number>; color: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, v]) => v), 1)
  if (entries.length === 0)
    return (
      <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "12px", padding: "20px 0" }}>
        No data
      </div>
    )
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {entries.map(([label, count]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "90px",
              fontSize: "11px",
              color: "rgba(205,201,192,0.7)",
              textAlign: "right",
              flexShrink: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={label}
          >
            {label}
          </div>
          <div style={{ flex: 1, height: "18px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(count / max) * 100}%`,
                backgroundColor: color,
                borderRadius: "4px",
                minWidth: "2px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ width: "28px", fontSize: "11px", fontWeight: 700, color: "rgba(205,201,192,0.8)", textAlign: "right" }}>
            {count}
          </div>
        </div>
      ))}
    </div>
  )
}

function CustomerModal({
  entry,
  onClose,
  avgTicket,
}: {
  entry: CancellationEntry
  onClose: () => void
  avgTicket: number
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#0d1117",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.06)",
          maxWidth: "480px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: 700 }}>
            Customer Profile
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(205,201,192,0.5)",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Contact info */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(205,201,192,0.4)", marginBottom: "8px", textTransform: "uppercase" }}>
              Contact Info
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Name</span>
                <span style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}>{entry.customerName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Phone</span>
                <span style={{ color: "#fff", fontSize: "12px" }}>{entry.customerPhone || "N/A"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Email</span>
                <span style={{ color: "#fff", fontSize: "12px" }}>{entry.customerEmail || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Appointment details */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(205,201,192,0.4)", marginBottom: "8px", textTransform: "uppercase" }}>
              Appointment Details
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Status</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: STATUS_COLORS[entry.status],
                  }}
                >
                  {STATUS_LABELS[entry.status]}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Scheduled</span>
                <span style={{ color: "#fff", fontSize: "12px" }}>{formatDateTime(entry.scheduledAt)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Stylist</span>
                <span style={{ color: "#fff", fontSize: "12px" }}>{entry.stylistName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Location</span>
                <span style={{ color: "#fff", fontSize: "12px" }}>{entry.location}</span>
              </div>
            </div>
          </div>

          {/* Client history */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(205,201,192,0.4)", marginBottom: "8px", textTransform: "uppercase" }}>
              Client History
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Total Visits</span>
                <span style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}>{entry.visitCount ?? entry.totalPastVisits}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Repeat Client</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: (entry.visitCount ?? entry.totalPastVisits) > 1 ? "#10B981" : "#F59E0B",
                  }}
                >
                  {(entry.visitCount ?? entry.totalPastVisits) > 1 ? "Yes" : "First visit"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Lost Revenue</span>
                <span style={{ color: "#fff", fontSize: "12px" }}>${(entry.lostRevenue ?? (entry.totalPastVisits * avgTicket)).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>Last Visit</span>
                <span style={{ color: "#fff", fontSize: "12px" }}>{entry.lastVisitDate ? formatDate(entry.lastVisitDate) : "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            {entry.customerPhone && (
              <a
                href={`sms:${entry.customerPhone}`}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(205,201,192,0.15)",
                  borderRadius: "8px",
                  color: "#CDC9C0",
                  textDecoration: "none",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Send SMS
              </a>
            )}
            {entry.customerEmail && (
              <a
                href={`mailto:${entry.customerEmail}`}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(205,201,192,0.15)",
                  borderRadius: "8px",
                  color: "#CDC9C0",
                  textDecoration: "none",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Send Email
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CancellationsPage() {
  const [period, setPeriod] = useState("30days")
  const [location, setLocation] = useState("Both")
  const [statusFilter, setStatusFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [data, setData] = useState<CancellationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<CancellationEntry | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cancellations?period=${period}&location=${location}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const filteredCancellations = useMemo(() => {
    if (!data) return []
    let list = data.cancellations
    if (statusFilter !== "All") {
      list = list.filter((c) => c.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          c.customerEmail.toLowerCase().includes(q) ||
          c.customerPhone.includes(q) ||
          c.stylistName.toLowerCase().includes(q)
      )
    }
    return list
  }, [data, statusFilter, search])

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#0d1117",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "16px",
  }

  const pillBase: React.CSSProperties = {
    padding: "6px 14px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.06)",
    transition: "all 0.15s ease",
    textTransform: "uppercase",
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 800,
            letterSpacing: "0.02em",
            color: "#FFFFFF",
          }}
        >
          Cancellations
        </h1>
        <p style={{ margin: "4px 0 0", color: "rgba(205,201,192,0.5)", fontSize: "13px" }}>
          Track cancellations, no-shows, and client recovery opportunities
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          ...cardStyle,
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                ...pillBase,
                backgroundColor: period === p.value ? "#CDC9C0" : "rgba(255,255,255,0.04)",
                color: period === p.value ? "#0f1d24" : "rgba(205,201,192,0.6)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ width: "1px", height: "24px", backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", gap: "4px" }}>
          {LOCATIONS.map((l) => (
            <button
              key={l.value}
              onClick={() => setLocation(l.value)}
              style={{
                ...pillBase,
                backgroundColor: location === l.value ? "#CDC9C0" : "rgba(255,255,255,0.04)",
                color: location === l.value ? "#0f1d24" : "rgba(205,201,192,0.6)",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            ...pillBase,
            marginLeft: "auto",
            backgroundColor: loading ? "rgba(205,201,192,0.1)" : "#CDC9C0",
            color: loading ? "rgba(205,201,192,0.4)" : "#0f1d24",
            padding: "8px 24px",
            fontSize: "12px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Load Data"}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            ...cardStyle,
            marginBottom: "20px",
            borderColor: "rgba(239,68,68,0.3)",
            color: "#EF4444",
            fontSize: "13px",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(205,201,192,0.4)", fontSize: "14px" }}>
          Analyzing cancellations... This may take up to 60 seconds.
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !data && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(205,201,192,0.3)", fontSize: "14px" }}>
          Select a period and click <strong>Load Data</strong> to view cancellation analytics.
        </div>
      )}

      {/* Dashboard */}
      {data && !loading && (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            {[
              { label: "Total Cancellations", value: data.stats.totalCancellations, color: "#FFFFFF" },
              { label: "Client Cancelled", value: data.stats.cancelledByCustomer, color: "#F59E0B" },
              { label: "No Shows", value: data.stats.noShows, color: "#EF4444" },
              { label: "Salon Cancelled", value: data.stats.cancelledBySeller, color: "#94A3B8" },
              { label: "Repeat Clients", value: data.stats.repeatClientCancellations, color: "#10B981" },
              {
                label: "Est. Revenue Lost",
                value: `$${data.stats.estimatedRevenueLost.toLocaleString()}`,
                color: "#F59E0B",
                sub: `Est. avg ticket: $${data.stats.avgTicket || 0}`,
              },
            ].map((kpi) => (
              <div key={kpi.label} style={cardStyle}>
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    color: "rgba(205,201,192,0.4)",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  {kpi.label}
                </div>
                <div style={{ fontSize: "26px", fontWeight: 800, color: kpi.color }}>
                  {kpi.value}
                </div>
                {"sub" in kpi && kpi.sub && (
                  <div style={{ fontFamily: "'Fira Code', monospace", fontSize: "10px", color: "#606E74", marginTop: "4px" }}>{kpi.sub}</div>
                )}
              </div>
            ))}
          </div>

          {/* Pattern Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <div style={cardStyle}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "rgba(205,201,192,0.4)",
                  textTransform: "uppercase",
                  marginBottom: "14px",
                }}
              >
                By Stylist
              </div>
              <BarChart data={data.stats.byStylist} color="#CDC9C0" />
            </div>
            <div style={cardStyle}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "rgba(205,201,192,0.4)",
                  textTransform: "uppercase",
                  marginBottom: "14px",
                }}
              >
                By Day of Week
              </div>
              <BarChart data={data.stats.byDay} color="#F59E0B" />
            </div>
          </div>

          {/* Table Controls */}
          <div style={{ ...cardStyle, marginBottom: "0", borderRadius: "10px 10px 0 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", borderBottom: "none" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {STATUS_FILTERS.map((sf) => {
                const count = sf.value === "All"
                  ? data?.cancellations.length || 0
                  : data?.cancellations.filter((c) => c.status === sf.value).length || 0
                return (
                  <button
                    key={sf.value}
                    onClick={() => setStatusFilter(sf.value)}
                    style={{
                      ...pillBase,
                      padding: "5px 12px",
                      fontSize: "10px",
                      backgroundColor: statusFilter === sf.value ? "rgba(205,201,192,0.15)" : "transparent",
                      color: statusFilter === sf.value ? "#FFFFFF" : "rgba(205,201,192,0.5)",
                      border: statusFilter === sf.value ? "1px solid rgba(205,201,192,0.2)" : "1px solid transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {sf.label}
                    <span style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "8px",
                      backgroundColor: statusFilter === sf.value ? "rgba(205,201,192,0.2)" : "rgba(255,255,255,0.06)",
                      color: statusFilter === sf.value ? "#fff" : "rgba(205,201,192,0.4)",
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              placeholder="Search clients, stylists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                marginLeft: "auto",
                padding: "7px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.06)",
                backgroundColor: "rgba(205,201,192,0.04)",
                color: "#fff",
                fontSize: "12px",
                outline: "none",
                width: "220px",
              }}
            />
          </div>

          {/* Mobile Cancellation Cards */}
          <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
            {filteredCancellations.length === 0 && (
              <div style={{ ...cardStyle, textAlign: "center", color: "rgba(205,201,192,0.3)", padding: "40px" }}>No cancellations found.</div>
            )}
            {filteredCancellations.map((c) => (
              <div key={c.bookingId} onClick={() => setSelectedEntry(c)} style={{ ...cardStyle, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <span style={{
                    display: "inline-block", padding: "3px 8px", borderRadius: "4px", fontSize: "9px", fontWeight: 700,
                    letterSpacing: "0.06em", backgroundColor: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status],
                  }}>{STATUS_LABELS[c.status]}</span>
                  {c.isRepeatClient && (
                    <span style={{ padding: "2px 6px", borderRadius: "3px", fontSize: "8px", fontWeight: 700, backgroundColor: "rgba(16,185,129,0.15)", color: "#10B981" }}>REPEAT</span>
                  )}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginBottom: "6px" }}>
                  {c.customerName}
                  {(c.visitCount ?? c.totalPastVisits) > 1 && (
                    <span style={{ marginLeft: "6px", padding: "2px 6px", borderRadius: "3px", fontSize: "8px", fontWeight: 700, backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(205,201,192,0.5)" }}>
                      {c.visitCount ?? c.totalPastVisits} visits
                    </span>
                  )}
                  {(c.visitCount ?? c.totalPastVisits) === 1 && (
                    <span style={{ marginLeft: "6px", padding: "2px 6px", borderRadius: "3px", fontSize: "8px", fontWeight: 700, backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                      1st visit
                    </span>
                  )}
                </div>
                {c.customerPhone && (
                  <a href={`tel:${c.customerPhone}`} onClick={e => e.stopPropagation()} style={{ fontSize: "12px", color: "#CDC9C0", textDecoration: "none", display: "block", marginBottom: "4px" }}>{c.customerPhone}</a>
                )}
                <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.6)", marginBottom: "4px" }}>{formatDateTime(c.scheduledAt)}</div>
                <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginBottom: "10px" }}>Stylist: {c.stylistName}</div>
                <div style={{ display: "flex", gap: "6px" }} onClick={e => e.stopPropagation()}>
                  {c.customerPhone && (
                    <a href={`sms:${c.customerPhone}`} style={{
                      flex: 1, padding: "8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)",
                      color: "#CDC9C0", textDecoration: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>SMS</a>
                  )}
                  {c.customerEmail && (
                    <a href={`mailto:${c.customerEmail}`} style={{
                      flex: 1, padding: "8px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)",
                      color: "#CDC9C0", textDecoration: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>Email</a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Cancellation Table (Desktop) */}
          <div
            className="desktop-only"
            style={{
              ...cardStyle,
              borderRadius: "0 0 10px 10px",
              padding: 0,
              overflow: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {["Status", "Client", "Phone", "Email", "Scheduled", "Stylist", "Location", "Visits", "Lost $", "Last Visit", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 12px",
                          textAlign: "left",
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "0.15em",
                          color: "rgba(205,201,192,0.35)",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCancellations.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "rgba(205,201,192,0.3)",
                      }}
                    >
                      No cancellations found.
                    </td>
                  </tr>
                )}
                {filteredCancellations.map((c) => (
                  <tr
                    key={c.bookingId}
                    onClick={() => setSelectedEntry(c)}
                    style={{
                      borderBottom: "1px solid rgba(205,201,192,0.05)",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(205,201,192,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          backgroundColor: `${STATUS_COLORS[c.status]}20`,
                          color: STATUS_COLORS[c.status],
                          whiteSpace: "nowrap",
                        }}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {c.customerName}
                      {(c.visitCount ?? c.totalPastVisits) > 1 && (
                        <span
                          style={{
                            marginLeft: "6px",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            fontSize: "8px",
                            fontWeight: 700,
                            backgroundColor: "rgba(255,255,255,0.06)",
                            color: "rgba(205,201,192,0.5)",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {c.visitCount ?? c.totalPastVisits} visits
                        </span>
                      )}
                      {(c.visitCount ?? c.totalPastVisits) === 1 && (
                        <span
                          style={{
                            marginLeft: "6px",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            fontSize: "8px",
                            fontWeight: 700,
                            backgroundColor: "rgba(245,158,11,0.12)",
                            color: "#F59E0B",
                            letterSpacing: "0.06em",
                          }}
                        >
                          1st visit
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(205,201,192,0.6)", whiteSpace: "nowrap" }}>
                      {c.customerPhone || "---"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "rgba(205,201,192,0.6)",
                        maxWidth: "160px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.customerEmail || "---"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(205,201,192,0.7)", whiteSpace: "nowrap" }}>
                      {formatDateTime(c.scheduledAt)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(205,201,192,0.7)", whiteSpace: "nowrap" }}>
                      {c.stylistName}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(205,201,192,0.5)", whiteSpace: "nowrap" }}>
                      {c.location === "Corpus Christi" ? "CC" : c.location === "San Antonio" ? "SA" : c.location}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(205,201,192,0.6)", textAlign: "center" }}>
                      {c.totalPastVisits}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(205,201,192,0.6)", whiteSpace: "nowrap" }}>
                      ${(c.lostRevenue ?? (c.totalPastVisits * (data?.stats.avgTicket || 75))).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(205,201,192,0.5)", whiteSpace: "nowrap" }}>
                      {c.lastVisitDate ? formatDate(c.lastVisitDate) : "---"}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {c.customerPhone && (
                          <a
                            href={`sms:${c.customerPhone}`}
                            title="Send SMS"
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "5px",
                              backgroundColor: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "rgba(205,201,192,0.5)",
                              textDecoration: "none",
                              fontSize: "13px",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                              sms
                            </span>
                          </a>
                        )}
                        {c.customerEmail && (
                          <a
                            href={`mailto:${c.customerEmail}`}
                            title="Send Email"
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "5px",
                              backgroundColor: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "rgba(205,201,192,0.5)",
                              textDecoration: "none",
                              fontSize: "13px",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                              mail
                            </span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Customer Modal */}
      {selectedEntry && <CustomerModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} avgTicket={data?.stats.avgTicket || 75} />}
    </div>
  )
}
