"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Clock, Ban, Users, Eye, MousePointerClick, Mail, ShieldAlert, UserMinus } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.5)", label: "Draft" },
  scheduled: { bg: "rgba(59,130,246,0.1)", text: "#1d4ed8", label: "Scheduled" },
  sending: { bg: "rgba(234,179,8,0.1)", text: "#a16207", label: "Sending" },
  sent: { bg: "rgba(34,197,94,0.1)", text: "#15803d", label: "Sent" },
  failed: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c", label: "Failed" },
  cancelled: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.4)", label: "Cancelled" },
}
const R_STATUS: Record<string, { bg: string; text: string }> = {
  queued: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.5)" },
  sent: { bg: "rgba(59,130,246,0.1)", text: "#1d4ed8" },
  delivered: { bg: "rgba(34,197,94,0.1)", text: "#15803d" },
  opened: { bg: "rgba(99,102,241,0.1)", text: "#4338ca" },
  clicked: { bg: "rgba(122,143,150,0.1)", text: ACC },
  bounced: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c" },
  complained: { bg: "rgba(239,68,68,0.15)", text: "#991b1b" },
  unsubscribed: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.4)" },
  failed: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c" },
}

function pct(n: number, d: number) {
  if (d === 0) return "—"
  return `${Math.round((n / d) * 100)}%`
}

