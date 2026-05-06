"use client"
import { useState, useRef, useEffect } from "react"
import { Search, X, Check } from "lucide-react"

const ACC = "#7a8f96"

interface PickedClient {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
}

interface SearchResult extends PickedClient {
  lastVisitAt: string | null
  smsLastEngagedAt: string | null
}

interface Props {
  selectedClients: PickedClient[]
  onChange: (clients: PickedClient[]) => void
  maxSelections?: number
}

function initials(c: PickedClient) {
  return ((c.firstName?.[0] || "") + (c.lastName?.[0] || "")).toUpperCase() || "?"
}

function shortName(c: PickedClient) {
  return `${c.firstName || ""} ${c.lastName?.[0] ? c.lastName[0] + "." : ""}`.trim() || "Unknown"
}

function daysAgo(d: string | null): string | null {
  if (!d) return null
  const ms = Date.now() - new Date(d).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function ClientSearchPicker({ selectedClients, onChange, maxSelections = 100 }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function search(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/marketing/clients/search?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        setResults(d.clients || [])
        setShowDropdown(true)
      } catch { setResults([]) }
      setLoading(false)
    }, 300)
  }

  function toggle(client: SearchResult) {
    const exists = selectedClients.some(c => c.id === client.id)
    if (exists) {
      onChange(selectedClients.filter(c => c.id !== client.id))
    } else if (selectedClients.length < maxSelections) {
      onChange([...selectedClients, { id: client.id, firstName: client.firstName, lastName: client.lastName, phone: client.phone, email: client.email }])
    }
    setQuery("")
    setResults([])
    setShowDropdown(false)
  }

  const selectedIds = new Set(selectedClients.map(c => c.id))
  const displayClients = expanded ? selectedClients : selectedClients.slice(0, 5)
  const atCap = selectedClients.length >= maxSelections

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Selected chips */}
      {selectedClients.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {displayClients.map(c => (
            <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 4px", borderRadius: 16, backgroundColor: "rgba(122,143,150,0.1)", border: "1px solid rgba(122,143,150,0.2)", fontSize: 11, fontWeight: 500, color: "#1A1313" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: ACC, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(c)}</span>
              {shortName(c)}
              <button onClick={() => onChange(selectedClients.filter(x => x.id !== c.id))} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(26,19,19,0.3)", display: "flex" }}><X size={10} /></button>
            </span>
          ))}
          {selectedClients.length > 5 && !expanded && (
            <button onClick={() => setExpanded(true)} style={{ fontSize: 11, color: ACC, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>+{selectedClients.length - 5} more</button>
          )}
          {expanded && selectedClients.length > 5 && (
            <button onClick={() => setExpanded(false)} style={{ fontSize: 11, color: ACC, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Show less</button>
          )}
        </div>
      )}

      {/* Search input */}
      <div style={{ position: "relative" }}>
        <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(26,19,19,0.3)" }} />
        <input
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
          placeholder="Search by name, phone, or email..."
          disabled={atCap}
          style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 13, color: "#1A1313", backgroundColor: "#FBFBFB", boxSizing: "border-box", outline: "none", opacity: atCap ? 0.5 : 1 }}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 50, maxHeight: 280, overflowY: "auto" }}>
          {loading && <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "rgba(26,19,19,0.4)" }}>Searching...</div>}
          {!loading && results.length === 0 && query.length >= 2 && <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "rgba(26,19,19,0.4)" }}>No matches found</div>}
          {results.map(c => {
            const selected = selectedIds.has(c.id)
            const engaged = daysAgo(c.smsLastEngagedAt)
            return (
              <div key={c.id} onClick={() => toggle(c)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid rgba(26,19,19,0.04)", backgroundColor: selected ? "rgba(122,143,150,0.06)" : "transparent" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: `${ACC}20`, color: ACC, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(c)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>{c.firstName} {c.lastName}</div>
                  <div style={{ fontSize: 11, color: "rgba(26,19,19,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.phone} {c.email ? `· ${c.email}` : ""}</div>
                </div>
                {engaged && <span style={{ fontSize: 10, color: "rgba(26,19,19,0.35)", whiteSpace: "nowrap" }}>{engaged}</span>}
                {selected && <Check size={14} color={ACC} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 6, fontSize: 11, color: "rgba(26,19,19,0.4)" }}>
        {atCap ? `Max ${maxSelections} reached. Use other audience types for larger sends.` : `${selectedClients.length} client${selectedClients.length !== 1 ? "s" : ""} selected`}
      </div>
    </div>
  )
}
