"use client"
import { useEffect, useState } from "react"

const LOCATION_NAMES: Record<string, string> = {
  LTJSA6QR1HGW6: "Corpus Christi",
  LXJYXDXWR0XZF: "San Antonio",
}

interface Overview {
  revenue: { paymentsTotal: number; paymentsNet: number; ordersTotal: number; gap: number; last30d: number; last30dCount: number }
  counts: { payments: number; orders: number; clients: number }
  clientCoverage: { withPayments: number; withAppointments: number; total: number; paymentPct: number; appointmentPct: number }
  sourceBreakdown: { sourceType: string; count: number; amount: number }[]
  locationSplit: { locationId: string; count: number; amount: number }[]
  syncHealth: { clients: string | null; orders: string | null; payments: string | null; appointments: string | null }
}

function fmt(n: number): string { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(iso: string | null): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const card: React.CSSProperties = { background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.08)", borderRadius: 12, padding: 20, boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04)" }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#1A1313", marginBottom: 12 }
const stat: React.CSSProperties = { fontSize: 11, color: "rgba(26,19,19,0.55)", marginBottom: 6 }
const val: React.CSSProperties = { fontWeight: 600, color: "#1A1313" }

export default function DataQualityPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/data-quality/overview")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "rgba(26,19,19,0.4)", fontSize: 13 }}>Loading data quality overview...</div>
  if (!data) return <div style={{ padding: 24, color: "#ef4444", fontSize: 13 }}>Failed to load data quality overview</div>

  return (
    <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.5px", marginBottom: 4 }}>
        Data Quality
      </h1>
      <p style={{ fontSize: 13, color: "rgba(26,19,19,0.5)", marginBottom: 24 }}>
        Payments vs orders revenue comparison, client coverage, and sync health
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {/* Revenue Comparison */}
        <div style={card}>
          <div style={sectionTitle}>Revenue Comparison</div>
          <div style={stat}>Payments total: <span style={val}>{fmt(data.revenue.paymentsTotal)}</span></div>
          <div style={stat}>Payments net (minus refunds): <span style={val}>{fmt(data.revenue.paymentsNet)}</span></div>
          <div style={stat}>Orders total: <span style={val}>{fmt(data.revenue.ordersTotal)}</span></div>
          <div style={{ ...stat, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(26,19,19,0.06)" }}>
            Gap (payments - orders): <span style={{ fontWeight: 600, color: data.revenue.gap > 0 ? "#15803d" : data.revenue.gap < 0 ? "#dc2626" : "#1A1313" }}>
              {data.revenue.gap >= 0 ? "+" : ""}{fmt(data.revenue.gap)}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "rgba(26,19,19,0.35)", marginTop: 4 }}>
            Positive gap indicates cash/external payments not captured as orders
          </div>
        </div>

        {/* Last 30 Days */}
        <div style={card}>
          <div style={sectionTitle}>Last 30 Days</div>
          <div style={stat}>Revenue: <span style={val}>{fmt(data.revenue.last30d)}</span></div>
          <div style={stat}>Transactions: <span style={val}>{data.revenue.last30dCount.toLocaleString()}</span></div>
          <div style={stat}>Avg ticket: <span style={val}>{data.revenue.last30dCount > 0 ? fmt(data.revenue.last30d / data.revenue.last30dCount) : "$0.00"}</span></div>
        </div>

        {/* Client Coverage */}
        <div style={card}>
          <div style={sectionTitle}>Client Coverage</div>
          <div style={stat}>Total clients: <span style={val}>{data.clientCoverage.total.toLocaleString()}</span></div>
          <div style={stat}>With payments: <span style={val}>{data.clientCoverage.withPayments.toLocaleString()} ({data.clientCoverage.paymentPct}%)</span></div>
          <div style={stat}>With appointments: <span style={val}>{data.clientCoverage.withAppointments.toLocaleString()} ({data.clientCoverage.appointmentPct}%)</span></div>
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(26,19,19,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${data.clientCoverage.paymentPct}%`, background: "#7a8f96", borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: "rgba(26,19,19,0.35)", marginTop: 4 }}>Payment coverage</div>
          </div>
        </div>

        {/* Source Type Breakdown */}
        <div style={card}>
          <div style={sectionTitle}>Source Type Breakdown</div>
          {data.sourceBreakdown.length === 0 && <div style={{ fontSize: 12, color: "rgba(26,19,19,0.35)" }}>No payment data yet</div>}
          {data.sourceBreakdown.map(s => (
            <div key={s.sourceType} style={{ ...stat, display: "flex", justifyContent: "space-between" }}>
              <span>{s.sourceType}</span>
              <span><span style={val}>{s.count.toLocaleString()}</span> txns · <span style={val}>{fmt(s.amount)}</span></span>
            </div>
          ))}
        </div>

        {/* Location Split */}
        <div style={card}>
          <div style={sectionTitle}>Location Split</div>
          {data.locationSplit.length === 0 && <div style={{ fontSize: 12, color: "rgba(26,19,19,0.35)" }}>No payment data yet</div>}
          {data.locationSplit.map(l => (
            <div key={l.locationId} style={{ ...stat, display: "flex", justifyContent: "space-between" }}>
              <span>{LOCATION_NAMES[l.locationId] || l.locationId}</span>
              <span><span style={val}>{l.count.toLocaleString()}</span> txns · <span style={val}>{fmt(l.amount)}</span></span>
            </div>
          ))}
        </div>

        {/* Sync Health */}
        <div style={card}>
          <div style={sectionTitle}>Sync Health</div>
          {(["clients", "orders", "payments", "appointments"] as const).map(type => (
            <div key={type} style={{ ...stat, display: "flex", justifyContent: "space-between" }}>
              <span style={{ textTransform: "capitalize" }}>{type}</span>
              <span style={val}>{fmtDate(data.syncHealth[type])}</span>
            </div>
          ))}
        </div>

        {/* Record Counts */}
        <div style={card}>
          <div style={sectionTitle}>Record Counts</div>
          <div style={stat}>Payments: <span style={val}>{data.counts.payments.toLocaleString()}</span></div>
          <div style={stat}>Orders: <span style={val}>{data.counts.orders.toLocaleString()}</span></div>
          <div style={stat}>Clients: <span style={val}>{data.counts.clients.toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  )
}
