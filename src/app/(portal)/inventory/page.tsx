"use client"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useUserRole } from "@/hooks/useUserRole"

type Loc = { id: string; name: string; address: string; phone: string }
type Item = {
  id: string
  brand: string
  productName: string
  category: string
  shadeOrVolume: string | null
  unitType: string | null
  quantityOnHand: number
  reorderThreshold: number
  reorderQty: number
  costPerUnit: number | null
  ouncesPerUnit: number | null
  ouncesPerService: number | null
  ouncesOnHand: number | null
  supplier: string | null
  sku: string | null
  expirationDate: string | null
  lastRestocked: string | null
  notes: string | null
  isLowStock: boolean
  location: Loc
  locationId: string
}

const CATEGORIES = ["All", "toner", "bleach", "color", "developer", "processing_solution", "shampoo", "conditioner", "styling", "tools", "supplies", "other"] as const

const CATEGORY_COLORS: Record<string, string> = {
  toner: "#CDC9C0",
  bleach: "#F59E0B",
  color: "#10B981",
  developer: "#3B82F6",
  processing_solution: "#8B5CF6",
}

function getCatColor(cat: string): string {
  return CATEGORY_COLORS[cat.toLowerCase()] || "#94A3B8"
}

function getStatus(qty: number, threshold: number): { label: string; color: string; key: string } {
  if (qty <= 0) return { label: "Out", color: "#EF4444", key: "out" }
  if (qty <= threshold) return { label: "Low", color: "#F59E0B", key: "low" }
  return { label: "OK", color: "#10B981", key: "ok" }
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", boxSizing: "border-box",
  backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px", color: "#FFFFFF", fontSize: "13px", outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "rgba(205,201,192,0.6)",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", display: "block",
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 20px", borderRadius: "8px", border: "none", cursor: "pointer",
  backgroundColor: "#CDC9C0", color: "#0f1d24", fontSize: "13px", fontWeight: 700,
}

const btnSecondary: React.CSSProperties = {
  padding: "10px 20px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.2)",
  cursor: "pointer", backgroundColor: "transparent", color: "#CDC9C0", fontSize: "13px", fontWeight: 600,
}

type ViewMode = "grid" | "table" | "brand"

const emptyForm = {
  brand: "", productName: "", category: "color", shadeOrVolume: "", unitType: "tube",
  quantityOnHand: 0, reorderThreshold: 2, reorderQty: 6, costPerUnit: "",
  ouncesPerUnit: "", ouncesPerService: "", ouncesOnHand: "", supplier: "", sku: "",
  notes: "", locationId: "",
}

