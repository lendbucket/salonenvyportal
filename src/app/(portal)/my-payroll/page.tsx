"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Wallet, TrendingUp, Calendar, DollarSign } from "lucide-react"

interface PayrollRecord {
  periodId: string
  periodStart: string
  periodEnd: string
  serviceCount: number
  serviceSubtotal: number
  commission: number
  tips: number
  totalPayout: number
  status: string
  paidAt: string | null
}

interface PayrollData {
  current: PayrollRecord | null
  history: PayrollRecord[]
  ytd: { services: number; subtotal: number; commission: number; tips: number; total: number }
}

function formatPeriodDates(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

function getNextPayDay(periodEnd: string): string {
  const end = new Date(periodEnd)
  const payDate = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000)
  return payDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" })
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#FBFBFB",
  border: "1px solid rgba(26,19,19,0.07)",
  borderRadius: 12,
  padding: "24px",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
}

function StatusBadge({ status }: { status: string }) {
  const isPaid = status === "paid"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      backgroundColor: isPaid ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
      color: isPaid ? "#15803d" : "#a16207",
      border: `1px solid ${isPaid ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
    }}>
      {isPaid ? "Paid" : "Pending"}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div style={{ ...cardStyle, height: 180 }}>
      <div style={{ width: "40%", height: 14, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 6, marginBottom: 16 }} />
      <div style={{ width: "70%", height: 12, backgroundColor: "rgba(26,19,19,0.04)", borderRadius: 6, marginBottom: 12 }} />
      <div style={{ width: "55%", height: 12, backgroundColor: "rgba(26,19,19,0.04)", borderRadius: 6, marginBottom: 12 }} />
      <div style={{ width: "30%", height: 24, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 6 }} />
    </div>
  )
}

export default function MyPayrollPage() {
  const [data, setData] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/my-payroll")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 180, height: 20, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!data || (data.history.length === 0 && !data.current)) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px" }}>My Payroll</h1>
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
          <Wallet size={32} strokeWidth={1.5} color="rgba(26,19,19,0.2)" style={{ margin: "0 auto 16px" }} />
          <p style={{ fontSize: 14, color: "rgba(26,19,19,0.5)", margin: 0 }}>
            No payroll periods yet. Your first period will appear here once payroll is calculated.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px" }}>My Payroll</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Current Period Card */}
        {data.current && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={16} strokeWidth={1.5} color="#7a8f96" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Current Period</span>
              </div>
              <StatusBadge status={data.current.status} />
            </div>
            <p style={{ fontSize: 12, color: "rgba(26,19,19,0.55)", margin: "0 0 16px" }}>
              {formatPeriodDates(data.current.periodStart, data.current.periodEnd)}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Services</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{data.current.serviceCount}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Subtotal</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{formatCurrency(data.current.serviceSubtotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Commission</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#15803d" }}>{formatCurrency(data.current.commission)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Tips</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#a16207" }}>{formatCurrency(data.current.tips)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Payout</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#7a8f96" }}>{formatCurrency(data.current.totalPayout)}</div>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "rgba(26,19,19,0.4)", margin: 0 }}>
              Next payout: {getNextPayDay(data.current.periodEnd)}
            </p>
          </div>
        )}

        {/* YTD Card */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} strokeWidth={1.5} color="#7a8f96" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Year to Date ({new Date().getFullYear()})</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Services</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{data.ytd.services}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Subtotal</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{formatCurrency(data.ytd.subtotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Commission</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#15803d" }}>{formatCurrency(data.ytd.commission)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Tips</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#a16207" }}>{formatCurrency(data.ytd.tips)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Earned</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#7a8f96" }}>{formatCurrency(data.ytd.total)}</div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <DollarSign size={16} strokeWidth={1.5} color="#7a8f96" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Pay History</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.08)" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Period</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Services</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Subtotal</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Commission</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tips</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((row) => (
                  <tr key={row.periodId} style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <Link href={`/my-payroll/${row.periodId}`} style={{ color: "#7a8f96", textDecoration: "none", fontWeight: 500, fontSize: 12 }}>
                        {formatPeriodDates(row.periodStart, row.periodEnd)}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#1A1313" }}>{row.serviceCount}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#1A1313" }}>{formatCurrency(row.serviceSubtotal)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#15803d", fontWeight: 500 }}>{formatCurrency(row.commission)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#a16207", fontWeight: 500 }}>{formatCurrency(row.tips)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#1A1313", fontWeight: 600 }}>{formatCurrency(row.totalPayout)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