export default function EmailCampaignDetailPage() {
  const { id } = useParams()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [campaign, setCampaign] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recipients, setRecipients] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/marketing/email/${id}`)
      const d = await r.json()
      setCampaign(d.campaign)
      setRecipients(d.recipients || [])
      setEvents(d.events || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Auto-poll if sending
  useEffect(() => {
    if (campaign?.status !== "sending") return
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [campaign?.status, load])

  if (loading) return <div style={{ padding: "48px 32px", maxWidth: "1700px", margin: "0 auto", color: "rgba(26,19,19,0.3)" }}>Loading...</div>
  if (!campaign) return <div style={{ padding: "48px 32px", maxWidth: "1700px", margin: "0 auto", color: "rgba(26,19,19,0.4)" }}>Campaign not found</div>

  const sc = STATUS_MAP[campaign.status] || STATUS_MAP.draft
  const filteredRecipients = statusFilter === "all" ? recipients : recipients.filter(r => r.status === statusFilter)

  // Click attribution from events
  const clickEvents = events.filter(e => e.type === "clicked" && e.metadata?.link)
  const linkCounts = new Map<string, number>()
  for (const e of clickEvents) {
    const link = e.metadata.link as string
    linkCounts.set(link, (linkCounts.get(link) || 0) + 1)
  }
  const sortedLinks = Array.from(linkCounts.entries()).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <Link href="/marketing/email" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Email Campaigns
      </Link>

      {/* Header */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 700, backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: "rgba(26,19,19,0.4)" }}>{campaign.templateKey} &middot; {campaign.fromEmail}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPreviewOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, border: "1px solid rgba(26,19,19,0.08)", backgroundColor: "transparent", color: "rgba(26,19,19,0.6)", cursor: "pointer" }}><Eye size={12} /> Preview</button>
            <span style={{ fontSize: 11, color: "rgba(26,19,19,0.4)" }}>{new Date(campaign.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1313", margin: "0 0 4px" }}>{campaign.subject}</h2>
        {campaign.preheader && <p style={{ fontSize: 12, color: "rgba(26,19,19,0.5)", margin: "0 0 12px" }}>{campaign.preheader}</p>}
        <div style={{ display: "flex", gap: 24, fontSize: 12, color: "rgba(26,19,19,0.5)" }}>
          <span><Users size={12} style={{ marginRight: 4 }} />{(campaign.recipientCount || 0).toLocaleString()} recipients</span>
          <span>From: {campaign.fromName} &lt;{campaign.fromEmail}&gt;</span>
          {campaign.sentAt && <span>Sent: {new Date(campaign.sentAt).toLocaleString()}</span>}
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Delivered", count: campaign.totalDelivered || 0, rate: pct(campaign.totalDelivered || 0, campaign.totalSent || 0), icon: <CheckCircle2 size={14} />, color: "#15803d" },
          { label: "Opened", count: campaign.totalOpened || 0, rate: pct(campaign.totalOpened || 0, campaign.totalSent || 0), icon: <Eye size={14} />, color: "#4338ca" },
          { label: "Clicked", count: campaign.totalClicked || 0, rate: pct(campaign.totalClicked || 0, campaign.totalSent || 0), icon: <MousePointerClick size={14} />, color: ACC },
          { label: "Bounced", count: campaign.totalBounced || 0, rate: pct(campaign.totalBounced || 0, campaign.totalSent || 0), icon: <AlertCircle size={14} />, color: "#dc2626" },
          { label: "Complained", count: campaign.totalComplained || 0, rate: pct(campaign.totalComplained || 0, campaign.totalSent || 0), icon: <ShieldAlert size={14} />, color: "#991b1b" },
          { label: "Unsubscribed", count: campaign.totalUnsubscribed || 0, rate: pct(campaign.totalUnsubscribed || 0, campaign.totalSent || 0), icon: <UserMinus size={14} />, color: "rgba(26,19,19,0.4)" },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: s.color }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1313" }}>{s.count.toLocaleString()}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label} <span style={{ fontWeight: 400 }}>({s.rate})</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Click attribution */}
      {sortedLinks.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: "0 0 12px" }}>Link Clicks</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedLinks.map(([link, count]) => {
              const maxCount = sortedLinks[0][1]
              return (
                <div key={link} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: ACC }}>{link}</div>
                    <div style={{ height: 4, backgroundColor: "rgba(26,19,19,0.04)", borderRadius: 2, marginTop: 4 }}>
                      <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, backgroundColor: ACC, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, color: "#1A1313", flexShrink: 0 }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recipients table */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: 0 }}>Recipients</h3>
          <div style={{ display: "flex", gap: 2 }}>
            {["all", "sent", "delivered", "opened", "clicked", "bounced", "unsubscribed"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, border: "1px solid", borderColor: statusFilter === s ? ACC : "rgba(26,19,19,0.06)", backgroundColor: statusFilter === s ? `${ACC}11` : "transparent", color: statusFilter === s ? ACC : "rgba(26,19,19,0.4)", cursor: "pointer" }}>{s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.08)" }}>
                {["Email", "Status", "Sent", "Delivered", "Opened", "Clicked"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecipients.map((r: { id: string; email: string; status: string; sentAt: string | null; deliveredAt: string | null; openedAt: string | null; clickedAt: string | null }) => {
                const rs = R_STATUS[r.status] || R_STATUS.queued
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                    <td style={{ padding: "8px 12px", color: "#1A1313", fontSize: 11 }}>{r.email}</td>
                    <td style={{ padding: "8px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: rs.bg, color: rs.text }}>{r.status}</span></td>
                    <td style={{ padding: "8px 12px", color: "rgba(26,19,19,0.5)", fontSize: 11 }}>{r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : "—"}</td>
                    <td style={{ padding: "8px 12px", color: "rgba(26,19,19,0.5)", fontSize: 11 }}>{r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString() : "—"}</td>
                    <td style={{ padding: "8px 12px", color: "rgba(26,19,19,0.5)", fontSize: 11 }}>{r.openedAt ? new Date(r.openedAt).toLocaleTimeString() : "—"}</td>
                    <td style={{ padding: "8px 12px", color: "rgba(26,19,19,0.5)", fontSize: 11 }}>{r.clickedAt ? new Date(r.clickedAt).toLocaleTimeString() : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredRecipients.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(26,19,19,0.3)", fontSize: 12 }}>
            {campaign.status === "draft" ? "Recipients will appear after sending." : "No recipients match this filter."}
          </div>
        )}
      </div>

      {/* Cancel for scheduled */}
      {(campaign.status === "scheduled" || campaign.status === "draft") && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={async () => { await fetch(`/api/marketing/email/${id}/cancel`, { method: "POST" }); load() }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer" }}>
            <Ban size={14} /> Cancel Campaign
          </button>
        </div>
      )}

      {/* HTML Preview modal */}
      {previewOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPreviewOpen(false)}>
          <div style={{ ...cardStyle, maxWidth: 640, width: "90%", maxHeight: "90vh", overflow: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(26,19,19,0.06)" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Email Preview</span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(26,19,19,0.4)", fontSize: 18 }}>x</button>
            </div>
            <iframe src={`/api/marketing/email/${id}/preview`} style={{ width: "100%", height: 600, border: "none" }} title="Email preview" />
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
