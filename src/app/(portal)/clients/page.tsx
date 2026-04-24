"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"
import { RefreshCw, Upload, Download, Search, ChevronRight, CreditCard, List, LayoutGrid, X, Phone, Mail, Calendar, CalendarPlus, Star, Plus, MessageSquare, FlaskConical } from "lucide-react"

const AVATAR_COLORS = [
  { bg: "rgba(122,143,150,0.15)", color: "#4a7080" },
  { bg: "rgba(59,130,246,0.1)", color: "#1d4ed8" },
  { bg: "rgba(168,85,247,0.1)", color: "#7e22ce" },
  { bg: "rgba(34,197,94,0.1)", color: "#15803d" },
  { bg: "rgba(249,115,22,0.1)", color: "#c2410c" },
  { bg: "rgba(239,68,68,0.1)", color: "#b91c1c" },
  { bg: "rgba(234,179,8,0.1)", color: "#a16207" },
]

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?"
}

function timeAgo(date: string | null) {
  if (!date) return "—"
  const d = new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientRow = any

export default function ClientsPage() {
  const { isOwner, isManager } = useUserRole()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "alpha">("list")
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null)
  const [clientDetail, setClientDetail] = useState<ClientRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<"overview" | "visits" | "formula" | "notes">("overview")

  const fetchClients = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: "200" })
      if (q) params.set("q", q)
      const res = await fetch(`/api/clients?${params}`)
      const data = await res.json()
      if (p === 0) setClients(data.clients || [])
      else setClients(prev => [...prev, ...(data.clients || [])])
      setTotal(data.total || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients(0, "") }, [fetchClients])

  const handleSearch = (q: string) => {
    setSearch(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setPage(0); fetchClients(0, q) }, 300)
  }

  const syncFromSquare = async () => {
    setSyncing(true)
    try {
      await fetch("/api/clients/sync", { method: "POST" })
      setPage(0)
      await fetchClients(0, search)
    } catch { /* ignore */ }
    setSyncing(false)
  }

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchClients(next, search)
  }

  const openClientDetail = async (client: ClientRow) => {
    setSelectedClient(client)
    setActiveDetailTab("overview")
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`)
      const data = await res.json()
      setClientDetail(data)
    } catch { /* ignore */ }
    setDetailLoading(false)
  }

  const remaining = total - clients.length

  // A-Z grouping
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  const clientsByLetter: Record<string, ClientRow[]> = {}
  alphabet.forEach(l => { clientsByLetter[l] = [] })
  clients.forEach(c => {
    const first = (c.name || "?")[0]?.toUpperCase()
    if (clientsByLetter[first]) clientsByLetter[first].push(c)
    else {
      if (!clientsByLetter["#"]) clientsByLetter["#"] = []
      clientsByLetter["#"].push(c)
    }
  })

  const filteredClients = selectedLetter
    ? (clientsByLetter[selectedLetter] || [])
    : clients

  const btnGhost = {
    height: 36, padding: "0 14px", borderRadius: 8,
    background: "rgba(122,143,150,0.08)", border: "1px solid rgba(122,143,150,0.18)",
    color: "#5a7a82", fontFamily: "Inter", fontSize: 13, fontWeight: 600,
    letterSpacing: "-0.31px", display: "inline-flex" as const, alignItems: "center" as const,
    gap: 6, cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap" as const,
  }

  function renderClient(c: ClientRow) {
    const ci = (c.name?.charCodeAt(0) || 0) % 7
    const av = AVATAR_COLORS[ci]
    return (
      <div key={c.id} onClick={() => openClientDetail(c)} style={{
        background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 10,
        padding: "11px 16px", display: "flex", alignItems: "center", gap: 14,
        cursor: "pointer", transition: "all 0.15s ease", boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
        marginBottom: 5,
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(26,19,19,0.11)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-1px)" }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(26,19,19,0.07)"; e.currentTarget.style.boxShadow = "0 1px 1px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "translateY(0)" }}
      >
        {/* Avatar */}
        <div style={{ width: 40, height: 40, borderRadius: 11, background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: av.color, flexShrink: 0, letterSpacing: "0" }}>
          {getInitials(c.name || "?")}
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: "#1A1313", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.name}</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "rgba(26,19,19,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.phone || c.email || "No contact info"}</div>
        </div>
        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 1 }}>
            <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: "#1A1313", fontVariantNumeric: "tabular-nums" }}>{c.visitCount ?? "—"}</span>
            <span style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 500, color: "rgba(26,19,19,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Visits</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 1 }}>
            <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: "rgba(26,19,19,0.5)", fontVariantNumeric: "tabular-nums" }}>{timeAgo(c.lastVisitAt)}</span>
            <span style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 500, color: "rgba(26,19,19,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Last Visit</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 1 }}>
            <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: c.totalSpend > 0 ? "#15803d" : "rgba(26,19,19,0.35)", fontVariantNumeric: "tabular-nums" }}>{c.totalSpend > 0 ? `$${Math.round(c.totalSpend).toLocaleString()}` : "—"}</span>
            <span style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 500, color: "rgba(26,19,19,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Spend</span>
          </div>
        </div>
        {/* Badges */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
          {c.hasFormula && <span style={{ padding: "2px 7px", borderRadius: 5, background: "rgba(122,143,150,0.08)", border: "1px solid rgba(122,143,150,0.18)", color: "#5a7a82", fontFamily: "Inter", fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const }}>Formula</span>}
          {c.cardOnFile && <span style={{ padding: "2px 7px", borderRadius: 5, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", color: "#1d4ed8", fontFamily: "Inter", fontSize: 10, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}><CreditCard size={9} />Card</span>}
        </div>
        <ChevronRight size={16} color="rgba(26,19,19,0.2)" style={{ flexShrink: 0 }} />
      </div>
    )
  }

  return (
    <div style={{ padding: "24px 32px", background: "#F4F5F7", minHeight: "calc(100vh - 56px)", display: "flex", flexDirection: "column" as const }}>
      {/* Hidden file input */}
      <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={async (e) => {
        const file = e.target.files?.[0]; if (!file) return
        const formData = new FormData(); formData.append("file", file)
        try { await fetch("/api/clients/import", { method: "POST", body: formData }) } catch { /* */ }
        fetchClients(0, search)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px", margin: 0 }}>Clients</h1>
          <p style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.4)", marginTop: 3 }}>{total.toLocaleString()} total clients</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(isOwner || isManager) && (
            <button onClick={syncFromSquare} disabled={syncing} style={{ ...btnGhost, opacity: syncing ? 0.6 : 1 }}>
              <RefreshCw size={14} style={syncing ? { animation: "spin 1s linear infinite" } : undefined} />{syncing ? "Syncing..." : "Sync from Square"}
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} style={btnGhost}><Upload size={14} />Import CSV</button>
          <button onClick={() => window.open("/api/clients?limit=10000&format=csv", "_blank")} style={btnGhost}><Download size={14} />Export</button>
          {/* View toggle */}
          <div style={{ display: "flex", gap: 2, padding: 3, background: "rgba(26,19,19,0.04)", borderRadius: 9, marginLeft: 4 }}>
            {(["list", "alpha"] as const).map(v => (
              <button key={v} onClick={() => { setViewMode(v); setSelectedLetter(null) }} style={{
                height: 30, padding: "0 10px", borderRadius: 7, border: "none", fontFamily: "Inter", fontSize: 13,
                fontWeight: viewMode === v ? 600 : 500, background: viewMode === v ? "#FBFBFB" : "transparent",
                color: viewMode === v ? "#1A1313" : "rgba(26,19,19,0.45)", cursor: "pointer",
                boxShadow: viewMode === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none", display: "flex", alignItems: "center", gap: 5,
              }}>
                {v === "list" ? <List size={14} /> : <LayoutGrid size={14} />}{v === "list" ? "List" : "A-Z"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative" as const, flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(26,19,19,0.3)" }} />
          <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search clients..." style={{
            width: "100%", height: 36, padding: "0 12px 0 34px", borderRadius: 8, background: "#FBFBFB",
            border: "1px solid rgba(26,19,19,0.1)", color: "#1A1313", fontFamily: "Inter", fontSize: 13,
            outline: "none", transition: "all 0.15s ease", boxSizing: "border-box" as const,
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Clients", value: total.toLocaleString(), color: "#1A1313" },
          { label: "With Formula", value: String(clients.filter(c => c.hasFormula).length), color: "#7a8f96" },
          { label: "Showing", value: String(clients.length), color: "rgba(26,19,19,0.5)" },
        ].map(s => (
          <div key={s.label} style={{ background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 10, padding: "12px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            <div style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* A-Z View */}
      {viewMode === "alpha" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 24 }}>
            {alphabet.map(l => {
              const count = clientsByLetter[l]?.length || 0
              const active = selectedLetter === l
              return (
                <div key={l} onClick={() => count > 0 && setSelectedLetter(active ? null : l)} style={{
                  background: active ? "rgba(122,143,150,0.06)" : "#FBFBFB",
                  border: active ? "1px solid rgba(122,143,150,0.3)" : "1px solid rgba(26,19,19,0.07)",
                  borderRadius: 10, padding: "14px 16px", minWidth: 56, display: "flex", flexDirection: "column" as const,
                  alignItems: "center", gap: 4, cursor: count > 0 ? "pointer" : "default",
                  transition: "all 0.15s ease", boxShadow: active ? "0 2px 8px rgba(122,143,150,0.1)" : "0 1px 2px rgba(0,0,0,0.04)",
                  opacity: count === 0 ? 0.35 : 1,
                }}>
                  <span style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 700, color: active ? "#7a8f96" : "#1A1313" }}>{l}</span>
                  <span style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 500, color: active ? "#7a8f96" : "rgba(26,19,19,0.4)" }}>{count} client{count !== 1 ? "s" : ""}</span>
                </div>
              )
            })}
          </div>
          {selectedLetter && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: "rgba(26,19,19,0.5)" }}>Showing clients starting with <strong style={{ color: "#1A1313" }}>{selectedLetter}</strong></span>
              <button onClick={() => setSelectedLetter(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(26,19,19,0.4)", display: "flex", padding: 2 }}><X size={14} /></button>
            </div>
          )}
        </>
      )}

      {/* Loading */}
      {loading && clients.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ height: 62, borderRadius: 10 }} />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "64px 24px", textAlign: "center" as const }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(26,19,19,0.04)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Search size={24} color="rgba(26,19,19,0.2)" />
          </div>
          <div style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 6 }}>{search ? "No clients found" : "No clients yet"}</div>
          <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 400, color: "rgba(26,19,19,0.45)", maxWidth: 320 }}>{search ? "Try adjusting your search." : "Sync from Square to import your client list."}</div>
        </div>
      ) : (
        <>
          {viewMode === "alpha" && selectedLetter ? (
            filteredClients.map(renderClient)
          ) : viewMode === "alpha" ? (
            alphabet.filter(l => (clientsByLetter[l]?.length || 0) > 0).map(l => (
              <div key={l}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 8px" }}>
                  <div style={{ width: 16, height: 1, background: "rgba(26,19,19,0.1)" }} />
                  <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: "rgba(26,19,19,0.4)" }}>{l}</span>
                  <span style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "rgba(26,19,19,0.3)" }}>{clientsByLetter[l].length}</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(26,19,19,0.06)" }} />
                </div>
                {clientsByLetter[l].map(renderClient)}
              </div>
            ))
          ) : (
            filteredClients.map(renderClient)
          )}

          {remaining > 0 && viewMode === "list" && (
            <button onClick={loadMore} disabled={loading} style={{
              width: "100%", height: 40, borderRadius: 10, background: "transparent",
              border: "1px solid rgba(26,19,19,0.08)", color: "rgba(26,19,19,0.45)",
              fontFamily: "Inter", fontSize: 13, fontWeight: 500, cursor: "pointer",
              marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, transition: "all 0.15s ease", letterSpacing: "-0.31px",
              opacity: loading ? 0.5 : 1,
            }}>
              {loading ? "Loading..." : `Load more (${remaining.toLocaleString()} remaining)`}
            </button>
          )}
        </>
      )}

      {/* Client Detail Panel Backdrop */}
      {selectedClient && (
        <div onClick={() => { setSelectedClient(null); setClientDetail(null) }} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.15)", backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)", zIndex: 199,
        }} />
      )}

      {/* Client Detail Panel */}
      <div style={{
        position: "fixed", top: 56, right: selectedClient ? 0 : -580, width: 540,
        height: "calc(100vh - 56px)", background: "#FBFBFB",
        borderLeft: "1px solid rgba(26,19,19,0.08)", boxShadow: "-8px 0 40px rgba(0,0,0,0.08)",
        zIndex: 200, display: "flex", flexDirection: "column" as const,
        transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden",
      }}>
        {/* Panel Header */}
        <div style={{ padding: "18px 22px 0", flexShrink: 0 }}>
          <button onClick={() => { setSelectedClient(null); setClientDetail(null) }} style={{
            position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: 8,
            background: "rgba(26,19,19,0.04)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><X size={15} color="rgba(26,19,19,0.4)" /></button>

          <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 14 }}>Client Profile</div>

          {selectedClient && (() => {
            const ci = (selectedClient.name?.charCodeAt(0) || 0) % 7
            const av = AVATAR_COLORS[ci]
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontSize: 18, fontWeight: 700, color: av.color, flexShrink: 0 }}>
                  {getInitials(selectedClient.name || "?")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px" }}>{selectedClient.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12, marginTop: 4 }}>
                    {selectedClient.phone && <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.45)", display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} />{selectedClient.phone}</span>}
                    {selectedClient.email && <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.45)", display: "inline-flex", alignItems: "center", gap: 4 }}><Mail size={12} />{selectedClient.email}</span>}
                  </div>
                  {clientDetail?.client?.createdAt && (
                    <span style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "rgba(26,19,19,0.35)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3 }}><Calendar size={11} />Member since {new Date(clientDetail.client.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Stats Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#F4F5F7", margin: "0 0 0 0", flexShrink: 0 }}>
          {[
            { label: "Total Visits", value: clientDetail?.stats?.totalVisits ?? selectedClient?.visitCount ?? "—" },
            { label: "Total Spend", value: clientDetail?.stats?.totalSpend != null ? `$${Math.round(clientDetail.stats.totalSpend).toLocaleString()}` : selectedClient?.totalSpend > 0 ? `$${Math.round(selectedClient.totalSpend).toLocaleString()}` : "—", color: "#15803d" },
            { label: "Avg Ticket", value: clientDetail?.stats?.avgTicket != null ? `$${Math.round(clientDetail.stats.avgTicket)}` : "—" },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: "12px 16px", textAlign: "center" as const,
              borderRight: i < 2 ? "1px solid rgba(26,19,19,0.06)" : "none",
            }}>
              <div style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 700, color: s.color || "#1A1313", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              <div style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(26,19,19,0.08)", flexShrink: 0, padding: "0 22px" }}>
          {(["overview", "visits", "formula", "notes"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveDetailTab(tab)} style={{
              padding: "10px 14px", fontFamily: "Inter", fontSize: 13, fontWeight: 600,
              color: activeDetailTab === tab ? "#1A1313" : "rgba(26,19,19,0.4)",
              background: "none", border: "none", borderBottom: activeDetailTab === tab ? "2px solid #7a8f96" : "2px solid transparent",
              cursor: "pointer", textTransform: "capitalize" as const, transition: "all 0.15s ease",
            }}>{tab}</button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: "auto" as const, padding: "18px 22px" }}>
          {detailLoading ? (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}
            </div>
          ) : activeDetailTab === "overview" ? (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
              {/* Contact Card */}
              <div style={{ background: "rgba(26,19,19,0.02)", border: "1px solid rgba(26,19,19,0.06)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: 10 }}>
                {[
                  { icon: <Phone size={13} />, label: "Phone", value: clientDetail?.client?.phone || selectedClient?.phone || "—" },
                  { icon: <Mail size={13} />, label: "Email", value: clientDetail?.client?.email || selectedClient?.email || "—" },
                  { icon: <Calendar size={13} />, label: "Birthday", value: clientDetail?.client?.birthday || "—" },
                  { icon: <MessageSquare size={13} />, label: "Notes", value: clientDetail?.client?.notes || "—" },
                ].map(f => (
                  <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ color: "rgba(26,19,19,0.3)", marginTop: 2 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{f.label}</div>
                      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: "#1A1313", marginTop: 1 }}>{f.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Quick Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{
                  flex: 1, height: 38, borderRadius: 9, background: "#1A1313", border: "none", color: "#fff",
                  fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}><CalendarPlus size={14} />Book Appointment</button>
                <button style={{
                  flex: 1, height: 38, borderRadius: 9, background: "rgba(26,19,19,0.04)", border: "1px solid rgba(26,19,19,0.1)", color: "#1A1313",
                  fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}><Plus size={14} />Add Note</button>
              </div>
            </div>
          ) : activeDetailTab === "visits" ? (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {clientDetail?.visits?.length ? clientDetail.visits.map((v: ClientRow, i: number) => (
                <div key={v.orderId || i} style={{ border: "1px solid rgba(26,19,19,0.07)", borderRadius: 10, padding: "13px 14px", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: "#1A1313" }}>{new Date(v.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 700, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>${(v.total / 100).toFixed(2)}</span>
                  </div>
                  {v.services?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 6 }}>
                      {v.services.map((s: string, si: number) => (
                        <span key={si} style={{ padding: "2px 8px", borderRadius: 5, background: "rgba(122,143,150,0.08)", border: "1px solid rgba(122,143,150,0.15)", fontFamily: "Inter", fontSize: 11, fontWeight: 500, color: "#5a7a82" }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, fontFamily: "Inter", fontSize: 11, fontWeight: 400, color: "rgba(26,19,19,0.4)" }}>
                    {v.stylistName && <span>{v.stylistName}</span>}
                    {v.paymentMethod && <span>{v.paymentMethod}{v.last4 ? ` ····${v.last4}` : ""}</span>}
                  </div>
                </div>
              )) : (
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "40px 20px", textAlign: "center" as const }}>
                  <Calendar size={28} color="rgba(26,19,19,0.15)" />
                  <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: "rgba(26,19,19,0.35)", marginTop: 10 }}>No visits recorded</div>
                </div>
              )}
            </div>
          ) : activeDetailTab === "formula" ? (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {clientDetail?.formulas?.length ? clientDetail.formulas.map((f: ClientRow, i: number) => (
                <div key={f.id || i} style={{
                  border: i === 0 ? "1px solid rgba(122,143,150,0.2)" : "1px solid rgba(26,19,19,0.07)",
                  background: i === 0 ? "rgba(122,143,150,0.03)" : "#fff",
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  {i === 0 && <div style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 700, color: "#7a8f96", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>Latest Formula</div>}
                  {i > 0 && f.appliedAt && <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 500, color: "rgba(26,19,19,0.4)", marginBottom: 8 }}>{new Date(f.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                    {[
                      { label: "Base Color", value: f.baseColor },
                      { label: "Color Brand", value: f.colorBrand },
                      { label: "Developer", value: f.developer },
                      { label: "Toner", value: f.toner },
                      { label: "Processing Time", value: f.processingTime },
                      { label: "Technique", value: f.technique },
                    ].filter(x => x.value).map(x => (
                      <div key={x.label}>
                        <div style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{x.label}</div>
                        <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: "#1A1313", marginTop: 1 }}>{x.value}</div>
                      </div>
                    ))}
                  </div>
                  {f.notes && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Notes</div>
                      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "#1A1313", marginTop: 1 }}>{f.notes}</div>
                    </div>
                  )}
                  {f.appliedBy && <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 400, color: "rgba(26,19,19,0.35)", marginTop: 8 }}>Applied by {f.appliedBy}{i === 0 && f.appliedAt ? ` · ${new Date(f.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</div>}
                </div>
              )) : (
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "40px 20px", textAlign: "center" as const }}>
                  <FlaskConical size={28} color="rgba(26,19,19,0.15)" />
                  <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: "rgba(26,19,19,0.35)", marginTop: 10 }}>No formulas recorded</div>
                </div>
              )}
            </div>
          ) : activeDetailTab === "notes" ? (
            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "40px 20px", textAlign: "center" as const }}>
              <MessageSquare size={28} color="rgba(26,19,19,0.15)" />
              <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: "rgba(26,19,19,0.35)", marginTop: 10 }}>No notes yet</div>
            </div>
          ) : null}
        </div>

        {/* Panel Footer */}
        <div style={{ padding: "12px 22px 16px", borderTop: "1px solid rgba(26,19,19,0.06)", display: "flex", gap: 8, flexShrink: 0 }}>
          <button style={{
            flex: 1, height: 40, borderRadius: 9, background: "#1A1313", border: "none", color: "#fff",
            fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><CalendarPlus size={14} />Book Appointment</button>
          <button style={{
            height: 40, padding: "0 16px", borderRadius: 9, background: "rgba(26,19,19,0.04)",
            border: "1px solid rgba(26,19,19,0.1)", color: "#1A1313",
            fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><Star size={14} />Request Review</button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } input::placeholder { color: rgba(26,19,19,0.3); }`}</style>
    </div>
  )
}
