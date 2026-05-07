"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Bot, Play, Pause, Send, CheckCircle2, XCircle, Edit3, Loader2, AlertTriangle, Users, Eye, DollarSign, Settings } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", backgroundColor: "#1A1313", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", backgroundColor: "transparent", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "rgba(26,19,19,0.6)", cursor: "pointer" }

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  VIP: { bg: "rgba(99,102,241,0.1)", text: "#4338ca" },
  ACTIVE: { bg: "rgba(34,197,94,0.1)", text: "#15803d" },
  AT_RISK: { bg: "rgba(234,179,8,0.1)", text: "#a16207" },
  LAPSED: { bg: "rgba(239,68,68,0.1)", text: "#b91c1c" },
  DEAD: { bg: "rgba(26,19,19,0.08)", text: "rgba(26,19,19,0.5)" },
  NEVER: { bg: "rgba(26,19,19,0.04)", text: "rgba(26,19,19,0.3)" },
  BIG_SPENDER: { bg: "rgba(99,102,241,0.1)", text: "#4338ca" },
  VALUABLE: { bg: "rgba(34,197,94,0.1)", text: "#15803d" },
  AVERAGE: { bg: "rgba(234,179,8,0.1)", text: "#a16207" },
  LOW_VALUE: { bg: "rgba(26,19,19,0.06)", text: "rgba(26,19,19,0.4)" },
}

