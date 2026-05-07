"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Bot, Play, Pause, Send, CheckCircle2, XCircle, Edit3, Loader2, AlertTriangle, Users, Eye, DollarSign, Settings, Inbox, FileText, Clock } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

const TIER_LABELS: Record<string, string> = {
  VIP: "VIP", ACTIVE: "Active", AT_RISK: "At Risk", LAPSED: "Lapsed", DEAD: "Dead", NEVER: "Never",
  BIG_SPENDER: "Big Spender", VALUABLE: "Valuable", AVERAGE: "Average", LOW_VALUE: "Low Value", NONE: "None",
}
const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  VIP: { bg: "#d1f5f0", text: "#134e4a" }, ACTIVE: { bg: "#dcfce7", text: "#166534" },
  AT_RISK: { bg: "#fef3c7", text: "#92400e" }, LAPSED: { bg: "#fee2e2", text: "#991b1b" },
  DEAD: { bg: "#f3f4f6", text: "#6b7280" }, NEVER: { bg: "#f3f4f6", text: "#9ca3af" },
  BIG_SPENDER: { bg: "#d1f5f0", text: "#134e4a" }, VALUABLE: { bg: "#dcfce7", text: "#166534" },
  AVERAGE: { bg: "#fef3c7", text: "#92400e" }, LOW_VALUE: { bg: "#f3f4f6", text: "#6b7280" }, NONE: { bg: "#f3f4f6", text: "#9ca3af" },
}
const PRIORITY_COLORS = ["", "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#059669", "#0891b2", ACC, "#6b7280"]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Agent = Record<string, any>

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) }
function daysSince(d: string | null) {
  if (!d) return "Never"
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) }

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  approved: { bg: "#dbeafe", text: "#1d4ed8" },
  sent: { bg: "#dcfce7", text: "#059669" },
  rejected: { bg: "#fee2e2", text: "#dc2626" },
  converted: { bg: "#d1f5f0", text: "#134e4a" },
  bounced: { bg: "#f3f4f6", text: "#6b7280" },
}

const FILTER_TABS = [
  { key: "pending", label: "Pending", icon: <Clock size={13} /> },
  { key: "approved", label: "Approved", icon: <CheckCircle2 size={13} /> },
  { key: "sent", label: "Sent", icon: <Send size={13} /> },
  { key: "rejected", label: "Rejected", icon: <XCircle size={13} /> },
  { key: "converted", label: "Converted", icon: <DollarSign size={13} /> },
  { key: "all", label: "All", icon: <FileText size={13} /> },
]

