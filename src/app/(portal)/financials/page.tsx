"use client"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"
import { EXPENSE_CATEGORIES, BUSINESS_MODELS, TEXAS_SALES_TAX_RATE } from "@/lib/financial-constants"

const ACC = "#606E74", ACC_B = "#7a8f96", ACC_DIM = "rgba(96,110,116,0.08)", ACC_BDR = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.06)", S1 = "rgba(255,255,255,0.03)", S2 = "rgba(255,255,255,0.05)"
const CARD_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)"
const MUTED = "rgba(255,255,255,0.3)", MID = "rgba(255,255,255,0.6)", GREEN = "#10B981", AMBER = "#ffb347", BLUE = "#4da6ff", RED = "#ff6b6b"
const mono: React.CSSProperties = { fontFamily: "'Fira Code', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

const fmtCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

type Tab = "overview" | "expenses" | "invoices" | "tax" | "settings"

export default function FinancialsPage() {
  const { isOwner, isManager } = useUserRole()
  const [tab, setTab] = useState<Tab>("overview")
  const [isMobile, setIsMobile] = useState(false)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationId, setLocationId] = useState("")

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      if (d.locations) {
        setLocations(d.locations)
        if (d.locations.length > 0 && !locationId) setLocationId(d.locations[0].id)
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOwner && !isManager) {
    return <div style={{ padding: "40px", textAlign: "center", color: MID, ...jakarta }}>Access restricted to owners and managers.</div>
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "dashboard" },
    { key: "expenses", label: "Expenses", icon: "receipt_long" },
    { key: "invoices", label: "Invoices", icon: "description" },
    { key: "tax", label: "Tax Center", icon: "calculate" },
    { key: "settings", label: "Settings", icon: "tune" },
  ]

  return (
    <div style={{ padding: isMobile ? "16px" : "24px 32px", maxWidth: "1200px", margin: "0 auto", ...jakarta }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>Financials</h1>
        <p style={{ color: MUTED, fontSize: "12px", marginTop: "4px" }}>Expense tracking, invoicing, and tax estimates</p>
      </div>

      {/* Location selector */}
      {locations.length > 1 && (
        <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
          {locations.map(loc => (
            <button key={loc.id} onClick={() => setLocationId(loc.id)} style={{
              padding: "6px 16px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", cursor: "pointer", border: "1px solid",
              backgroundColor: locationId === loc.id ? ACC_DIM : "transparent",
              borderColor: locationId === loc.id ? ACC_BDR : BORDER,
              color: locationId === loc.id ? ACC_B : MUTED,
              transition: "all 0.15s ease",
            }}>{loc.name}</button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", overflowX: "auto", paddingBottom: "2px" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: isMobile ? "8px 12px" : "8px 16px",
            borderRadius: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
            backgroundColor: tab === t.key ? ACC_DIM : "transparent",
            borderColor: tab === t.key ? ACC_BDR : "transparent",
            color: tab === t.key ? "#fff" : MUTED,
            transition: "all 0.15s ease",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{t.icon}</span>
            {!isMobile && t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab locationId={locationId} isMobile={isMobile} />}
      {tab === "expenses" && <ExpensesTab locationId={locationId} isMobile={isMobile} />}
      {tab === "invoices" && <InvoicesTab locationId={locationId} isMobile={isMobile} />}
      {tab === "tax" && <TaxCenterTab locationId={locationId} isMobile={isMobile} />}
      {tab === "settings" && <SettingsTab locationId={locationId} />}
    </div>
  )
}

/* ═══════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════ */
function OverviewTab({ locationId, isMobile }: { locationId: string; isMobile: boolean }) {
  const [summary, setSummary] = useState<AnyObj>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month")

  const fetchSummary = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    const now = new Date()
    let startDate: string, endDate: string
    if (period === "month") {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
      endDate = now.toISOString().slice(0, 10)
    } else if (period === "quarter") {
      const q = Math.floor(now.getMonth() / 3)
      startDate = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`
      endDate = now.toISOString().slice(0, 10)
    } else {
      startDate = `${now.getFullYear()}-01-01`
      endDate = now.toISOString().slice(0, 10)
    }
    try {
      const r = await fetch(`/api/financials/summary?startDate=${startDate}&endDate=${endDate}&locationId=${locationId}`)
      if (r.ok) setSummary(await r.json())
    } catch { /* */ }
    setLoading(false)
  }, [locationId, period])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const kpis = summary ? [
    { label: "Revenue", value: fmtCurrency(summary.revenue || 0), icon: "trending_up", color: GREEN },
    { label: "Total Expenses", value: fmtCurrency(summary.totalExpenses || 0), icon: "receipt_long", color: RED },
    { label: "Net Income", value: fmtCurrency(summary.netIncome || 0), icon: "account_balance", color: summary.netIncome >= 0 ? GREEN : RED },
    { label: "Est. Quarterly Tax", value: fmtCurrency(summary.taxEstimates?.quarterlyPayment || 0), icon: "calculate", color: AMBER },
  ] : []

  return (
    <div>
      {/* Period pills */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
        {(["month", "quarter", "year"] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: "5px 14px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", cursor: "pointer", border: "1px solid",
            backgroundColor: period === p ? ACC_DIM : "transparent",
            borderColor: period === p ? ACC_BDR : BORDER,
            color: period === p ? ACC_B : MUTED,
          }}>
            {p === "month" ? "This Month" : p === "quarter" ? "This Quarter" : "This Year"}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      {loading ? (
        <div style={{ color: MUTED, fontSize: "13px", padding: "40px", textAlign: "center" }}>Loading financial summary...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {kpis.map(k => (
            <div key={k.label} style={{
              backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "16px",
              boxShadow: CARD_SHADOW,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: k.color }}>{k.icon}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{k.label}</span>
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", ...mono }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Expense breakdown */}
      {summary?.expensesByCategory && Object.keys(summary.expensesByCategory).length > 0 && (
        <div style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px", boxShadow: CARD_SHADOW }}>
          <h3 style={{ color: "#fff", fontSize: "13px", fontWeight: 700, margin: "0 0 16px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Expenses by Category</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Object.entries(summary.expensesByCategory as Record<string, number>)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => {
                const pct = summary.totalExpenses > 0 ? (amt / summary.totalExpenses) * 100 : 0
                return (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ flex: 1, fontSize: "12px", color: MID }}>{cat}</span>
                    <div style={{ width: "120px", height: "6px", backgroundColor: S2, borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: ACC_B, borderRadius: "3px" }} />
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff", minWidth: "80px", textAlign: "right", ...mono }}>{fmtCurrency(amt)}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════
   EXPENSES TAB
   ═══════════════════════════════════════ */
function ExpensesTab({ locationId, isMobile }: { locationId: string; isMobile: boolean }) {
  const [expenses, setExpenses] = useState<AnyObj[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<AnyObj>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<AnyObj>({ date: new Date().toISOString().slice(0, 10), vendor: "", description: "", amount: "", category: "", subcategory: "", paymentMethod: "card", isRecurring: false, taxDeductible: true, notes: "" })
  const [saving, setSaving] = useState(false)

  const fetchExpenses = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    const params = new URLSearchParams({ locationId, page: String(page), limit: "25" })
    if (search) params.set("search", search)
    if (catFilter) params.set("category", catFilter)
    try {
      const r = await fetch(`/api/financials/expenses?${params}`)
      if (r.ok) { const d = await r.json(); setExpenses(d.expenses || []); setPagination(d.pagination) }
    } catch { /* */ }
    setLoading(false)
  }, [locationId, page, search, catFilter])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  async function handleSave() {
    if (!form.vendor || !form.description || !form.amount || !form.category) return
    setSaving(true)
    try {
      const r = await fetch("/api/financials/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locationId, amount: parseFloat(form.amount) }),
      })
      if (r.ok) { setShowModal(false); setForm({ date: new Date().toISOString().slice(0, 10), vendor: "", description: "", amount: "", category: "", subcategory: "", paymentMethod: "card", isRecurring: false, taxDeductible: true, notes: "" }); fetchExpenses() }
    } catch { /* */ }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", backgroundColor: S2, border: `1px solid ${BORDER}`, borderRadius: "8px",
    color: "#fff", fontSize: "13px", outline: "none", boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: "4px" }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search vendor or description..." style={{ ...inputStyle, flex: 1, minWidth: "200px" }} />
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }} style={{ ...inputStyle, width: "auto", minWidth: "160px", cursor: "pointer" }}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowModal(true)} style={{
          padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", cursor: "pointer", border: "none", backgroundColor: ACC, color: "#fff",
        }}>
          + Add Expense
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: MUTED, fontSize: "13px", padding: "40px", textAlign: "center" }}>Loading expenses...</div>
      ) : expenses.length === 0 ? (
        <div style={{ color: MUTED, fontSize: "13px", padding: "40px", textAlign: "center" }}>No expenses found.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date", "Vendor", "Description", "Category", "Amount", "Method", "Deductible"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: AnyObj) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "10px", fontSize: "12px", color: MID, whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                  <td style={{ padding: "10px", fontSize: "12px", color: "#fff", fontWeight: 600 }}>{e.vendor}</td>
                  <td style={{ padding: "10px", fontSize: "12px", color: MID, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, backgroundColor: ACC_DIM, color: ACC_B }}>{e.category}</span>
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px", fontWeight: 600, color: RED, ...mono }}>{fmtCurrency(e.amount)}</td>
                  <td style={{ padding: "10px", fontSize: "11px", color: MUTED, textTransform: "capitalize" }}>{e.paymentMethod || "-"}</td>
                  <td style={{ padding: "10px", fontSize: "11px", color: e.taxDeductible ? GREEN : MUTED }}>{e.taxDeductible ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: page <= 1 ? "default" : "pointer", border: `1px solid ${BORDER}`, backgroundColor: "transparent", color: page <= 1 ? MUTED : MID, opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ padding: "6px 12px", fontSize: "11px", color: MUTED }}>{page} / {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: page >= pagination.totalPages ? "default" : "pointer", border: `1px solid ${BORDER}`, backgroundColor: "transparent", color: page >= pagination.totalPages ? MUTED : MID, opacity: page >= pagination.totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      {/* Add Expense Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#1a2a32", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "500px", maxHeight: "85vh", overflowY: "auto", border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
            <h2 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: "0 0 20px" }}>Add Expense</h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Category *</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Select...</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}>
                <label style={labelStyle}>Vendor *</label>
                <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Salon Centric" style={inputStyle} />
              </div>
              <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}>
                <label style={labelStyle}>Description *</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Amount *</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Subcategory</label>
                <input value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: MID, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.taxDeductible} onChange={e => setForm({ ...form, taxDeductible: e.target.checked })} /> Tax Deductible
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: MID, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.isRecurring} onChange={e => setForm({ ...form, isRecurring: e.target.checked })} /> Recurring
                </label>
              </div>
              <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: `1px solid ${BORDER}`, backgroundColor: "transparent", color: MUTED }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: saving ? "default" : "pointer", border: "none", backgroundColor: ACC, color: "#fff", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save Expense"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════
   INVOICES TAB
   ═══════════════════════════════════════ */
function InvoicesTab({ locationId, isMobile }: { locationId: string; isMobile: boolean }) {
  const [invoices, setInvoices] = useState<AnyObj[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<AnyObj>({ clientName: "", clientEmail: "", lineItems: [{ description: "", amount: "" }], dueDate: "", notes: "" })
  const [saving, setSaving] = useState(false)

  const fetchInvoices = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    const params = new URLSearchParams({ locationId })
    if (statusFilter) params.set("status", statusFilter)
    try {
      const r = await fetch(`/api/financials/invoices?${params}`)
      if (r.ok) { const d = await r.json(); setInvoices(d.invoices || []) }
    } catch { /* */ }
    setLoading(false)
  }, [locationId, statusFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  async function handleCreate() {
    if (!form.clientName || form.lineItems.length === 0) return
    const validItems = form.lineItems.filter((li: AnyObj) => li.description && li.amount)
    if (validItems.length === 0) return
    setSaving(true)
    try {
      const r = await fetch("/api/financials/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, clientName: form.clientName, clientEmail: form.clientEmail, lineItems: validItems.map((li: AnyObj) => ({ description: li.description, amount: parseFloat(li.amount), quantity: 1 })), dueDate: form.dueDate || null, notes: form.notes }),
      })
      if (r.ok) { setShowCreate(false); setForm({ clientName: "", clientEmail: "", lineItems: [{ description: "", amount: "" }], dueDate: "", notes: "" }); fetchInvoices() }
    } catch { /* */ }
    setSaving(false)
  }

  const statusColors: Record<string, string> = { draft: MUTED, sent: BLUE, paid: GREEN, overdue: RED, cancelled: "#666" }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", backgroundColor: S2, border: `1px solid ${BORDER}`, borderRadius: "8px",
    color: "#fff", fontSize: "13px", outline: "none", boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: "4px" }

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: "140px", cursor: "pointer" }}>
          <option value="">All Statuses</option>
          {["draft", "sent", "paid", "overdue", "cancelled"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCreate(true)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", border: "none", backgroundColor: ACC, color: "#fff" }}>
          + Create Invoice
        </button>
      </div>

      {loading ? (
        <div style={{ color: MUTED, fontSize: "13px", padding: "40px", textAlign: "center" }}>Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div style={{ color: MUTED, fontSize: "13px", padding: "40px", textAlign: "center" }}>No invoices found.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {invoices.map((inv: AnyObj) => (
            <div key={inv.id} style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "14px 16px", boxShadow: CARD_SHADOW, display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{inv.invoiceNumber}</span>
                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: `${statusColors[inv.status] || MUTED}22`, color: statusColors[inv.status] || MUTED }}>{inv.status}</span>
                </div>
                <div style={{ fontSize: "12px", color: MID }}>{inv.clientName}{inv.dueDate ? ` \u2022 Due ${fmtDate(inv.dueDate)}` : ""}</div>
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", ...mono }}>{fmtCurrency(inv.total)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#1a2a32", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "500px", maxHeight: "85vh", overflowY: "auto", border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
            <h2 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: "0 0 20px" }}>Create Invoice</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Client Name *</label>
                <input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Client Email</label>
                <input type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Line Items</label>
                {form.lineItems.map((li: AnyObj, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <input value={li.description} onChange={e => { const items = [...form.lineItems]; items[i] = { ...items[i], description: e.target.value }; setForm({ ...form, lineItems: items }) }} placeholder="Description" style={{ ...inputStyle, flex: 2 }} />
                    <input type="number" step="0.01" value={li.amount} onChange={e => { const items = [...form.lineItems]; items[i] = { ...items[i], amount: e.target.value }; setForm({ ...form, lineItems: items }) }} placeholder="Amount" style={{ ...inputStyle, flex: 1 }} />
                    {form.lineItems.length > 1 && (
                      <button onClick={() => { const items = form.lineItems.filter((_: AnyObj, j: number) => j !== i); setForm({ ...form, lineItems: items }) }} style={{ padding: "0 8px", borderRadius: "6px", border: `1px solid ${BORDER}`, backgroundColor: "transparent", color: RED, cursor: "pointer", fontSize: "16px" }}>x</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, lineItems: [...form.lineItems, { description: "", amount: "" }] })} style={{ fontSize: "11px", color: BLUE, backgroundColor: "transparent", border: "none", cursor: "pointer", padding: "4px 0" }}>+ Add Line Item</button>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: `1px solid ${BORDER}`, backgroundColor: "transparent", color: MUTED }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: saving ? "default" : "pointer", border: "none", backgroundColor: ACC, color: "#fff", opacity: saving ? 0.6 : 1 }}>{saving ? "Creating..." : "Create Invoice"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════
   TAX CENTER TAB
   ═══════════════════════════════════════ */
function TaxCenterTab({ locationId, isMobile }: { locationId: string; isMobile: boolean }) {
  const [taxData, setTaxData] = useState<AnyObj>(null)
  const [loading, setLoading] = useState(false)
  const [year] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState<number | null>(null)

  const fetchTax = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    const params = new URLSearchParams({ locationId, year: String(year) })
    if (quarter) params.set("quarter", String(quarter))
    try {
      const r = await fetch(`/api/financials/tax-summary?${params}`)
      if (r.ok) setTaxData(await r.json())
    } catch { /* */ }
    setLoading(false)
  }, [locationId, year, quarter])

  useEffect(() => { fetchTax() }, [fetchTax])

  return (
    <div>
      {/* Quarter pills */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={() => setQuarter(null)} style={{
          padding: "5px 14px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", cursor: "pointer", border: "1px solid",
          backgroundColor: !quarter ? ACC_DIM : "transparent", borderColor: !quarter ? ACC_BDR : BORDER, color: !quarter ? ACC_B : MUTED,
        }}>Full Year</button>
        {[1, 2, 3, 4].map(q => (
          <button key={q} onClick={() => setQuarter(q)} style={{
            padding: "5px 14px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", cursor: "pointer", border: "1px solid",
            backgroundColor: quarter === q ? ACC_DIM : "transparent", borderColor: quarter === q ? ACC_BDR : BORDER, color: quarter === q ? ACC_B : MUTED,
          }}>Q{q}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: MUTED, fontSize: "13px", padding: "40px", textAlign: "center" }}>Loading tax data...</div>
      ) : taxData ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Tax estimates */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
            {[
              { label: "Self-Employment Tax", value: fmtCurrency(taxData.taxEstimates?.selfEmploymentTax || 0), color: AMBER },
              { label: "Federal Income Tax", value: fmtCurrency(taxData.taxEstimates?.federalIncomeTax || 0), color: BLUE },
              { label: "Total Estimated Tax", value: fmtCurrency(taxData.taxEstimates?.totalEstimated || 0), color: RED },
              { label: "Quarterly Payment", value: fmtCurrency(taxData.taxEstimates?.quarterlyPayment || 0), color: GREEN },
            ].map(k => (
              <div key={k.label} style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "16px", boxShadow: CARD_SHADOW }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: "6px" }}>{k.label}</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: k.color, ...mono }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Income summary */}
          <div style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px", boxShadow: CARD_SHADOW }}>
            <h3 style={{ color: "#fff", fontSize: "13px", fontWeight: 700, margin: "0 0 12px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Income Summary</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: "Revenue", value: fmtCurrency(taxData.revenue || 0) },
                { label: "Total Expenses", value: fmtCurrency(taxData.totalExpenses || 0) },
                { label: "Deductible Expenses", value: fmtCurrency(taxData.deductibleExpenses || 0) },
                { label: "Net Income", value: fmtCurrency(taxData.netIncome || 0) },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: "12px", color: MID }}>{row.label}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff", ...mono }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* IRS Due Dates */}
          <div style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px", boxShadow: CARD_SHADOW }}>
            <h3 style={{ color: "#fff", fontSize: "13px", fontWeight: 700, margin: "0 0 12px", letterSpacing: "0.04em", textTransform: "uppercase" }}>IRS Quarterly Due Dates</h3>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: "8px" }}>
              {(taxData.irsDueDates || []).map((dd: AnyObj) => {
                const isPast = new Date(dd.dueDate) < new Date()
                return (
                  <div key={dd.quarter} style={{ padding: "12px", borderRadius: "8px", backgroundColor: S2, border: `1px solid ${BORDER}`, textAlign: "center" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: isPast ? MUTED : "#fff", marginBottom: "4px" }}>{dd.label}</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: isPast ? MUTED : AMBER, ...mono }}>{dd.dueDate}</div>
                    {isPast && <span style={{ fontSize: "9px", color: GREEN, fontWeight: 700, textTransform: "uppercase" }}>Passed</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ═══════════════════════════════════════
   SETTINGS TAB
   ═══════════════════════════════════════ */
function SettingsTab({ locationId }: { locationId: string }) {
  const [model, setModel] = useState<AnyObj>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ modelType: "commission", commissionRate: "0.40", salesTaxRate: String(TEXAS_SALES_TAX_RATE) })

  const fetchModel = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/financials/business-model?locationId=${locationId}`)
      if (r.ok) {
        const d = await r.json()
        if (d.model) {
          setModel(d.model)
          setForm({ modelType: d.model.modelType, commissionRate: String(d.model.commissionRate), salesTaxRate: String(d.model.salesTaxRate) })
        }
      }
    } catch { /* */ }
    setLoading(false)
  }, [locationId])

  useEffect(() => { fetchModel() }, [fetchModel])

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch("/api/financials/business-model", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, ...form }),
      })
      if (r.ok) { const d = await r.json(); setModel(d.model) }
    } catch { /* */ }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", backgroundColor: S2, border: `1px solid ${BORDER}`, borderRadius: "8px",
    color: "#fff", fontSize: "13px", outline: "none", boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: "4px" }

  if (loading) return <div style={{ color: MUTED, fontSize: "13px", padding: "40px", textAlign: "center" }}>Loading settings...</div>

  return (
    <div style={{ maxWidth: "500px" }}>
      <div style={{ backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px", boxShadow: CARD_SHADOW }}>
        <h3 style={{ color: "#fff", fontSize: "13px", fontWeight: 700, margin: "0 0 16px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Business Model</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Business Model</label>
            <select value={form.modelType} onChange={e => setForm({ ...form, modelType: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
              {BUSINESS_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>
              {BUSINESS_MODELS.find(m => m.value === form.modelType)?.description}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Commission Rate (%)</label>
            <input type="number" step="0.01" min="0" max="1" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} style={inputStyle} />
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>Enter as decimal (e.g. 0.40 = 40%)</div>
          </div>
          <div>
            <label style={labelStyle}>Sales Tax Rate</label>
            <input type="number" step="0.0001" min="0" max="1" value={form.salesTaxRate} onChange={e => setForm({ ...form, salesTaxRate: e.target.value })} style={inputStyle} />
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>Texas default: {(TEXAS_SALES_TAX_RATE * 100).toFixed(2)}%</div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "10px 20px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase", cursor: saving ? "default" : "pointer", border: "none",
            backgroundColor: ACC, color: "#fff", opacity: saving ? 0.6 : 1, alignSelf: "flex-start",
          }}>
            {saving ? "Saving..." : model ? "Update Settings" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  )
}
