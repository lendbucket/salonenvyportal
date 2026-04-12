"use client"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"

type POItem = {
  id: string; brand: string; productName: string; shadeOrVolume: string | null
  unitType: string | null; quantityOrdered: number; quantityReceived: number
  costPerUnit: number; totalCost: number; inventoryItemId: string | null
}
type PO = {
  id: string; poNumber: string; status: string; supplier: string
  totalAmount: number; notes: string | null; createdAt: string
  approvedAt: string | null; orderedAt: string | null; receivedAt: string | null
  items: POItem[]; location: { id: string; name: string }
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#94A3B8", pending: "#F59E0B", approved: "#3B82F6",
  ordered: "#8B5CF6", received: "#10B981", cancelled: "#EF4444",
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px", padding: "clamp(16px,4vw,28px)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)",
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "1px solid #606E74", cursor: "pointer",
  backgroundColor: "transparent", color: "#7a8f96", fontSize: "13px", fontWeight: 500,
  letterSpacing: "0.01em", transition: "all 0.15s ease",
}

const btnSecondary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)",
  cursor: "pointer", backgroundColor: "transparent", color: "#7a8f96", fontSize: "13px", fontWeight: 500,
  letterSpacing: "0.01em", transition: "all 0.15s ease",
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", boxSizing: "border-box",
  backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px", color: "#FFFFFF", fontSize: "14px", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "#606E74",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", display: "block",
}