export default function ReynaRecoveryDashboard() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [editDraft, setEditDraft] = useState<Draft | null>(null)
  const [editBody, setEditBody] = useState("")
  const [editOffer, setEditOffer] = useState("")
  const [bulkConfirm, setBulkConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/agents/reyna-recovery")
      const d = await r.json()
      setAgent(d.agent)
      setDrafts(d.drafts || [])
      setStats(d.stats || {})
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = drafts.filter(d => statusFilter === "all" ? true : d.status === statusFilter)
  const statusCounts: Record<string, number> = {}
  for (const d of drafts) statusCounts[d.status] = (statusCounts[d.status] || 0) + 1

  async function toggleStatus() {
    if (!agent) return
    const newStatus = agent.status === "active" ? "paused" : "active"
    await fetch("/api/agents/reyna-recovery/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) })
    load()
  }

  async function runNow() {
    setRunning(true)
    await fetch("/api/agents/reyna-recovery/run", { method: "POST" })
    await load()
    setRunning(false)
  }

  async function approveDraft(id: string) {
    await fetch(`/api/agents/reyna-recovery/drafts/${id}/approve`, { method: "POST" })
    load()
  }

  async function rejectDraft(id: string) {
    await fetch(`/api/agents/reyna-recovery/drafts/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Owner rejected" }) })
    load()
  }

  async function bulkApprove(type: string) {
    const body = type === "all" ? { all: true } : { maxPriority: 3 }
    await fetch("/api/agents/reyna-recovery/drafts/bulk-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setBulkConfirm(null)
    load()
  }

  async function saveEdit() {
    if (!editDraft) return
    await fetch(`/api/agents/reyna-recovery/drafts/${editDraft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageBody: editBody, proposedOffer: editOffer }) })
    setEditDraft(null)
    load()
  }

  if (loading) return <div style={{ padding: "48px 32px", color: "#9ca3af" }}>Loading...</div>

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <Link href="/agents" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Agents
      </Link>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${ACC}15`, color: ACC, display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={22} strokeWidth={1.5} /></div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: 0, letterSpacing: "-0.31px" }}>Reyna Recovery</h1>
            <p style={{ fontSize: 14, color: "#525866", margin: "2px 0 0" }}>Recovers lapsed clients with personalized SMS</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={toggleStatus} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, ...(agent?.status === "active" ? { backgroundColor: "#fee2e2", color: "#dc2626" } : { backgroundColor: ACC, color: "#fff" }) }}>
            {agent?.status === "active" ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Activate</>}
          </button>
          <button onClick={runNow} disabled={running} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "transparent", border: `1px solid ${ACC}`, color: ACC, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: running ? 0.5 : 1 }}>
            {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={16} />} Run Now
          </button>
          <Link href="/agents/reyna-recovery/config" style={{ padding: "10px", borderRadius: 8, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#525866", display: "flex", alignItems: "center", textDecoration: "none" }}>
            <Settings size={16} />
          </Link>
        </div>
      </div>
      <div style={{ marginBottom: 24, marginLeft: 58 }}>
        <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, ...(agent?.status === "active" ? { backgroundColor: "#dcfce7", color: "#059669" } : { backgroundColor: "#fef3c7", color: "#92400e" }) }}>
          {agent?.status === "active" ? "Active" : agent?.status === "suspended" ? "Suspended" : "Paused"}
        </span>
        {agent?.lastRunAt && <span style={{ fontSize: 13, color: "#9ca3af", marginLeft: 12 }}>Last run {fmtDate(agent.lastRunAt)}</span>}
      </div>

      {/* Stats — 4 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Awaiting your review", value: stats.pendingCount || 0, color: "#d97706" },
          { label: "Sent this week", value: stats.weeklySent || 0, color: "#059669" },
          { label: "Bookings recovered", value: stats.weeklyConverted || 0, color: ACC },
          { label: "Revenue attributed", value: fmt(agent?.revenueAttributed || 0), color: "#059669" },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#525866", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#1A1313" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending review CTA */}
      {(stats.pendingCount || 0) > 0 && statusFilter !== "pending" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, borderLeft: `3px solid ${ACC}`, backgroundColor: "#f0f5f5", marginBottom: 16 }}>
          <Eye size={16} color={ACC} />
          <span style={{ fontSize: 14, color: "#1A1313" }}>You have <strong>{stats.pendingCount}</strong> drafts ready to review.</span>
          <button onClick={() => setStatusFilter("pending")} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer" }}>Review now</button>
        </div>
      )}

      {/* Filter tabs — pill style */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {FILTER_TABS.map(t => {
            const count = t.key === "all" ? drafts.length : (statusCounts[t.key] || 0)
            const isActive = statusFilter === t.key
            return (
              <button key={t.key} onClick={() => setStatusFilter(t.key)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: isActive ? 500 : 400, backgroundColor: isActive ? "#f4f5f7" : "transparent", color: isActive ? "#1e2a30" : "#525866", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {t.icon} {t.label}
                {count > 0 && <span style={{ padding: "0 6px", borderRadius: 8, fontSize: 11, fontWeight: 600, backgroundColor: isActive ? ACC : "#e5e7eb", color: isActive ? "#fff" : "#6b7280", minWidth: 18, textAlign: "center" }}>{count}</span>}
              </button>
            )
          })}
        </div>
        {statusFilter === "pending" && filtered.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setBulkConfirm("priority")} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: "transparent", border: `1px solid ${ACC}`, color: ACC, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={14} /> Approve P1-3</button>
            <button onClick={() => setBulkConfirm("all")} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={14} /> Approve All ({filtered.length})</button>
          </div>
        )}
      </div>

      {/* Drafts table */}
      <div style={{ ...cardStyle, padding: 0 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", maxHeight: 320 }}>
            <Inbox size={56} strokeWidth={1.5} color={`${ACC}40`} style={{ margin: "0 auto 16px" }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 4px" }}>
              {statusFilter === "pending" ? "You're all caught up" : `No ${statusFilter} drafts`}
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>
              {statusFilter === "pending" ? "Reyna Recovery hasn't generated drafts since last run" : "Drafts will appear here as they change status"}
            </p>
            {statusFilter === "pending" && (
              <button onClick={runNow} disabled={running} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={16} />} Run Now
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Priority", "Client", "Tier", "Last Visit", "Spend", "Message", "Offer", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 12px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#9ca3af" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const tc1 = TIER_COLORS[d.client?.vipTier] || TIER_COLORS.NEVER
                  const tc2 = TIER_COLORS[d.client?.valueTier] || TIER_COLORS.NONE
                  const ss = STATUS_STYLES[d.status] || STATUS_STYLES.pending
                  return (
                    <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px", fontWeight: 700, color: PRIORITY_COLORS[d.priority] || "#1A1313", fontSize: 15 }}>{d.priority}</td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: 500, color: "#1A1313" }}>{d.client?.firstName} {d.client?.lastName}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{d.client?.phone?.slice(0, 2)}****{d.client?.phone?.slice(-4)}</div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: tc1.bg, color: tc1.text, marginRight: 4 }}>{TIER_LABELS[d.client?.vipTier] || d.client?.vipTier}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: tc2.bg, color: tc2.text }}>{TIER_LABELS[d.client?.valueTier] || d.client?.valueTier}</span>
                      </td>
                      <td style={{ padding: "12px", color: "#525866", fontSize: 13 }}>{daysSince(d.client?.lastVisitAt)}</td>
                      <td style={{ padding: "12px", fontWeight: 500, color: "#1A1313", fontFamily: "monospace", fontSize: 13 }}>{fmt(d.client?.lifetimeSpend || 0)}</td>
                      <td style={{ padding: "12px", maxWidth: 300, color: "#1A1313", fontSize: 13, lineHeight: 1.5 }}>
                        <div title={d.messageBody} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{d.messageBody}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }} title={d.reasoning}>{d.reasoning?.slice(0, 70)}</div>
                      </td>
                      <td style={{ padding: "12px", fontSize: 13, color: ACC, fontWeight: 500 }}>{d.proposedOffer}</td>
                      <td style={{ padding: "12px" }}>
                        {d.status === "pending" ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => approveDraft(d.id)} title="Approve" style={{ padding: "5px 8px", borderRadius: 6, backgroundColor: "#dcfce7", color: "#059669", border: "none", cursor: "pointer" }}><CheckCircle2 size={14} /></button>
                            <button onClick={() => rejectDraft(d.id)} title="Reject" style={{ padding: "5px 8px", borderRadius: 6, backgroundColor: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer" }}><XCircle size={14} /></button>
                            <button onClick={() => { setEditDraft(d); setEditBody(d.messageBody); setEditOffer(d.proposedOffer || "") }} title="Edit" style={{ padding: "5px 8px", borderRadius: 6, backgroundColor: `${ACC}12`, color: ACC, border: "none", cursor: "pointer" }}><Edit3 size={14} /></button>
                          </div>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: ss.bg, color: ss.text }}>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editDraft && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setEditDraft(null)}>
          <div style={{ ...cardStyle, maxWidth: 520, width: "90%", padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Edit Draft</h2>
            <p style={{ fontSize: 14, color: "#525866", margin: "0 0 20px" }}>For {editDraft.client?.firstName} {editDraft.client?.lastName}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>Message <span style={{ fontWeight: 400, color: "#9ca3af" }}>({editBody.length} chars)</span></label>
              <textarea value={editBody} onChange={e => setEditBody(e.target.value)} style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313", backgroundColor: "#fff", minHeight: 80, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#525866", display: "block", marginBottom: 6 }}>Offer</label>
              <input value={editOffer} onChange={e => setEditOffer(e.target.value)} style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313", backgroundColor: "#fff", boxSizing: "border-box", outline: "none" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setEditDraft(null)} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#525866", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEdit} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk confirm modal */}
      {bulkConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setBulkConfirm(null)}>
          <div style={{ ...cardStyle, maxWidth: 420, width: "90%", padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: "0 0 8px" }}>Confirm Bulk Approve</h2>
            <p style={{ fontSize: 14, color: "#525866", margin: "0 0 20px" }}>
              {bulkConfirm === "all" ? `Approve all ${filtered.length} pending drafts?` : "Approve all Priority 1-3 drafts (highest value)?"}
            </p>
            <div style={{ padding: "10px 12px", backgroundColor: "#fef3c7", borderRadius: 8, marginBottom: 20, fontSize: 13, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} /> Approved drafts will be sent at their scheduled time.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setBulkConfirm(null)} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#525866", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => bulkApprove(bulkConfirm)} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} /> Confirm</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