const PRIORITY_COLORS = ["", "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#0891b2", "#6366f1", "#7c3aed"]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Agent = Record<string, any>

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) }
function daysSince(d: string | null) { if (!d) return "Never"; return `${Math.floor((Date.now() - new Date(d).getTime()) / 86400000)}d ago` }

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

  if (loading) return <div style={{ padding: "48px 32px", color: "rgba(26,19,19,0.3)" }}>Loading...</div>

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <Link href="/agents" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Agents
      </Link>

      {/* Control Panel */}
      <div style={{ ...cardStyle, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${ACC}15`, color: ACC, display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={20} strokeWidth={1.5} /></div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1A1313", margin: 0 }}>Reyna Recovery</h1>
            <div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)" }}>
              {agent?.lastRunAt ? `Last run: ${new Date(agent.lastRunAt).toLocaleString()}` : "Never run"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={toggleStatus} style={{ ...btnGhost, color: agent?.status === "active" ? "#a16207" : "#15803d" }}>
            {agent?.status === "active" ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Activate</>}
          </button>
          <button onClick={runNow} disabled={running} style={{ ...btnPrimary, opacity: running ? 0.5 : 1 }}>
            {running ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={14} />} Run Now
          </button>
          <Link href="/agents/reyna-recovery/config" style={{ ...btnGhost, textDecoration: "none" }}>
            <Settings size={14} /> Config
          </Link>
          <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 700, backgroundColor: agent?.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)", color: agent?.status === "active" ? "#15803d" : "#a16207" }}>
            {agent?.status || "unknown"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Pending review", value: stats.pendingCount || 0, icon: <Eye size={14} />, color: "#a16207" },
          { label: "Approved (7d)", value: stats.weeklyApproved || 0, icon: <CheckCircle2 size={14} />, color: "#15803d" },
          { label: "Sent (7d)", value: stats.weeklySent || 0, icon: <Send size={14} />, color: "#1d4ed8" },
          { label: "Conversions (7d)", value: stats.weeklyConverted || 0, icon: <Users size={14} />, color: ACC },
          { label: "Revenue attributed", value: fmt(agent?.revenueAttributed || 0), icon: <DollarSign size={14} />, color: "#15803d" },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${s.color}15`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1313" }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk actions + filters */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 2 }}>
          {["pending", "approved", "sent", "rejected", "converted", "all"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, border: "1px solid", borderColor: statusFilter === s ? ACC : "rgba(26,19,19,0.06)", backgroundColor: statusFilter === s ? `${ACC}11` : "transparent", color: statusFilter === s ? ACC : "rgba(26,19,19,0.4)", cursor: "pointer" }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
        {statusFilter === "pending" && filtered.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setBulkConfirm("priority")} style={{ ...btnGhost, fontSize: 11 }}><CheckCircle2 size={12} /> Approve P1-3</button>
            <button onClick={() => setBulkConfirm("all")} style={{ ...btnPrimary, fontSize: 11 }}><CheckCircle2 size={12} /> Approve All ({filtered.length})</button>
          </div>
        )}
      </div>

      {/* Drafts table */}
      <div style={cardStyle}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Bot size={36} strokeWidth={1.5} color="rgba(26,19,19,0.12)" style={{ margin: "0 auto 14px" }} />
            <p style={{ color: "rgba(26,19,19,0.45)", fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>No {statusFilter} drafts</p>
            <p style={{ color: "rgba(26,19,19,0.35)", fontSize: 12, margin: 0 }}>{statusFilter === "pending" ? "Run the agent to generate recovery drafts" : "Drafts will appear here as they change status"}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(26,19,19,0.08)" }}>
                  {["P", "Client", "Tiers", "Last Visit", "Spend", "Message", "Offer", "Actions"].map(h => (
                    <th key={h} style={{ padding: "8px 8px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const tc1 = TIER_COLORS[d.client?.vipTier] || TIER_COLORS.NEVER
                  const tc2 = TIER_COLORS[d.client?.valueTier] || TIER_COLORS.LOW_VALUE
                  return (
                    <tr key={d.id} style={{ borderBottom: "1px solid rgba(26,19,19,0.04)" }}>
                      <td style={{ padding: "8px", fontWeight: 700, color: PRIORITY_COLORS[d.priority] || "#1A1313", fontSize: 13 }}>{d.priority}</td>
                      <td style={{ padding: "8px" }}>
                        <div style={{ fontWeight: 500, color: "#1A1313" }}>{d.client?.firstName} {d.client?.lastName}</div>
                        <div style={{ fontSize: 10, color: "rgba(26,19,19,0.4)", fontFamily: "monospace" }}>{d.client?.phone?.slice(0, 2)}****{d.client?.phone?.slice(-4)}</div>
                      </td>
                      <td style={{ padding: "8px" }}>
                        <span style={{ padding: "1px 5px", borderRadius: 6, fontSize: 9, fontWeight: 600, backgroundColor: tc1.bg, color: tc1.text, marginRight: 3 }}>{d.client?.vipTier}</span>
                        <span style={{ padding: "1px 5px", borderRadius: 6, fontSize: 9, fontWeight: 600, backgroundColor: tc2.bg, color: tc2.text }}>{d.client?.valueTier}</span>
                      </td>
                      <td style={{ padding: "8px", color: "rgba(26,19,19,0.55)", fontSize: 11 }}>{daysSince(d.client?.lastVisitAt)}</td>
                      <td style={{ padding: "8px", fontWeight: 500, color: "#1A1313", fontFamily: "monospace", fontSize: 11 }}>{fmt(d.client?.lifetimeSpend || 0)}</td>
                      <td style={{ padding: "8px", maxWidth: 280, color: "#1A1313", fontSize: 11, lineHeight: 1.4 }}>
                        <div title={d.messageBody} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{d.messageBody}</div>
                        <div style={{ fontSize: 9, color: "rgba(26,19,19,0.35)", marginTop: 2 }} title={d.reasoning}>{d.reasoning?.slice(0, 60)}...</div>
                      </td>
                      <td style={{ padding: "8px", fontSize: 11, color: ACC }}>{d.proposedOffer}</td>
                      <td style={{ padding: "8px" }}>
                        {d.status === "pending" ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => approveDraft(d.id)} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, backgroundColor: "rgba(34,197,94,0.1)", color: "#15803d", border: "none", cursor: "pointer" }}><CheckCircle2 size={10} /></button>
                            <button onClick={() => rejectDraft(d.id)} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, backgroundColor: "rgba(239,68,68,0.1)", color: "#dc2626", border: "none", cursor: "pointer" }}><XCircle size={10} /></button>
                            <button onClick={() => { setEditDraft(d); setEditBody(d.messageBody); setEditOffer(d.proposedOffer || "") }} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, backgroundColor: "rgba(122,143,150,0.08)", color: ACC, border: "none", cursor: "pointer" }}><Edit3 size={10} /></button>
                          </div>
                        ) : (
                          <span style={{ padding: "2px 6px", borderRadius: 8, fontSize: 9, fontWeight: 600, backgroundColor: d.status === "sent" ? "rgba(34,197,94,0.1)" : d.status === "approved" ? "rgba(59,130,246,0.1)" : d.status === "converted" ? "rgba(99,102,241,0.1)" : "rgba(26,19,19,0.06)", color: d.status === "sent" ? "#15803d" : d.status === "approved" ? "#1d4ed8" : d.status === "converted" ? "#4338ca" : "rgba(26,19,19,0.4)" }}>{d.status}</span>
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
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1A1313", margin: "0 0 4px" }}>Edit Draft</h2>
            <p style={{ fontSize: 12, color: "rgba(26,19,19,0.4)", margin: "0 0 16px" }}>For {editDraft.client?.firstName} {editDraft.client?.lastName}</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Message ({editBody.length} chars)</label>
              <textarea value={editBody} onChange={e => setEditBody(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 13, color: "#1A1313", backgroundColor: "#FBFBFB", minHeight: 80, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Offer</label>
              <input value={editOffer} onChange={e => setEditOffer(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 13, color: "#1A1313", backgroundColor: "#FBFBFB", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setEditDraft(null)} style={btnGhost}>Cancel</button>
              <button onClick={saveEdit} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk confirm modal */}
      {bulkConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setBulkConfirm(null)}>
          <div style={{ ...cardStyle, maxWidth: 420, width: "90%", padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1A1313", margin: "0 0 8px" }}>Confirm Bulk Approve</h2>
            <p style={{ fontSize: 12, color: "rgba(26,19,19,0.5)", margin: "0 0 16px" }}>
              {bulkConfirm === "all" ? `Approve all ${filtered.length} pending drafts?` : "Approve all Priority 1-3 drafts (highest value)?"}
            </p>
            <div style={{ padding: 10, backgroundColor: "rgba(234,179,8,0.06)", borderRadius: 8, marginBottom: 16, fontSize: 11, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={14} /> Approved drafts will be sent at their scheduled time.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setBulkConfirm(null)} style={btnGhost}>Cancel</button>
              <button onClick={() => bulkApprove(bulkConfirm)} style={btnPrimary}><CheckCircle2 size={14} /> Confirm</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
