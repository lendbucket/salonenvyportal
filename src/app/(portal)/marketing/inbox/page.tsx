"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { Inbox, Send, Loader2, Archive, Sparkles, MessageSquare, Save, X } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }

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
const INTENT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  booking_request: { label: "Booking", color: "#059669", bg: "#dcfce7" },
  question: { label: "Question", color: "#2563eb", bg: "#dbeafe" },
  compliment: { label: "Compliment", color: "#7c3aed", bg: "#ede9fe" },
  complaint: { label: "Complaint", color: "#dc2626", bg: "#fee2e2" },
  stop: { label: "Opt-out", color: "#6b7280", bg: "#f3f4f6" },
  other: { label: "Other", color: "#6b7280", bg: "#f3f4f6" },
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null
  const c = TIER_COLORS[tier] || TIER_COLORS.NEVER
  return <span style={{ padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 600, backgroundColor: c.bg, color: c.text }}>{TIER_LABELS[tier] || tier}</span>
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  if (h < 48) return "Yesterday"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Conversation = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TimelineMsg = Record<string, any>

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "booking_request", label: "Booking" },
  { key: "complaint", label: "Complaints" },
  { key: "archived", label: "Archived" },
]

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNumber, setActiveNumber] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineMsg[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeClient, setActiveClient] = useState<any>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [tab, setTab] = useState("all")
  const [reply, setReply] = useState("")
  const [replySource, setReplySource] = useState<"user" | "ai">("user")
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [sendConfirm, setSendConfirm] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const threadEnd = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const statusParam = tab === "all" ? "" : tab === "unread" ? "status=unread" : tab === "archived" ? "status=archived" : `intent=${tab}`
      const r = await fetch(`/api/marketing/inbox/conversations?${statusParam}`)
      const d = await r.json()
      setConversations(d.conversations || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [tab])

  useEffect(() => { loadConversations() }, [loadConversations])

  async function loadThread(fromNumber: string) {
    setActiveNumber(fromNumber)
    setTimelineLoading(true)
    setReply("")
    setReplySource("user")
    setDraftSaved(false)
    try {
      const r = await fetch(`/api/marketing/inbox/conversations/${encodeURIComponent(fromNumber)}/messages`)
      const d = await r.json()
      setTimeline(d.timeline || [])
      setActiveClient(d.client)
      // Mark unread messages as read + load saved draft
      for (const m of (d.timeline || [])) {
        if (m.type === "inbound" && m.status === "unread") {
          fetch(`/api/marketing/inbox/messages/${m.id}/mark-read`, { method: "POST" }).catch(() => {})
        }
      }
      const lastInbound = (d.timeline || []).filter((m: TimelineMsg) => m.type === "inbound").pop()
      if (lastInbound?.replyDraft) {
        setReply(lastInbound.replyDraft)
        setReplySource("ai")
        setDraftSaved(true)
      }
    } catch { /* ignore */ }
    setTimelineLoading(false)
    setTimeout(() => threadEnd.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  function trySendReply() {
    if (!activeNumber || !reply.trim()) return
    const segments = reply.length <= 160 ? 1 : Math.ceil(reply.length / 153)
    if (segments > 1) { setSendConfirm(true); return }
    doSendReply()
  }

  async function doSendReply() {
    if (!activeNumber || !reply.trim()) return
    setSending(true)
    setSendConfirm(false)
    await fetch(`/api/marketing/inbox/conversations/${encodeURIComponent(activeNumber)}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply }),
    })
    setReply("")
    setReplySource("user")
    setSending(false)
    loadThread(activeNumber)
    loadConversations()
  }

  async function suggestReply(msgId: string) {
    setSuggesting(true)
    try {
      const r = await fetch(`/api/marketing/inbox/messages/${msgId}/suggest-reply`, { method: "POST" })
      const d = await r.json()
      if (d.draft) { setReply(d.draft); setReplySource("ai") }
    } catch { /* ignore */ }
    setSuggesting(false)
  }

  async function saveDraftReply() {
    if (!activeNumber || !reply.trim()) return
    const lastInbound = timeline.filter(m => m.type === "inbound").pop()
    if (lastInbound) {
      await fetch(`/api/marketing/inbox/messages/${lastInbound.id}/save-draft`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: reply }) }).catch(() => {})
    }
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }

  function clearDraft() {
    setReply("")
    setReplySource("user")
    setDraftSaved(false)
  }

  async function archiveConversation() {
    if (!activeNumber) return
    for (const m of timeline.filter(m => m.type === "inbound")) {
      await fetch(`/api/marketing/inbox/messages/${m.id}/archive`, { method: "POST" }).catch(() => {})
    }
    setActiveNumber(null)
    setTimeline([])
    loadConversations()
  }

  const unreadCount = conversations.filter(c => c.status === "unread").length

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto", height: "calc(100vh - 48px)", display: "flex", flexDirection: "column" }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px", letterSpacing: "-0.31px" }}>Inbox</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 20px" }}>Customer replies to your SMS messages</p>

      <div style={{ flex: 1, display: "flex", gap: 0, ...cardStyle, minHeight: 0 }}>
        {/* LEFT: Conversation list */}
        <div style={{ width: 380, flexShrink: 0, borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, padding: "12px 16px", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setActiveNumber(null) }} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, backgroundColor: tab === t.key ? "#f4f5f7" : "transparent", color: tab === t.key ? "#1e2a30" : "#525866", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {t.label}
                {t.key === "unread" && unreadCount > 0 && <span style={{ padding: "0 5px", borderRadius: 8, fontSize: 10, fontWeight: 700, backgroundColor: ACC, color: "#fff", minWidth: 16, textAlign: "center" }}>{unreadCount}</span>}
              </button>
            ))}
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center" }}>
                <Inbox size={48} strokeWidth={1.5} color={`${ACC}40`} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 4px" }}>No replies yet</p>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>When customers reply to your SMS messages, they will appear here</p>
              </div>
            ) : conversations.map(c => {
              const isActive = activeNumber === c.fromNumber
              const isUnread = c.status === "unread"
              const intentInfo = c.intent ? INTENT_LABELS[c.intent] : null
              return (
                <div key={c.fromNumber} onClick={() => loadThread(c.fromNumber)} style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", backgroundColor: isActive ? "#f4f5f7" : "transparent", borderLeft: isActive ? `3px solid ${ACC}` : "3px solid transparent", transition: "background 0.1s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isUnread && <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: ACC, flexShrink: 0 }} />}
                      <span style={{ fontSize: 14, fontWeight: isUnread ? 600 : 400, color: "#1A1313" }}>{c.client ? `${c.client.firstName || ""} ${c.client.lastName || ""}`.trim() : c.fromNumber}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(c.receivedAt)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {c.client?.vipTier && <TierBadge tier={c.client.vipTier} />}
                    {c.client?.valueTier && <TierBadge tier={c.client.valueTier} />}
                    {intentInfo && <span style={{ padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 600, backgroundColor: intentInfo.bg, color: intentInfo.color }}>{intentInfo.label}</span>}
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.body?.slice(0, 60)}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Thread view */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!activeNumber ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <MessageSquare size={48} strokeWidth={1.5} color={`${ACC}30`} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 15, fontWeight: 500, color: "#9ca3af", margin: 0 }}>Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Client info bar */}
              {activeClient && (
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1313" }}>{activeClient.firstName} {activeClient.lastName}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", display: "flex", gap: 8, marginTop: 2 }}>
                      <span>${(activeClient.lifetimeSpend || 0).toFixed(0)} lifetime</span>
                      <span>{activeClient.totalVisits || 0} visits</span>
                      <span>{activeClient.lastVisitAt ? `Last visit ${timeAgo(activeClient.lastVisitAt)}` : "Never visited"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <TierBadge tier={activeClient.vipTier} />
                    <TierBadge tier={activeClient.valueTier} />
                    <button onClick={archiveConversation} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Archive size={12} /> Archive</button>
                  </div>
                </div>
              )}

              {/* Thread */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {timelineLoading ? (
                  <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>Loading...</div>
                ) : timeline.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.type === "outbound" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                    <div style={{ maxWidth: "70%", padding: 12, borderRadius: 12, fontSize: 14, lineHeight: 1.5, color: "#1A1313", ...(m.type === "outbound" ? { backgroundColor: "#f4f5f7" } : { backgroundColor: "#fff", border: "1px solid #e5e7eb" }) }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginBottom: 4 }}>{m.type === "outbound" ? "Salon Envy" : (activeClient?.firstName || activeNumber)}</div>
                      <div>{m.body}</div>
                      <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{new Date(m.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        {m.type === "inbound" && m.intent && <span style={{ padding: "0 4px", borderRadius: 4, fontSize: 9, fontWeight: 600, ...(INTENT_LABELS[m.intent] ? { backgroundColor: INTENT_LABELS[m.intent].bg, color: INTENT_LABELS[m.intent].color } : {}) }}>{INTENT_LABELS[m.intent]?.label || m.intent}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={threadEnd} />
              </div>

              {/* Reply composer */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  {timeline.some(m => m.type === "inbound") && (
                    <button onClick={() => { const lastInbound = timeline.filter(m => m.type === "inbound").pop(); if (lastInbound) suggestReply(lastInbound.id) }} disabled={suggesting} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, backgroundColor: `${ACC}10`, color: ACC, border: `1px solid ${ACC}30`, cursor: "pointer", opacity: suggesting ? 0.5 : 1 }}>
                      {suggesting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={12} />} Suggested reply
                    </button>
                  )}
                  {replySource === "ai" && reply && <span style={{ fontSize: 11, color: ACC, fontWeight: 500 }}>AI suggestion -- edit as needed</span>}
                  {draftSaved && <span style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>Draft saved</span>}
                  {reply && (
                    <button onClick={clearDraft} title="Clear" style={{ marginLeft: "auto", padding: "2px 6px", borderRadius: 4, backgroundColor: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}><X size={14} /></button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea value={reply} onChange={e => { setReply(e.target.value); if (replySource === "ai" && e.target.value !== reply) setReplySource("user") }} placeholder="Type a reply..." style={{ flex: 1, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313", backgroundColor: "#fff", resize: "none", minHeight: 40, maxHeight: 160, boxSizing: "border-box", outline: "none", lineHeight: 1.5 }} rows={Math.min(6, Math.max(1, reply.split("\n").length))} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); trySendReply() } }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "flex-end" }}>
                    <button onClick={saveDraftReply} disabled={!reply.trim()} title="Save draft" style={{ padding: "8px", borderRadius: 6, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#6b7280", cursor: "pointer", opacity: !reply.trim() ? 0.3 : 1 }}><Save size={14} /></button>
                    <button onClick={trySendReply} disabled={!reply.trim() || sending} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", opacity: !reply.trim() || sending ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                      {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />} Send
                    </button>
                  </div>
                </div>
                {(() => {
                  const segments = reply.length <= 160 ? 1 : Math.ceil(reply.length / 153)
                  const maxChars = segments * (segments === 1 ? 160 : 153)
                  return (
                    <div style={{ fontSize: 11, color: segments > 1 ? "#d97706" : "#d1d5db", textAlign: "right", marginTop: 4 }}>
                      {segments} SMS ({reply.length}/{maxChars})
                    </div>
                  )
                })()}
              </div>

              {/* Multi-segment send confirmation */}
              {sendConfirm && (
                <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSendConfirm(false)}>
                  <div style={{ backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, maxWidth: 380, width: "90%", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", margin: "0 0 8px" }}>Send multi-segment SMS?</h3>
                    <p style={{ fontSize: 13, color: "#525866", margin: "0 0 16px" }}>This message is {reply.length} characters ({Math.ceil(reply.length / 153)} segments). You will be charged for {Math.ceil(reply.length / 153)} messages instead of 1.</p>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button onClick={() => setSendConfirm(false)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#525866", cursor: "pointer" }}>Cancel</button>
                      <button onClick={doSendReply} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer" }}>Send</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
