"use client"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download, FileText } from "lucide-react"

interface PayStubData {
  periodId: string
  periodStart: string
  periodEnd: string
  status: string
  paidAt: string | null
  teamMemberName: string
  locationId: string
  serviceCount: number
  serviceSubtotal: number
  commission: number
  tips: number
  totalPayout: number
  stylistName: string
  stylistEmail: string | null
}

function formatPeriodDates(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

function getLocationName(locId: string): string {
  if (locId === "CC" || locId === "LTJSA6QR1HGW6") return "Corpus Christi"
  if (locId === "SA" || locId === "LXJYXDXWR0XZF") return "San Antonio"
  return locId
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#FBFBFB",
  border: "1px solid rgba(26,19,19,0.07)",
  borderRadius: 12,
  padding: "24px",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
}

export default function PayStubPage() {
  const params = useParams()
  const periodId = params.periodId as string
  const [data, setData] = useState<PayStubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/my-payroll/${periodId}`)
      .then(r => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then(d => setData(d))
      .catch(() => setError("Pay stub not found."))
      .finally(() => setLoading(false))
  }, [periodId])

  if (loading) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ width: 140, height: 14, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 6, marginBottom: 24 }} />
        <div style={{ ...cardStyle, height: 300 }}>
          <div style={{ width: "50%", height: 16, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 6, marginBottom: 20 }} />
          <div style={{ width: "80%", height: 12, backgroundColor: "rgba(26,19,19,0.04)", borderRadius: 6, marginBottom: 12 }} />
          <div style={{ width: "60%", height: 12, backgroundColor: "rgba(26,19,19,0.04)", borderRadius: 6 }} />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
        <Link href="/my-payroll" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#7a8f96", textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 24 }}>
          <ArrowLeft size={14} strokeWidth={1.5} /> Back to My Payroll
        </Link>
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
          <FileText size={32} strokeWidth={1.5} color="rgba(26,19,19,0.2)" style={{ margin: "0 auto 16px" }} />
          <p style={{ fontSize: 14, color: "rgba(26,19,19,0.5)", margin: 0 }}>{error || "Pay stub not found."}</p>
        </div>
      </div>
    )
  }

  const isPaid = data.status === "paid"
  const grossPay = data.commission + data.tips

  return (
    <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href="/my-payroll" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#7a8f96", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft size={14} strokeWidth={1.5} /> Back to My Payroll
        </Link>
        <a
          href={`/api/my-payroll/${periodId}/pdf`}
          download
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
            backgroundColor: "rgba(122,143,150,0.08)", border: "1px solid rgba(122,143,150,0.2)",
            borderRadius: 8, color: "#7a8f96", fontSize: 12, fontWeight: 600,
            textDecoration: "none", cursor: "pointer",
          }}
        >
          <Download size={14} strokeWidth={1.5} /> Download PDF
        </a>
      </div>

      {/* Pay Stub Card */}
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(26,19,19,0.06)" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 4px" }}>Pay Stub</h1>
            <p style={{ fontSize: 12, color: "rgba(26,19,19,0.55)", margin: 0 }}>
              {formatPeriodDates(data.periodStart, data.periodEnd)}
            </p>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 20,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            backgroundColor: isPaid ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
            color: isPaid ? "#15803d" : "#a16207",
            border: `1px solid ${isPaid ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
          }}>
            {isPaid ? "Paid" : "Pending"}
          </span>
        </div>

        {/* Stylist Info */}
        <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(26,19,19,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Name</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{data.stylistName}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Location</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{getLocationName(data.locationId)}</div>
            </div>
            {data.stylistEmail && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Email</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{data.stylistEmail}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Period ID</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(26,19,19,0.4)", fontFamily: "monospace" }}>{data.periodId.slice(0, 12)}...</div>
            </div>
          </div>
        </div>

        {/* Earnings Table */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Earnings</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#1A1313" }}>Service Revenue ({data.serviceCount} services)</td>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#1A1313", textAlign: "right" }}>{formatCurrency(data.serviceSubtotal)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#1A1313" }}>Commission Rate</td>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#1A1313", textAlign: "right" }}>40%</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#15803d", fontWeight: 500 }}>Gross Commission</td>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#15803d", textAlign: "right", fontWeight: 600 }}>{formatCurrency(data.commission)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.06)" }}>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#a16207", fontWeight: 500 }}>Tips Passthrough</td>
                <td style={{ padding: "10px 0", fontSize: 13, color: "#a16207", textAlign: "right", fontWeight: 600 }}>{formatCurrency(data.tips)}</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 0", fontSize: 14, color: "#7a8f96", fontWeight: 700 }}>Gross Pay</td>
                <td style={{ padding: "12px 0", fontSize: 14, color: "#7a8f96", textAlign: "right", fontWeight: 700 }}>{formatCurrency(grossPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Deductions */}
        <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(26,19,19,0.06)" }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Deductions</h2>
          <p style={{ fontSize: 12, color: "rgba(26,19,19,0.35)", margin: 0 }}>No deductions</p>
        </div>

        {/* Net Pay */}
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Net Pay</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#7a8f96" }}>{formatCurrency(grossPay)}</div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(26,19,19,0.06)", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "rgba(26,19,19,0.3)", margin: 0 }}>
            Salon Envy USA LLC &bull; Period {data.periodId.slice(0, 8)} &bull; Generated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}
          </p>
        </div>
      </div>
    </div>
  )
}
