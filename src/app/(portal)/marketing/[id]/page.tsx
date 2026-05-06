"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Clock, Ban, Users } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.5)", label: "Draft" },
  SCHEDULED: { bg: "rgba(59,130,246,0.1)", text: "#1d4ed8", label: "Scheduled" },
  SENDING: { bg: "rgba(234,179,8,0.1)", text: "#a16207", label: "Sending" },
  SENT: { bg: "rgba(34,197,94,0.1)", text: "#15803d", label: "Sent" },
  FAILED: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c", label: "Failed" },
  CANCELLED: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.4)", label: "Cancelled" },
}
const R_STATUS: Record<string, { bg: string; text: string }> = {
  QUEUED: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.5)" },
  SENT: { bg: "rgba(59,130,246,0.1)", text: "#1d4ed8" },
  DELIVERED: { bg: "rgba(34,197,94,0.1)", text: "#15803d" },
  FAILED: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c" },
  OPTED_OUT_PRE_SEND: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.4)" },
}

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n) }

export default function CampaignDetailPage() {
  const { id } = useParams()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [campaign, setCampaign] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [statusCounts, setStatusCounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch(`/api/marketing/campaigns/${id}`).then(r => r.json()).then(d => {
      setCampaign(d.campaign)
      setStatusCounts(d.statusCounts || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  // Auto-poll if sending
  useEffect(() => {
    if (campaign?.status !== "SENDING") return
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [campaign?.status, load])

  if (loading) return <div style={{ padding: "48px 32px", maxWidth: "1700px", margin: "0 auto", color: "rgba(26,19,19,0.3)" }}>Loading...</div>
  if (!campaign) return <div style={{ padding: "48px 32px", maxWidth: "1700px", margin: "0 auto", color: "rgba(26,19,19,0.4)" }}>Campaign not found</div>

  const sc = STATUS_MAP[campaign.status] || STATUS_MAP.DRAFT
  const sentCount = statusCounts.find((s: { status: string }) => s.status === "SENT")?._count || 0
  const deliveredCount = statusCounts.find((s: { status: string }) => s.status === "DELIVERED")?._count || 0
  const failedCount = statusCounts.find((s: { status: string }) => s.status === "FAILED")?._count || 0
  const queuedCount = statusCounts.find((s: { status: string }) => s.status === "QUEUED")?._count || 0

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <Link href="/marketing" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      {/* Header */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 700, backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: "rgba(26,19,19,0.4)" }}>{campaign.channel} &middot; {campaign.category || "—"}</span>
          </div>
          <span style={{ fontSize: 11, color: "rgba(26,19,19,0.4)" }}>{new Date(campaign.createdAt).toLocaleString()}</span>
        </div>
        <p style={{ fontSize: 14, color: "#1A1313", margin: "0 0 12px", lineHeight: 1.5 }}>{campaign.body}</p>
        <div style={{ display: "flex", gap: 24, fontSize: 12, color: "rgba(26,19,19,0.5)" }}>
          <span><Users size={12} style={{ marginRight: 4 }} />{campaign.recipientCount.toLocaleString()} recipients</span>
          <span>Est. cost: {fmt(campaign.estimatedCost)}</span>
          <span>Actual cost: {fmt(campaign.actualCost)}</span>
        </div>
      </div>

      {/* Progress (when sending) */}
      {campaign.status === "SENDING" && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", marginBottom: 8 }}>
            <Send size={14} style={{ marginRight: 6, animation: "spin 2s linear infinite" }} />
            Sending: {(sentCount + deliveredCount).toLocaleString()} / {campaign.recipientCount.toLocaleString()}
          </div>
          <div style={{ height: 6, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(((sentCount + deliveredCount) / Math.max(campaign.recipientCount, 1)) * 100)}%`, backgroundColor: ACC, borderRadius: 3, transition: "width 0.5s" }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "rgba(26,19,19,0.4)" }}>
            {queuedCount} queued &middot; {failedCount} failed
          </div>
        </div>
      )}

      {/* Status summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Queued", count: queuedCount, icon: <Clock size={14} />, color: "rgba(26,19,19,0.4)" },
          { label: "Sent", count: sentCount, icon: <Send size={14} />, color: "#1d4ed8" },
          { label: "Delivered", count: deliveredCount, icon: <CheckCircle2 size={14} />, color: "#15803d" },
          { label: "Failed", count: failedCount, icon: <AlertCircle size={14} />, color: "#dc2626" },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: s.color }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{s.count.toLocaleString()}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recipient table */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: "0 0 12px" }}>Recipients</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.08)" }}>
                {["Client", "Phone", "Status", "Sent", "Delivered", "Cost"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: h === "Cost" ? "right" : "left", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(campaign.recipients || []).map((r: { id: string; client: { firstName: string | null; lastName: string | null }; destination: string; status: string; sentAt: string | null; deliveredAt: string | null; cost: number }) => {
                const rs = R_STATUS[r.status] || R_STATUS.QUEUED
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                    <td style={{ padding: "8px 12px", color: "#1A1313" }}>{r.client.firstName} {r.client.lastName}</td>
                    <td style={{ padding: "8px 12px", color: "rgba(26,19,19,0.5)", fontFamily: "monospace", fontSize: 11 }}>{r.destination.slice(0, 2)}****{r.destination.slice(-4)}</td>
                    <td style={{ padding: "8px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: rs.bg, color: rs.text }}>{r.status}</span></td>
                    <td style={{ padding: "8px 12px", color: "rgba(26,19,19,0.5)", fontSize: 11 }}>{r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : "—"}</td>
                    <td style={{ padding: "8px 12px", color: "rgba(26,19,19,0.5)", fontSize: 11 }}>{r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString() : "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>{fmt(r.cost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {(campaign.recipients || []).length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(26,19,19,0.3)", fontSize: 12 }}>
            {campaign.status === "DRAFT" ? "Recipients will appear after sending." : "No recipients."}
          </div>
        )}
      </div>

      {/* Cancel button for scheduled */}
      {campaign.status === "SCHEDULED" && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={async () => { await fetch(`/api/marketing/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) }); load() }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer" }}>
            <Ban size={14} /> Cancel Campaign
          </button>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