export default function PurchaseOrdersPage() {
  const { isOwner, isManager } = useUserRole()
  const [orders, setOrders] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PO | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState("all")
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  // Create form state
  const [formLoc, setFormLoc] = useState("")
  const [formSupplier, setFormSupplier] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formItems, setFormItems] = useState([{ brand: "", productName: "", quantityOrdered: 1, costPerUnit: 0 }])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/purchase-orders")
    if (res.ok) { const d = await res.json(); setOrders(d.orders) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      if (d.locations) setLocations(d.locations)
    }).catch(() => {})
  }, [])

  const doAction = async (id: string, action: string) => {
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const d = await res.json()
      setOrders(prev => prev.map(o => o.id === id ? d.order : o))
      setSelected(d.order)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    setCreateError("")
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: formLoc, supplier: formSupplier, notes: formNotes, items: formItems }),
      })
      if (res.ok) {
        setShowCreate(false)
        setFormSupplier(""); setFormNotes(""); setFormItems([{ brand: "", productName: "", quantityOrdered: 1, costPerUnit: 0 }])
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setCreateError(d.error || "Failed to create purchase order")
      }
    } catch {
      setCreateError("Network error — please try again")
    } finally {
      setCreating(false)
    }
  }

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter)

  if (loading) return (
    <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 80, background: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: 10, animation: "pulse 2s infinite" }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ color: "#FFFFFF", fontSize: "22px", fontWeight: 700, margin: 0 }}>Purchase Orders</h1>
        {(isOwner || isManager) && (
          <button style={btnPrimary} onClick={() => setShowCreate(true)}>+ New PO</button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {["all", "draft", "pending", "approved", "ordered", "received", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: "6px 14px", borderRadius: "6px", border: "1px solid rgba(205,201,192,0.15)",
            backgroundColor: filter === s ? "rgba(205,201,192,0.12)" : "transparent",
            color: filter === s ? "#CDC9C0" : "rgba(205,201,192,0.5)", cursor: "pointer",
            fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{s} {s !== "all" && `(${orders.filter(o => s === "all" || o.status === s).length})`}</button>
        ))}
      </div>

      {/* Orders list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(po => (
          <div key={po.id} onClick={() => setSelected(po)} style={{
            ...cardStyle, cursor: "pointer",
            borderColor: selected?.id === po.id ? "#CDC9C0" : "rgba(205,201,192,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <span style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700 }}>{po.poNumber}</span>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px", marginLeft: "12px" }}>{po.supplier}</span>
                <span style={{ color: "rgba(205,201,192,0.4)", fontSize: "11px", marginLeft: "12px" }}>{po.location.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ color: "rgba(205,201,192,0.5)", fontSize: "12px" }}>${po.totalAmount.toFixed(2)}</span>
                <span style={{
                  padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  backgroundColor: `${STATUS_COLORS[po.status] || "#94A3B8"}20`,
                  color: STATUS_COLORS[po.status] || "#94A3B8",
                }}>{po.status}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", color: "rgba(205,201,192,0.4)" }}>No purchase orders found</div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}
          onClick={() => setSelected(null)}>
          <div style={{ ...cardStyle, maxWidth: "600px", width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: 700, margin: 0 }}>{selected.poNumber}</h2>
              <span style={{
                padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                textTransform: "uppercase", backgroundColor: `${STATUS_COLORS[selected.status]}20`,
                color: STATUS_COLORS[selected.status],
              }}>{selected.status}</span>
            </div>
            <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.6)", marginBottom: "16px" }}>
              <div>Supplier: <span style={{ color: "#CDC9C0" }}>{selected.supplier}</span></div>
              <div>Location: <span style={{ color: "#CDC9C0" }}>{selected.location.name}</span></div>
              <div>Total: <span style={{ color: "#CDC9C0" }}>${selected.totalAmount.toFixed(2)}</span></div>
              {selected.notes && <div style={{ marginTop: "8px" }}>Notes: {selected.notes}</div>}
            </div>

            {/* Items table */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(205,201,192,0.5)", textTransform: "uppercase", marginBottom: "8px" }}>Items</div>
              {selected.items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(205,201,192,0.08)", fontSize: "12px", color: "#e9e5dc" }}>
                  <span>{item.brand} - {item.productName}{item.shadeOrVolume ? ` (${item.shadeOrVolume})` : ""}</span>
                  <span style={{ color: "rgba(205,201,192,0.5)" }}>x{item.quantityOrdered} @ ${item.costPerUnit.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {selected.status === "draft" && <button style={btnPrimary} onClick={() => doAction(selected.id, "submit")}>Submit for Approval</button>}
              {selected.status === "pending" && isOwner && <button style={btnPrimary} onClick={() => doAction(selected.id, "approve")}>Approve</button>}
              {selected.status === "approved" && <button style={btnPrimary} onClick={() => doAction(selected.id, "ordered")}>Mark as Ordered</button>}
              {selected.status === "ordered" && <button style={btnPrimary} onClick={() => doAction(selected.id, "received")}>Mark as Received</button>}
              {selected.status !== "received" && selected.status !== "cancelled" && (
                <button style={{ ...btnSecondary, color: "#EF4444", borderColor: "rgba(239,68,68,0.3)" }} onClick={() => doAction(selected.id, "cancel")}>Cancel</button>
              )}
              <button style={btnSecondary} onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}
          onClick={() => setShowCreate(false)}>
          <div style={{ ...cardStyle, maxWidth: "600px", width: "100%", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: 700, margin: "0 0 16px" }}>New Purchase Order</h2>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Location</label>
              <select style={inputStyle} value={formLoc} onChange={e => setFormLoc(e.target.value)}>
                <option value="">Select location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Supplier</label>
              <input style={inputStyle} value={formSupplier} onChange={e => setFormSupplier(e.target.value)} placeholder="Supplier name" />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Items</label>
                <button style={{ ...btnSecondary, padding: "4px 10px", fontSize: "11px" }}
                  onClick={() => setFormItems([...formItems, { brand: "", productName: "", quantityOrdered: 1, costPerUnit: 0 }])}>+ Add Item</button>
              </div>
              {formItems.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px", gap: "8px", marginBottom: "8px" }}>
                  <input style={inputStyle} placeholder="Brand" value={item.brand} onChange={e => {
                    const n = [...formItems]; n[i] = { ...n[i], brand: e.target.value }; setFormItems(n)
                  }} />
                  <input style={inputStyle} placeholder="Product" value={item.productName} onChange={e => {
                    const n = [...formItems]; n[i] = { ...n[i], productName: e.target.value }; setFormItems(n)
                  }} />
                  <input style={inputStyle} type="number" placeholder="Qty" value={item.quantityOrdered} onChange={e => {
                    const n = [...formItems]; n[i] = { ...n[i], quantityOrdered: Number(e.target.value) }; setFormItems(n)
                  }} />
                  <input style={inputStyle} type="number" placeholder="Cost" value={item.costPerUnit || ""} onChange={e => {
                    const n = [...formItems]; n[i] = { ...n[i], costPerUnit: Number(e.target.value) }; setFormItems(n)
                  }} />
                </div>
              ))}
            </div>

            {createError && (
              <div style={{ color: "#ef4444", fontSize: "13px", fontFamily: "Plus Jakarta Sans, sans-serif", marginBottom: "12px" }}>{createError}</div>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowCreate(false)}>Cancel</button>
              <button style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }} onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create PO"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