export default function InventoryPage() {
  const { role, locationId: userLocationId, isOwner, isManager } = useUserRole()
  const canEdit = isOwner || isManager

  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<Loc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("All")
  const [brandFilter, setBrandFilter] = useState<string>("All")
  const [locationFilter, setLocationFilter] = useState<string>("All")
  const [lowOnly, setLowOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [updating, setUpdating] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [showReorder, setShowReorder] = useState(false)
  const [collapsedBrands, setCollapsedBrands] = useState<Set<string>>(new Set())
  const catRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, locRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/locations"),
      ])
      const invData = await invRes.json()
      const locData = await locRes.json()
      setItems(invData.items ?? [])
      setLocations(locData.locations ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const brands = useMemo(() => {
    const set = new Set(items.map(i => i.brand))
    return ["All", ...Array.from(set).sort()]
  }, [items])

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (category !== "All" && it.category.toLowerCase() !== category.toLowerCase()) return false
      if (brandFilter !== "All" && it.brand !== brandFilter) return false
      if (locationFilter !== "All" && it.location.id !== locationFilter) return false
      if (lowOnly && !it.isLowStock && it.quantityOnHand > 0) return false
      if (search.trim()) {
        const s = search.trim().toLowerCase()
        const hay = `${it.brand} ${it.productName} ${it.category} ${it.shadeOrVolume || ""} ${it.sku || ""}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [items, category, brandFilter, locationFilter, lowOnly, search])

  const stats = useMemo(() => {
    const total = filtered.length
    const outOfStock = filtered.filter(i => i.quantityOnHand <= 0).length
    const low = filtered.filter(i => i.quantityOnHand > 0 && i.isLowStock).length
    const inStock = total - outOfStock - low
    const estValue = filtered.reduce((sum, i) => sum + (i.costPerUnit ?? 0) * i.quantityOnHand, 0)
    return { total, inStock, low, outOfStock, estValue }
  }, [filtered])

  const reorderItems = useMemo(() => {
    return items.filter(i => i.isLowStock || i.quantityOnHand <= 0)
  }, [items])

  const brandGroups = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const item of filtered) {
      const list = map.get(item.brand) || []
      list.push(item)
      map.set(item.brand, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const adjustQty = async (item: Item, delta: number) => {
    const newQty = Math.max(0, item.quantityOnHand + delta)
    setUpdating(item.id)
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantityOnHand: newQty }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...data.item } : i))
      }
    } catch { /* ignore */ }
    setUpdating(null)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...emptyForm, locationId: userLocationId || (locations[0]?.id ?? "") })
    setShowModal(true)
  }

  const openEdit = (item: Item) => {
    setEditingId(item.id)
    setForm({
      brand: item.brand,
      productName: item.productName,
      category: item.category,
      shadeOrVolume: item.shadeOrVolume || "",
      unitType: item.unitType || "tube",
      quantityOnHand: item.quantityOnHand,
      reorderThreshold: item.reorderThreshold,
      reorderQty: item.reorderQty ?? 6,
      costPerUnit: item.costPerUnit != null ? String(item.costPerUnit) : "",
      ouncesPerUnit: item.ouncesPerUnit != null ? String(item.ouncesPerUnit) : "",
      ouncesPerService: item.ouncesPerService != null ? String(item.ouncesPerService) : "",
      ouncesOnHand: item.ouncesOnHand != null ? String(item.ouncesOnHand) : "",
      supplier: item.supplier || "",
      sku: item.sku || "",
      notes: item.notes || "",
      locationId: item.locationId || item.location.id,
    })
    setShowModal(true)
  }

  const saveItem = async () => {
    const body: Record<string, unknown> = {
      brand: form.brand,
      productName: form.productName,
      category: form.category,
      shadeOrVolume: form.shadeOrVolume || null,
      unitType: form.unitType || null,
      quantityOnHand: Number(form.quantityOnHand) || 0,
      reorderThreshold: Number(form.reorderThreshold) || 2,
      reorderQty: Number(form.reorderQty) || 6,
      costPerUnit: form.costPerUnit ? Number(form.costPerUnit) : null,
      ouncesPerUnit: form.ouncesPerUnit ? Number(form.ouncesPerUnit) : null,
      ouncesPerService: form.ouncesPerService ? Number(form.ouncesPerService) : null,
      ouncesOnHand: form.ouncesOnHand ? Number(form.ouncesOnHand) : null,
      supplier: form.supplier || null,
      sku: form.sku || null,
      notes: form.notes || null,
      locationId: form.locationId,
    }
    try {
      const url = editingId ? `/api/inventory/${editingId}` : "/api/inventory"
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (res.ok) {
        setShowModal(false)
        void load()
      }
    } catch { /* ignore */ }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return
    try {
      await fetch(`/api/inventory/${id}`, { method: "DELETE" })
      setItems(prev => prev.filter(i => i.id !== id))
    } catch { /* ignore */ }
  }

  const copyReorderList = () => {
    const lines = reorderItems.map(i =>
      `${i.brand} - ${i.productName}${i.shadeOrVolume ? ` (${i.shadeOrVolume})` : ""} | Qty: ${i.quantityOnHand} | Need: ${i.reorderQty} | ${i.supplier || "No supplier"}`
    )
    navigator.clipboard.writeText(lines.join("\n"))
  }

  const servicesLeft = (item: Item) => {
    if (!item.ouncesOnHand || !item.ouncesPerService || item.ouncesPerService <= 0) return null
    return Math.floor(item.ouncesOnHand / item.ouncesPerService)
  }

  const pill = (active: boolean, color?: string) => ({
    padding: "6px 14px", fontSize: "10px", fontWeight: 700 as const,
    letterSpacing: "0.08em", textTransform: "uppercase" as const,
    borderRadius: "20px", border: "none", cursor: "pointer" as const,
    backgroundColor: active ? (color || "#CDC9C0") : "rgba(205,201,192,0.06)",
    color: active ? "#0f1d24" : "rgba(205,201,192,0.5)", transition: "all 0.15s",
    whiteSpace: "nowrap" as const, flexShrink: 0,
  })

  const viewBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer", backgroundColor: active ? "rgba(255,255,255,0.08)" : "transparent",
    color: active ? "#CDC9C0" : "rgba(205,201,192,0.4)", fontSize: "11px", fontWeight: 600,
    display: "flex", alignItems: "center", gap: "4px",
  })

  const qtyBtn = (color: string, disabled: boolean): React.CSSProperties => ({
    width: "28px", height: "28px", borderRadius: "6px",
    backgroundColor: `${color}15`, border: `1px solid ${color}30`,
    color, fontSize: "14px", fontWeight: 700, cursor: disabled ? "default" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    opacity: disabled ? 0.4 : 1,
  })

  // Stat card
  const statCard = (label: string, value: string | number, color: string) => (
    <div key={label} style={{
      backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px",
      padding: "14px 16px", flex: "1 1 0", minWidth: "100px",
    }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "rgba(205,201,192,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 800, color }}>{value}</div>
    </div>
  )

  // ---- RENDER GRID CARD ----
  const renderCard = (item: Item) => {
    const st = getStatus(item.quantityOnHand, item.reorderThreshold)
    const pct = item.reorderThreshold > 0
      ? Math.min(100, (item.quantityOnHand / (item.reorderThreshold * 3)) * 100)
      : item.quantityOnHand > 0 ? 100 : 0
    const sLeft = servicesLeft(item)
    return (
      <div key={item.id} style={{
        backgroundColor: "#0d1117",
        border: `1px solid ${st.key === "out" ? "rgba(239,68,68,0.25)" : st.key === "low" ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "12px", padding: "16px 20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
              <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: `${getCatColor(item.category)}20`, color: getCatColor(item.category), textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {item.category.replace("_", " ")}
              </span>
              <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: `${st.color}15`, color: st.color, letterSpacing: "0.05em" }}>
                {st.label}
              </span>
            </div>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(205,201,192,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "2px" }}>{item.brand}</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginBottom: "2px" }}>{item.productName}</div>
            {item.shadeOrVolume && <div style={{ fontSize: "11px", color: "#94A3B8" }}>{item.shadeOrVolume}</div>}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "10px" }}>
          <div style={{ width: "100%", height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: "2px", backgroundColor: st.color, transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)" }}>Qty: {item.quantityOnHand}</span>
            <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.3)" }}>Reorder: {item.reorderThreshold}</span>
          </div>
        </div>

        {/* Oz / cost / services row */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {item.ouncesOnHand != null && (
            <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.5)" }}>Oz: {item.ouncesOnHand}</span>
          )}
          {item.costPerUnit != null && (
            <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.5)" }}>${item.costPerUnit.toFixed(2)}/unit</span>
          )}
          {sLeft != null && (
            <span style={{ fontSize: "10px", color: sLeft <= 3 ? "#F59E0B" : "rgba(205,201,192,0.5)" }}>~{sLeft} services left</span>
          )}
        </div>

        {/* +/- and action buttons */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button onClick={() => adjustQty(item, -1)} disabled={updating === item.id || item.quantityOnHand <= 0} style={qtyBtn("#EF4444", updating === item.id || item.quantityOnHand <= 0)}>-</button>
          <span style={{ fontSize: "15px", fontWeight: 800, color: "#FFFFFF", minWidth: "28px", textAlign: "center" }}>{item.quantityOnHand}</span>
          <button onClick={() => adjustQty(item, 1)} disabled={updating === item.id} style={qtyBtn("#10B981", updating === item.id)}>+</button>
          {canEdit && (
            <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              <button onClick={() => openEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(205,201,192,0.4)", fontSize: "16px", padding: "4px" }} title="Edit">
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
              </button>
              <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", fontSize: "16px", padding: "4px" }} title="Delete">
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- RENDER TABLE ----
  const renderTable = () => {
    const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)" }
    const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: "13px", color: "#FFFFFF", borderBottom: "1px solid rgba(205,201,192,0.06)" }
    return (
      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(205,201,192,0.1)", backgroundColor: "#0d1117" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Brand</th>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Shade</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Qty</th>
              <th style={thStyle}>Oz</th>
              <th style={thStyle}>Cost</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Location</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const st = getStatus(item.quantityOnHand, item.reorderThreshold)
              return (
                <tr key={item.id}>
                  <td style={tdStyle}><span style={{ fontSize: "11px", fontWeight: 600 }}>{item.brand}</span></td>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{item.productName}</span></td>
                  <td style={{ ...tdStyle, color: "#94A3B8", fontSize: "12px" }}>{item.shadeOrVolume || "—"}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: `${getCatColor(item.category)}20`, color: getCatColor(item.category), textTransform: "uppercase" }}>
                      {item.category.replace("_", " ")}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button onClick={() => adjustQty(item, -1)} disabled={updating === item.id || item.quantityOnHand <= 0} style={qtyBtn("#EF4444", updating === item.id || item.quantityOnHand <= 0)}>-</button>
                      <span style={{ fontWeight: 700, minWidth: "24px", textAlign: "center" }}>{item.quantityOnHand}</span>
                      <button onClick={() => adjustQty(item, 1)} disabled={updating === item.id} style={qtyBtn("#10B981", updating === item.id)}>+</button>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: "12px", color: "#94A3B8" }}>{item.ouncesOnHand ?? "—"}</td>
                  <td style={{ ...tdStyle, fontSize: "12px", color: "#94A3B8" }}>{item.costPerUnit != null ? `$${item.costPerUnit.toFixed(2)}` : "—"}</td>
                  <td style={{ ...tdStyle, fontSize: "12px", color: "#94A3B8" }}>{item.supplier || "—"}</td>
                  <td style={{ ...tdStyle, fontSize: "11px", color: "rgba(205,201,192,0.4)" }}>{item.location.name}</td>
                  <td style={tdStyle}>
                    {canEdit && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => openEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(205,201,192,0.4)", padding: "2px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                        </button>
                        <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", padding: "2px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ---- RENDER BRAND VIEW ----
  const renderBrandView = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {brandGroups.map(([brand, groupItems]) => {
          const collapsed = collapsedBrands.has(brand)
          return (
            <div key={brand} style={{ backgroundColor: "#0d1117", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "12px", overflow: "hidden" }}>
              <button
                onClick={() => {
                  setCollapsedBrands(prev => {
                    const next = new Set(prev)
                    if (next.has(brand)) next.delete(brand)
                    else next.add(brand)
                    return next
                  })
                }}
                style={{
                  width: "100%", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "none", border: "none", borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer", color: "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px", fontWeight: 800 }}>{brand}</span>
                  <span style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)", fontWeight: 600 }}>{groupItems.length} items</span>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "rgba(205,201,192,0.4)", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>expand_more</span>
              </button>
              {!collapsed && (
                <div>
                  {groupItems.map(item => {
                    const st = getStatus(item.quantityOnHand, item.reorderThreshold)
                    return (
                      <div key={item.id} style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid rgba(205,201,192,0.04)", flexWrap: "wrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: `${getCatColor(item.category)}20`, color: getCatColor(item.category), textTransform: "uppercase" }}>
                          {item.category.replace("_", " ")}
                        </span>
                        <div style={{ flex: 1, minWidth: "120px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>{item.productName}</span>
                          {item.shadeOrVolume && <span style={{ fontSize: "11px", color: "#94A3B8", marginLeft: "6px" }}>{item.shadeOrVolume}</span>}
                        </div>
                        <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <button onClick={() => adjustQty(item, -1)} disabled={updating === item.id || item.quantityOnHand <= 0} style={qtyBtn("#EF4444", updating === item.id || item.quantityOnHand <= 0)}>-</button>
                          <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF", minWidth: "24px", textAlign: "center" }}>{item.quantityOnHand}</span>
                          <button onClick={() => adjustQty(item, 1)} disabled={updating === item.id} style={qtyBtn("#10B981", updating === item.id)}>+</button>
                        </div>
                        {canEdit && (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button onClick={() => openEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(205,201,192,0.4)", padding: "2px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
                            </button>
                            <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", padding: "2px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ---- MODAL ----
  const renderModal = () => {
    if (!showModal) return null
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={() => setShowModal(false)}>
        <div style={{ backgroundColor: "#0f1d24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "540px", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 20px" }}>{editingId ? "Edit Item" : "Add Item"}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {/* Brand */}
            <div>
              <label style={labelStyle}>Brand</label>
              <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} style={inputStyle} placeholder="e.g. Redken" />
            </div>
            {/* Category */}
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </div>
            {/* Product Name */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Product Name</label>
              <input value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} style={inputStyle} placeholder="e.g. Shades EQ Gloss" />
            </div>
            {/* Shade */}
            <div>
              <label style={labelStyle}>Shade / Volume</label>
              <input value={form.shadeOrVolume} onChange={e => setForm({ ...form, shadeOrVolume: e.target.value })} style={inputStyle} placeholder="e.g. 09V" />
            </div>
            {/* SKU */}
            <div>
              <label style={labelStyle}>SKU</label>
              <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={inputStyle} placeholder="Optional" />
            </div>
            {/* Qty */}
            <div>
              <label style={labelStyle}>Quantity</label>
              <input type="number" value={form.quantityOnHand} onChange={e => setForm({ ...form, quantityOnHand: Number(e.target.value) })} style={inputStyle} min={0} />
            </div>
            {/* Unit Type */}
            <div>
              <label style={labelStyle}>Unit Type</label>
              <select value={form.unitType} onChange={e => setForm({ ...form, unitType: e.target.value })} style={inputStyle}>
                <option value="tube">Tube</option>
                <option value="bottle">Bottle</option>
                <option value="packet">Packet</option>
                <option value="tub">Tub</option>
                <option value="can">Can</option>
                <option value="box">Box</option>
                <option value="each">Each</option>
              </select>
            </div>
            {/* Oz per unit */}
            <div>
              <label style={labelStyle}>Oz per Unit</label>
              <input type="number" value={form.ouncesPerUnit} onChange={e => setForm({ ...form, ouncesPerUnit: e.target.value })} style={inputStyle} step="0.1" placeholder="e.g. 2.0" />
            </div>
            {/* Oz per service */}
            <div>
              <label style={labelStyle}>Oz per Service</label>
              <input type="number" value={form.ouncesPerService} onChange={e => setForm({ ...form, ouncesPerService: e.target.value })} style={inputStyle} step="0.1" placeholder="e.g. 1.5" />
            </div>
            {/* Oz on hand */}
            <div>
              <label style={labelStyle}>Oz on Hand</label>
              <input type="number" value={form.ouncesOnHand} onChange={e => setForm({ ...form, ouncesOnHand: e.target.value })} style={inputStyle} step="0.1" placeholder="Total oz" />
            </div>
            {/* Cost */}
            <div>
              <label style={labelStyle}>Cost per Unit ($)</label>
              <input type="number" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} style={inputStyle} step="0.01" placeholder="e.g. 12.50" />
            </div>
            {/* Reorder Threshold */}
            <div>
              <label style={labelStyle}>Reorder Threshold</label>
              <input type="number" value={form.reorderThreshold} onChange={e => setForm({ ...form, reorderThreshold: Number(e.target.value) })} style={inputStyle} min={0} />
            </div>
            {/* Reorder Qty */}
            <div>
              <label style={labelStyle}>Reorder Qty</label>
              <input type="number" value={form.reorderQty} onChange={e => setForm({ ...form, reorderQty: Number(e.target.value) })} style={inputStyle} min={1} />
            </div>
            {/* Supplier */}
            <div>
              <label style={labelStyle}>Supplier</label>
              <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={inputStyle} placeholder="e.g. SalonCentric" />
            </div>
            {/* Location */}
            <div>
              <label style={labelStyle}>Location</label>
              <select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })} style={inputStyle}>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            {/* Notes */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} placeholder="Optional notes..." />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
            <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            <button onClick={saveItem} style={btnPrimary} disabled={!form.brand || !form.productName || !form.locationId}>
              {editingId ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- REORDER MODAL ----
  const renderReorderModal = () => {
    if (!showReorder) return null
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={() => setShowReorder(false)}>
        <div style={{ backgroundColor: "#0f1d24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "540px", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Reorder List ({reorderItems.length})</h2>
            <button onClick={copyReorderList} style={btnPrimary}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>content_copy</span> Copy
              </span>
            </button>
          </div>
          {reorderItems.length === 0 ? (
            <p style={{ color: "#94A3B8", fontSize: "13px" }}>All items are well stocked!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {reorderItems.map(item => {
                const st = getStatus(item.quantityOnHand, item.reorderThreshold)
                return (
                  <div key={item.id} style={{ padding: "10px 14px", backgroundColor: "#0d1117", borderRadius: "8px", border: `1px solid ${st.color}20` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#FFFFFF" }}>{item.brand} - {item.productName}</span>
                        {item.shadeOrVolume && <span style={{ fontSize: "11px", color: "#94A3B8", marginLeft: "6px" }}>{item.shadeOrVolume}</span>}
                      </div>
                      <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "9px", fontWeight: 700, backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "11px", color: "rgba(205,201,192,0.5)" }}>
                      <span>On hand: {item.quantityOnHand}</span>
                      <span>Need: {item.reorderQty}</span>
                      <span>{item.supplier || "No supplier"}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
            <button onClick={() => setShowReorder(false)} style={btnSecondary}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />

      {/* Header */}
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Inventory</h1>
          <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>Track and manage product stock levels</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {canEdit && (
            <>
              <button onClick={() => setShowReorder(true)} style={btnSecondary}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>list_alt</span> Reorder List
                  {reorderItems.length > 0 && <span style={{ backgroundColor: "#F59E0B", color: "#0f1d24", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", fontWeight: 700 }}>{reorderItems.length}</span>}
                </span>
              </button>
              <button onClick={openAdd} style={btnPrimary}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span> Add Item
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        {statCard("Total Items", stats.total, "#FFFFFF")}
        {statCard("In Stock", stats.inStock, "#10B981")}
        {statCard("Low Stock", stats.low, "#F59E0B")}
        {statCard("Out of Stock", stats.outOfStock, "#EF4444")}
        {statCard("Est. Value", `$${stats.estValue.toFixed(0)}`, "#CDC9C0")}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "12px" }}>
        <span className="material-symbols-outlined" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "rgba(205,201,192,0.3)" }}>search</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search brand, product, shade, SKU..."
          style={{ width: "100%", padding: "10px 14px 10px 38px", boxSizing: "border-box", backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", color: "#FFFFFF", fontSize: "13px", outline: "none" }}
        />
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
        {/* Brand filter */}
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: "120px", padding: "6px 10px", fontSize: "11px", borderRadius: "8px" }}>
          {brands.map(b => <option key={b} value={b}>{b === "All" ? "All Brands" : b}</option>)}
        </select>

        {/* Location filter (owner only) */}
        {isOwner && locations.length > 1 && (
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: "130px", padding: "6px 10px", fontSize: "11px", borderRadius: "8px" }}>
            <option value="All">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          <button onClick={() => setViewMode("grid")} style={viewBtn(viewMode === "grid")}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>grid_view</span> Grid
          </button>
          <button onClick={() => setViewMode("table")} style={viewBtn(viewMode === "table")}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>table_rows</span> Table
          </button>
          <button onClick={() => setViewMode("brand")} style={viewBtn(viewMode === "brand")}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>workspaces</span> Brand
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div ref={catRef} style={{ display: "flex", gap: "6px", flexWrap: "nowrap", overflowX: "auto", marginBottom: "16px", paddingBottom: "4px" }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)} style={pill(category === c, c !== "All" ? getCatColor(c) : undefined)}>
            {c.replace("_", " ")}
          </button>
        ))}
        <button onClick={() => setLowOnly(!lowOnly)} style={{ ...pill(lowOnly, "#F59E0B"), backgroundColor: lowOnly ? "#F59E0B" : "rgba(205,201,192,0.06)", color: lowOnly ? "#0f1d24" : "rgba(245,158,11,0.6)" }}>
          Low Stock
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: "#94A3B8", textAlign: "center", padding: "40px 0" }}>Loading inventory...</p>
      ) : filtered.length === 0 ? (
        <div style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "48px 24px", textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)", display: "block", marginBottom: "16px" }}>inventory_2</span>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>No items found</p>
          <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>Try adjusting your search or filters.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
          {filtered.map(renderCard)}
        </div>
      ) : viewMode === "table" ? (
        renderTable()
      ) : (
        renderBrandView()
      )}

      {renderModal()}
      {renderReorderModal()}
    </div>
  )
}
