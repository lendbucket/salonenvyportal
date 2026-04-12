"use client"
import { useCallback, useEffect, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"

type Alert = {
  id: string; type: string; title: string; body: string; severity: string
  locationName: string | null; locationId: string | null; createdByName: string | null
  expiresAt: string | null; createdAt: string; readCount: number; totalStaff: number; isRead: boolean
}

type Filter = "all" | "unread" | "broadcast" | "system" | "critical"
type LocFilter = "all" | "cc" | "sa"

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.06)"
const BORDER2 = "rgba(255,255,255,0.08)"
const CARD_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)"
const S1 = "rgba(255,255,255,0.03)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#10B981"

const SEV_COLORS: Record<string, string> = { info: ACC, warning: "#f59e0b", critical: "#ef4444" }
const SEV_LABELS: Record<string, string> = { info: "Info", warning: "Warning", critical: "Critical" }

const mono: React.CSSProperties = { fontFamily: "'Fira Code', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }

function timeAgo(d: string) {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

export default function AlertsPage() {
  const { isOwner, isManager } = useUserRole()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [locFilter, setLocFilter] = useState<LocFilter>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ title: "", body: "", severity: "info", locationId: "", expiresAt: "" })
  const [creating, setCreating] = useState(false)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
  }, [])

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts")
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setAlerts(data.alerts || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])
  useEffect(() => {
    const id = setInterval(fetchAlerts, 60000)
    return () => clearInterval(id)
  }, [fetchAlerts])

  const handleCreate = async () => {
    if (!createForm.title || !createForm.body) return
    setCreating(true)
    try {
      await fetch("/api/alerts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title, body: createForm.body, severity: createForm.severity,
          locationId: createForm.locationId || null, expiresAt: createForm.expiresAt || null,
        }),
      })
      setCreateForm({ title: "", body: "", severity: "info", locationId: "", expiresAt: "" })
      setShowCreate(false)
      await fetchAlerts()
    } catch { /* noop */ }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" })
    setAlerts(prev => prev.filter(a => a.id !== id))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/alerts/${id}/read`, { method: "POST" })
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true, readCount: a.readCount + 1 } : a))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const filtered = alerts.filter(a => {
    if (filter === "unread" && a.isRead) return false
    if (filter === "broadcast" && a.type !== "broadcast") return false
    if (filter === "system" && a.type !== "system") return false
    if (filter === "critical" && a.severity !== "critical") return false
    if (locFilter === "cc" && a.locationName !== "Corpus Christi" && a.locationName !== null) return false
    if (locFilter === "sa" && a.locationName !== "San Antonio" && a.locationName !== null) return false
    return true
  })

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", backgroundColor: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER2}`, borderRadius: "8px", color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" as const, ...jakarta }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "6px", ...mono }

  const ownerFilters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "unread", label: "Unread" },
    { id: "broadcast", label: "Broadcast" }, { id: "system", label: "System" }, { id: "critical", label: "Critical" },
  ]
  const staffFilters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "unread", label: "Unread" }, { id: "critical", label: "Critical" },
  ]
  const filterTabs = isOwner ? ownerFilters : staffFilters

  return (
    <div style={{ ...jakarta, padding: "24px", maxWidth: "900px", margin: "0 auto", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Alerts</h1>
          {unreadCount > 0 && (
            <span style={{ ...mono, fontSize: "10px", padding: "3px 10px", borderRadius: "100px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT }}>{unreadCount} unread</span>
          )}
        </div>
        {isOwner && (
          <button onClick={() => setShowCreate(!showCreate)} style={{ padding: "8px 16px", fontSize: "12px", fontWeight: 700, border: `1px solid ${ACC_BORDER}`, borderRadius: "8px", backgroundColor: showCreate ? ACC_DIM : "transparent", color: ACC_BRIGHT, cursor: "pointer", ...jakarta }}>
            {showCreate ? "Cancel" : "Create Announcement"}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && isOwner && (
        <div style={{ backgroundColor: "rgba(13,17,23,0.9)", border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div><label style={labelStyle}>Title</label><input value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title" style={inputStyle} /></div>
            <div><label style={labelStyle}>Body</label><textarea value={createForm.body} onChange={e => setCreateForm(p => ({ ...p, body: e.target.value }))} placeholder="What do your staff need to know?" style={{ ...inputStyle, height: "80px", resize: "vertical" as const }} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div><label style={labelStyle}>Severity</label>
                <select value={createForm.severity} onChange={e => setCreateForm(p => ({ ...p, severity: e.target.value }))} style={inputStyle}>
                  <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
                </select>
              </div>
              <div><label style={labelStyle}>Location</label>
                <select value={createForm.locationId} onChange={e => setCreateForm(p => ({ ...p, locationId: e.target.value }))} style={inputStyle}>
                  <option value="">All Locations</option>
                  {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Auto-dismiss after</label><input type="date" value={createForm.expiresAt} onChange={e => setCreateForm(p => ({ ...p, expiresAt: e.target.value }))} style={inputStyle} /></div>
            </div>
            <button onClick={handleCreate} disabled={creating || !createForm.title || !createForm.body} style={{ padding: "10px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: (!createForm.title || !createForm.body || creating) ? 0.5 : 1 }}>
              {creating ? "Posting..." : "Post Announcement"}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto", flexWrap: "wrap" }}>
        {filterTabs.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "6px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            border: filter === f.id ? `1px solid ${ACC_BRIGHT}` : `1px solid ${BORDER2}`,
            borderRadius: "6px", backgroundColor: filter === f.id ? ACC_DIM : "transparent",
            color: filter === f.id ? ACC_BRIGHT : MUTED, cursor: "pointer", ...mono,
          }}>{f.label}{f.id === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}</button>
        ))}
        {isOwner && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
            {([["all", "All"], ["cc", "CC"], ["sa", "SA"]] as [LocFilter, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setLocFilter(id)} style={{
                padding: "6px 10px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                border: locFilter === id ? `1px solid ${ACC_BRIGHT}` : `1px solid ${BORDER2}`,
                borderRadius: "6px", backgroundColor: locFilter === id ? ACC_DIM : "transparent",
                color: locFilter === id ? ACC_BRIGHT : MUTED, cursor: "pointer", ...mono,
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "90px", backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "40px", textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#ef4444", display: "block", marginBottom: "8px" }}>error</span>
          <div style={{ fontSize: "13px", color: MID, marginBottom: "12px" }}>{error}</div>
          <button onClick={() => { setError(""); setLoading(true); fetchAlerts() }} style={{ padding: "8px 16px", border: `1px solid ${BORDER2}`, borderRadius: "8px", backgroundColor: "transparent", color: ACC_BRIGHT, cursor: "pointer", fontSize: "12px", ...jakarta }}>Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: ACC }}>
          <span className="material-symbols-outlined" style={{ fontSize: "40px", display: "block", marginBottom: "10px", color: MUTED }}>notifications_off</span>
          <div style={{ fontSize: "14px", color: ACC }}>No alerts</div>
        </div>
      )}

      {/* Alert list */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map(a => {
            const sevColor = SEV_COLORS[a.severity] || ACC
            return (
              <div key={a.id} style={{
                backgroundColor: a.isRead ? "#0d1117" : "rgba(96,110,116,0.08)",
                boxShadow: CARD_SHADOW,
                border: `1px solid ${a.isRead ? "rgba(26,35,50,0.8)" : BORDER2}`,
                borderLeft: `3px solid ${sevColor}`,
                borderRadius: "0 12px 12px 0",
                padding: "16px 20px",
              }}>
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff", ...jakarta }}>{a.title}</span>
                    <span style={{ ...mono, fontSize: "8px", padding: "2px 7px", borderRadius: "4px", backgroundColor: `${sevColor}15`, border: `1px solid ${sevColor}30`, color: sevColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>{SEV_LABELS[a.severity] || a.severity}</span>
                    {a.locationName && (
                      <span style={{ ...mono, fontSize: "8px", padding: "2px 7px", borderRadius: "4px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT }}>{a.locationName}</span>
                    )}
                  </div>
                  <span style={{ ...mono, fontSize: "11px", color: ACC, whiteSpace: "nowrap", flexShrink: 0 }}>{timeAgo(a.createdAt)}</span>
                </div>

                {/* Body */}
                <div style={{ fontSize: "13px", color: ACC_BRIGHT, lineHeight: 1.6, marginBottom: "10px" }}>{a.body}</div>

                {/* Bottom row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  {isOwner ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ ...mono, fontSize: "10px", color: MUTED }}>{a.readCount} of {a.totalStaff} staff read</span>
                      <span style={{ ...mono, fontSize: "8px", padding: "2px 7px", borderRadius: "4px", backgroundColor: S1, border: `1px solid ${BORDER}`, color: MUTED, textTransform: "uppercase" }}>{a.type}</span>
                      {a.createdByName && <span style={{ fontSize: "10px", color: MUTED }}>by {a.createdByName}</span>}
                    </div>
                  ) : (
                    <div />
                  )}
                  <div style={{ display: "flex", gap: "6px" }}>
                    {!a.isRead && (
                      <button onClick={() => handleMarkRead(a.id)} style={{ padding: "5px 12px", fontSize: "10px", fontWeight: 700, border: `1px solid ${GREEN}40`, borderRadius: "6px", backgroundColor: `${GREEN}10`, color: GREEN, cursor: "pointer", ...mono, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mark read</button>
                    )}
                    {isOwner && (
                      <button onClick={() => handleDelete(a.id)} style={{ padding: "5px 10px", fontSize: "10px", fontWeight: 700, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: "6px", backgroundColor: "transparent", color: "rgba(239,68,68,0.6)", cursor: "pointer", ...mono }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
