"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"

type LogEntry = {
  id: string; action: string; entity: string; entityId: string | null
  userId: string | null; userEmail: string | null; userRole: string | null
  locationId: string | null; metadata: Record<string, unknown> | null
  createdAt: string
  user: { name: string | null; email: string | null } | null
  location: { name: string } | null
}

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
const AMBER = "#f59e0b"

const mono: React.CSSProperties = { fontFamily: "'Fira Code', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }

const ACTION_GROUPS: Record<string, string[]> = {
  Auth: ["USER_LOGIN", "USER_LOGOUT"],
  Staff: ["STAFF_INVITED", "STAFF_ENROLLED", "STAFF_UPDATED", "STAFF_DEACTIVATED"],
  Schedule: ["SCHEDULE_SUBMITTED", "SCHEDULE_APPROVED", "SCHEDULE_REJECTED"],
  "Purchase Orders": ["PO_CREATED", "PO_APPROVED", "PO_REJECTED"],
  Inventory: ["INVENTORY_ADDED", "INVENTORY_UPDATED"],
  Payroll: ["PAYROLL_MARKED_PAID", "PAYROLL_EXPORTED"],
  Alerts: ["ALERT_CREATED", "ALERT_DELETED"],
  Conduct: ["CONDUCT_RECORD_CREATED", "COMPLAINT_SUBMITTED"],
  Onboarding: ["ONBOARDING_COMPLETED"],
  POS: ["POS_TRANSACTION_COMPLETED"],
  Approvals: ["APPROVAL_REVIEWED"],
}

const SUCCESS_ACTIONS = new Set(["SCHEDULE_APPROVED", "PO_APPROVED", "PAYROLL_MARKED_PAID", "ONBOARDING_COMPLETED", "POS_TRANSACTION_COMPLETED", "APPROVAL_REVIEWED", "STAFF_ENROLLED"])
const WARNING_ACTIONS = new Set(["SCHEDULE_REJECTED", "PO_REJECTED", "STAFF_DEACTIVATED", "ALERT_DELETED"])

function getActionColor(action: string): { bg: string; text: string } {
  if (SUCCESS_ACTIONS.has(action)) return { bg: "rgba(34,197,94,0.1)", text: "#22c55e" }
  if (WARNING_ACTIONS.has(action)) return { bg: "rgba(245,158,11,0.1)", text: AMBER }
  return { bg: ACC_DIM, text: ACC_BRIGHT }
}

function fmtTime(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/Chicago" })
}

export default function AuditLogPage() {
  const { isOwner } = useUserRole()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [filterEntity, setFilterEntity] = useState("")
  const [filterLoc, setFilterLoc] = useState("")
  const [filterStart, setFilterStart] = useState("")
  const [filterEnd, setFilterEnd] = useState("")
  const [expandedMeta, setExpandedMeta] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const limit = 50

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (filterAction) params.set("action", filterAction)
      if (filterEntity) params.set("entity", filterEntity)
      if (filterLoc) params.set("locationId", filterLoc)
      if (filterStart) params.set("startDate", filterStart)
      if (filterEnd) params.set("endDate", filterEnd)
      const res = await fetch(`/api/audit-log?${params}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setLogs(data.logs || []); setTotal(data.total || 0); setTotalPages(data.totalPages || 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally { setLoading(false) }
  }, [page, filterAction, filterEntity, filterLoc, filterStart, filterEnd])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => {
    const id = setInterval(() => fetchLogs(), 120000)
    return () => clearInterval(id)
  }, [fetchLogs])

  const clearFilters = () => {
    setFilterAction(""); setFilterEntity(""); setFilterLoc(""); setFilterStart(""); setFilterEnd("")
    setPage(1)
  }

  const hasFilters = filterAction || filterEntity || filterLoc || filterStart || filterEnd

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ page: "1", limit: "10000" })
      if (filterAction) params.set("action", filterAction)
      if (filterEntity) params.set("entity", filterEntity)
      if (filterLoc) params.set("locationId", filterLoc)
      if (filterStart) params.set("startDate", filterStart)
      if (filterEnd) params.set("endDate", filterEnd)
      const res = await fetch(`/api/audit-log?${params}`)
      const data = await res.json()
      const rows = [["Timestamp", "Action", "Entity", "Entity ID", "User Email", "User Role", "Location", "Metadata"]]
      for (const l of (data.logs || []) as LogEntry[]) {
        rows.push([
          fmtTime(l.createdAt), l.action, l.entity, l.entityId || "",
          l.user?.email || l.userEmail || "", l.userRole || "",
          l.location?.name || "", l.metadata ? JSON.stringify(l.metadata) : "",
        ])
      }
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `audit-log_${new Date().toISOString().split("T")[0]}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { /* noop */ }
  }

  const inputStyle: React.CSSProperties = { padding: "8px 12px", fontSize: "16px", borderRadius: "8px", border: `1px solid ${BORDER2}`, backgroundColor: "rgba(255,255,255,0.06)", color: "#fff", outline: "none", width: "100%", boxSizing: "border-box" as const, ...jakarta }

  const startIdx = (page - 1) * limit + 1
  const endIdx = Math.min(page * limit, total)

  if (!isOwner) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: MUTED }}>
        <span className="material-symbols-outlined" style={{ fontSize: "48px", marginBottom: "16px", display: "block" }}>lock</span>
        <div style={{ fontSize: "16px", fontWeight: 700 }}>Owner Access Only</div>
      </div>
    )
  }

  return (
    <div style={{ ...jakarta, padding: "24px", maxWidth: "1200px", margin: "0 auto", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Audit Log</h1>
          <p style={{ ...mono, fontSize: "11px", color: MUTED, margin: "4px 0 0" }}>{total.toLocaleString()} entries</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setShowFilters(!showFilters)} style={{ padding: "8px 14px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: `1px solid ${showFilters ? ACC_BRIGHT : BORDER2}`, borderRadius: "8px", backgroundColor: showFilters ? ACC_DIM : "transparent", color: ACC_BRIGHT, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", ...mono }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>filter_list</span>
            Filters{hasFilters ? " *" : ""}
          </button>
          <button onClick={handleExport} style={{ padding: "8px 14px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", border: `1px solid ${BORDER2}`, borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.04)", color: ACC_BRIGHT, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", ...jakarta }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ backgroundColor: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "16px", marginBottom: "16px", boxShadow: CARD_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ ...mono, display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Action</label>
              <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }} style={inputStyle}>
                <option value="">All Actions</option>
                {Object.entries(ACTION_GROUPS).map(([group, actions]) => (
                  <optgroup key={group} label={group}>
                    {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={{ ...mono, display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Entity</label>
              <input value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1) }} placeholder="e.g. PurchaseOrder" style={inputStyle} />
            </div>
            <div>
              <label style={{ ...mono, display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Location</label>
              <select value={filterLoc} onChange={e => { setFilterLoc(e.target.value); setPage(1) }} style={inputStyle}>
                <option value="">All</option>
                <option value="cc">CC</option>
                <option value="sa">SA</option>
              </select>
            </div>
            <div>
              <label style={{ ...mono, display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Start Date</label>
              <input type="date" value={filterStart} onChange={e => { setFilterStart(e.target.value); setPage(1) }} style={inputStyle} />
            </div>
            <div>
              <label style={{ ...mono, display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>End Date</label>
              <input type="date" value={filterEnd} onChange={e => { setFilterEnd(e.target.value); setPage(1) }} style={inputStyle} />
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} style={{ padding: "6px 12px", fontSize: "10px", fontWeight: 700, border: `1px solid ${BORDER2}`, borderRadius: "6px", backgroundColor: "transparent", color: MUTED, cursor: "pointer", ...mono }}>Clear Filters</button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ height: "52px", backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "8px", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "40px", textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#ef4444", display: "block", marginBottom: "8px" }}>error</span>
          <div style={{ fontSize: "13px", color: MID, marginBottom: "12px" }}>{error}</div>
          <button onClick={() => fetchLogs()} style={{ padding: "8px 16px", border: `1px solid ${BORDER2}`, borderRadius: "8px", backgroundColor: "transparent", color: ACC_BRIGHT, cursor: "pointer", fontSize: "12px", ...jakarta }}>Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && logs.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: ACC }}>
          <span className="material-symbols-outlined" style={{ fontSize: "40px", display: "block", marginBottom: "10px", color: MUTED }}>history</span>
          <div style={{ fontSize: "14px" }}>No audit log entries</div>
        </div>
      )}

      {/* Log entries */}
      {!loading && !error && logs.length > 0 && (
        <div style={{ backgroundColor: "#0d1117", border: `1px solid rgba(26,35,50,0.8)`, borderRadius: "12px", overflow: "hidden", boxShadow: CARD_SHADOW }}>
          {logs.map((log, i) => {
            const ac = getActionColor(log.action)
            const hasMeta = log.metadata && Object.keys(log.metadata).length > 0
            return (
              <div key={log.id} style={{ padding: "12px 16px", borderBottom: i < logs.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                {/* Row */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {/* Timestamp */}
                  <span style={{ ...mono, fontSize: "11px", color: ACC, whiteSpace: "nowrap", minWidth: "170px" }}>{fmtTime(log.createdAt)}</span>

                  {/* Action badge */}
                  <span style={{ ...mono, fontSize: "9px", padding: "2px 8px", borderRadius: "4px", backgroundColor: ac.bg, color: ac.text, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{log.action.replace(/_/g, " ")}</span>

                  {/* Entity */}
                  <span style={{ fontSize: "13px", color: "#fff", ...jakarta }}>
                    {log.entity}
                    {log.entityId && <span style={{ ...mono, fontSize: "11px", color: MUTED, marginLeft: "4px" }}>#{log.entityId.slice(-8)}</span>}
                  </span>

                  {/* User */}
                  <span style={{ fontSize: "12px", color: ACC_BRIGHT, marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                    {log.user?.email || log.userEmail || ""}
                    {log.userRole && <span style={{ ...mono, fontSize: "8px", padding: "1px 6px", borderRadius: "3px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT, textTransform: "uppercase" }}>{log.userRole}</span>}
                  </span>

                  {/* Location */}
                  {log.location?.name && (
                    <span style={{ ...mono, fontSize: "8px", padding: "1px 6px", borderRadius: "3px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT }}>{log.location.name === "Corpus Christi" ? "CC" : "SA"}</span>
                  )}

                  {/* Metadata toggle */}
                  {hasMeta && (
                    <button onClick={() => setExpandedMeta(expandedMeta === log.id ? null : log.id)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: "2px", display: "flex", alignItems: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", transform: expandedMeta === log.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>expand_more</span>
                    </button>
                  )}
                </div>

                {/* Expanded metadata */}
                {expandedMeta === log.id && hasMeta && (
                  <div style={{ marginTop: "8px", padding: "8px 12px", backgroundColor: S1, borderRadius: "6px", ...mono, fontSize: "11px", color: ACC, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {JSON.stringify(log.metadata, null, 2)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>
          <span style={{ ...mono, fontSize: "11px", color: MUTED }}>Showing {startIdx}-{endIdx} of {total.toLocaleString()} entries</span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => { setPage(p => Math.max(1, p - 1)) }} disabled={page <= 1} style={{ padding: "6px 14px", fontSize: "10px", fontWeight: 700, border: `1px solid ${page <= 1 ? BORDER : BORDER2}`, borderRadius: "6px", backgroundColor: "transparent", color: page <= 1 ? MUTED : ACC_BRIGHT, cursor: page <= 1 ? "default" : "pointer", ...mono }}>Previous</button>
            <span style={{ ...mono, fontSize: "11px", color: ACC_BRIGHT, padding: "6px 10px" }}>{page} / {totalPages}</span>
            <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)) }} disabled={page >= totalPages} style={{ padding: "6px 14px", fontSize: "10px", fontWeight: 700, border: `1px solid ${page >= totalPages ? BORDER : BORDER2}`, borderRadius: "6px", backgroundColor: "transparent", color: page >= totalPages ? MUTED : ACC_BRIGHT, cursor: page >= totalPages ? "default" : "pointer", ...mono }}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
