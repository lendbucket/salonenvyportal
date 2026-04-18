"use client"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"

const BG = "#06080d"
const CARD = "#0d1117"
const BORDER = "rgba(255,255,255,0.06)"
const CARD_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25)"
const ACC = "#606E74"
const ACC_B = "#7a8f96"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#22c55e"
const GOLD = "#C9A84C"
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" }
const mono: React.CSSProperties = { fontFamily: "'Fira Code', monospace" }

interface PermRow {
  key: string
  label: string
  description: string
  actions: { key: string; label: string }[]
}

interface PermSection {
  key: string
  label: string
  icon: string
  rows: PermRow[]
}

const SECTIONS: PermSection[] = [
  {
    key: "operations", label: "Salon Operations", icon: "calendar_month",
    rows: [
      { key: "appointments", label: "Appointments", description: "See, book, edit, and cancel client appointments", actions: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Cancel" }, { key: "export", label: "Export" }] },
      { key: "inventory", label: "Inventory", description: "Product inventory and purchase orders", actions: [{ key: "view", label: "View" }, { key: "create", label: "Add" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
      { key: "reviews", label: "Reviews", description: "Google reviews and reputation management", actions: [{ key: "view", label: "View" }, { key: "respond", label: "Respond" }] },
      { key: "alerts", label: "Alerts", description: "Admin alerts and notifications", actions: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "dismiss", label: "Dismiss" }] },
      { key: "dashboard", label: "Dashboard", description: "Main dashboard with KPIs and metrics", actions: [{ key: "view", label: "View" }] },
    ],
  },
  {
    key: "staff_hr", label: "Staff & HR", icon: "group",
    rows: [
      { key: "staff", label: "Staff Profiles", description: "Staff member profiles and HR actions", actions: [{ key: "view", label: "View" }, { key: "create", label: "Hire" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Terminate" }] },
      { key: "onboarding", label: "Onboarding", description: "Staff onboarding and enrollment management", actions: [{ key: "view", label: "View" }, { key: "create", label: "Invite" }, { key: "cancel", label: "Cancel" }] },
      { key: "conduct", label: "Conduct & Complaints", description: "Conduct records and complaint management", actions: [{ key: "view", label: "View" }, { key: "create", label: "Create" }] },
      { key: "complaints", label: "Anonymous Complaints", description: "View and manage anonymous complaints", actions: [{ key: "view", label: "View" }, { key: "create", label: "Submit" }] },
    ],
  },
  {
    key: "finance", label: "Finance", icon: "account_balance",
    rows: [
      { key: "payroll", label: "Payroll", description: "Payroll visibility and processing", actions: [{ key: "view", label: "View" }, { key: "export", label: "Export" }, { key: "approve", label: "Approve" }] },
      { key: "financials", label: "Financials & P/L", description: "Financial dashboard, P&L, expenses, invoices", actions: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "export", label: "Export" }] },
      { key: "performance", label: "Performance & Bonuses", description: "KPIs, goals, leaderboard, and bonus management", actions: [{ key: "view", label: "View" }, { key: "goals_create", label: "Goals" }, { key: "goals_edit", label: "Edit Goals" }, { key: "bonuses_approve", label: "Bonuses" }] },
    ],
  },
  {
    key: "analytics", label: "Analytics & Reporting", icon: "insights",
    rows: [
      { key: "metrics", label: "Metrics Dashboard", description: "Dashboard, metrics, and business analytics", actions: [{ key: "view", label: "View" }, { key: "export", label: "Export" }] },
      { key: "reports", label: "Reports", description: "Business reporting and data exports", actions: [{ key: "view", label: "View" }, { key: "export", label: "Export" }] },
    ],
  },
  {
    key: "settings_admin", label: "Settings & Admin", icon: "settings",
    rows: [
      { key: "settings", label: "Portal Settings", description: "Business configuration and preferences", actions: [{ key: "view", label: "View" }, { key: "edit", label: "Edit" }] },
      { key: "api_keys", label: "API Keys", description: "RunMySalon API key management", actions: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "revoke", label: "Revoke" }] },
      { key: "social", label: "Social Media", description: "Social media management and posting", actions: [{ key: "view", label: "View" }, { key: "post", label: "Post" }, { key: "analytics", label: "Analytics" }] },
    ],
  },
]

type PermMatrix = Record<string, Record<string, Record<string, boolean>>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StaffMember = { id: string; fullName: string; role?: string; position?: string }

export default function PermissionsPage() {
  const { isOwner } = useUserRole()
  const [activeRole, setActiveRole] = useState<"OWNER" | "MANAGER" | "STYLIST">("MANAGER")
  const [matrix, setMatrix] = useState<PermMatrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [staffSearch, setStaffSearch] = useState("")
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const loadMatrix = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/permissions/matrix")
      if (res.ok) {
        const data = await res.json()
        setMatrix(data.matrix || {})
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadMatrix() }, [loadMatrix])

  useEffect(() => {
    fetch("/api/staff/list").then(r => r.json()).then(d => setStaffList(d.staff || [])).catch(() => {})
  }, [])

  const togglePermission = async (feature: string, action: string, currentValue: boolean) => {
    if (activeRole === "OWNER" && !selectedStaff) return
    const key = `${feature}:${action}`
    setSaving(key)
    // Optimistic update
    setMatrix(prev => {
      const next = { ...prev }
      const role = activeRole
      if (!next[role]) next[role] = {}
      if (!next[role][feature]) next[role][feature] = {}
      next[role][feature] = { ...next[role][feature], [action]: !currentValue }
      return next
    })
    try {
      const body: Record<string, unknown> = { role: activeRole, feature, action, granted: !currentValue }
      if (selectedStaff) body.staffMemberId = selectedStaff.id
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2000)
      } else {
        // Revert
        setMatrix(prev => {
          const next = { ...prev }
          if (!next[activeRole]) next[activeRole] = {}
          if (!next[activeRole][feature]) next[activeRole][feature] = {}
          next[activeRole][feature] = { ...next[activeRole][feature], [action]: currentValue }
          return next
        })
        setSaveStatus("error")
        setTimeout(() => setSaveStatus("idle"), 3000)
      }
    } catch {
      setMatrix(prev => {
        const next = { ...prev }
        if (!next[activeRole]) next[activeRole] = {}
        if (!next[activeRole][feature]) next[activeRole][feature] = {}
        next[activeRole][feature] = { ...next[activeRole][feature], [action]: currentValue }
        return next
      })
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 3000)
    }
    setSaving(null)
  }

  const getVal = (feature: string, action: string): boolean => {
    return matrix[activeRole]?.[feature]?.[action] ?? false
  }

  const filteredStaff = staffList.filter(s =>
    !staffSearch || s.fullName?.toLowerCase().includes(staffSearch.toLowerCase())
  )

  const managerCount = staffList.filter(s => s.position === "manager" || s.role === "MANAGER").length
  const stylistCount = staffList.filter(s => s.position === "stylist" || s.role === "STYLIST" || (!s.position && !s.role)).length

  const toggleSection = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const getSectionEnabledCount = (section: PermSection): { enabled: number; total: number } => {
    let enabled = 0, total = 0
    for (const row of section.rows) {
      for (const act of row.actions) {
        total++
        if (getVal(row.key, act.key)) enabled++
      }
    }
    return { enabled, total }
  }

  if (!isOwner) {
    return (
      <div style={{ ...jakarta, padding: "80px 24px", textAlign: "center", color: MUTED, backgroundColor: BG, minHeight: "100vh" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "56px", color: ACC, marginBottom: "16px", display: "block" }}>lock</span>
        <div style={{ fontSize: "18px", fontWeight: 700, color: MID }}>Owner Access Only</div>
        <div style={{ fontSize: "13px", marginTop: "8px", maxWidth: "300px", margin: "8px auto 0" }}>Permission management is restricted to salon owners.</div>
      </div>
    )
  }

  const isOwnerRole = activeRole === "OWNER" && !selectedStaff

  return (
    <div style={{ ...jakarta, height: "100%", backgroundColor: BG, color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}} @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ flex: 1, display: "flex", overflow: "hidden", maxWidth: "1400px", width: "100%", margin: "0 auto" }}>

        {/* ═══ LEFT PANEL ═══ */}
        <div style={{ width: "280px", minWidth: "280px", backgroundColor: "#080c10", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "24px 20px 16px" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "2px" }}>Access Control</div>
            <div style={{ ...mono, fontSize: "10px", color: MUTED }}>Manage role permissions</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 0 16px" }}>
            {/* Roles section */}
            <div style={{ padding: "0 16px" }}>
              <div style={{ ...mono, fontSize: "9px", color: ACC, textTransform: "uppercase", letterSpacing: "0.15em", padding: "8px 4px 6px", fontWeight: 700 }}>Roles</div>

              {([
                { role: "OWNER" as const, icon: "shield", title: "Owner", sub: "Full access to everything", badge: "You", badgeColor: GOLD, count: null },
                { role: "MANAGER" as const, icon: "supervisor_account", title: "Manager", sub: "Location-level management", badge: null, badgeColor: null, count: managerCount },
                { role: "STYLIST" as const, icon: "person", title: "Stylist", sub: "Personal data only", badge: null, badgeColor: null, count: stylistCount },
              ]).map(r => {
                const isActive = activeRole === r.role && !selectedStaff
                const borderColor = r.role === "OWNER" ? GOLD : ACC_B
                return (
                  <button key={r.role} onClick={() => { setActiveRole(r.role); setSelectedStaff(null) }} style={{
                    display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 14px",
                    marginBottom: "4px", borderRadius: "10px", border: "none", cursor: "pointer", textAlign: "left",
                    backgroundColor: isActive ? (r.role === "OWNER" ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.04)") : "transparent",
                    borderLeft: "none",
                    outline: isActive ? `1px solid ${r.role === "OWNER" ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.08)"}` : "1px solid transparent",
                    transition: "all 0.15s",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: isActive ? (r.role === "OWNER" ? GOLD : "#fff") : ACC }}>{r.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: isActive ? "#fff" : MID }}>{r.title}</div>
                      <div style={{ fontSize: "10px", color: MUTED, marginTop: "1px" }}>{r.sub}</div>
                    </div>
                    {r.badge && <span style={{ ...mono, fontSize: "9px", padding: "2px 8px", borderRadius: "10px", backgroundColor: `${borderColor}15`, color: borderColor, fontWeight: 700 }}>{r.badge}</span>}
                    {r.count != null && r.count > 0 && <span style={{ ...mono, fontSize: "10px", color: MUTED }}>{r.count}</span>}
                  </button>
                )
              })}
            </div>

            {/* Divider */}
            <div style={{ height: "1px", backgroundColor: BORDER, margin: "12px 16px" }} />

            {/* Individual overrides */}
            <div style={{ padding: "0 16px" }}>
              <div style={{ ...mono, fontSize: "9px", color: ACC, textTransform: "uppercase", letterSpacing: "0.15em", padding: "0 4px 6px", fontWeight: 700 }}>Individual Overrides</div>
              <div style={{ fontSize: "10px", color: MUTED, padding: "0 4px 8px" }}>Override permissions for a specific person</div>
              <div style={{ position: "relative", marginBottom: "8px" }}>
                <span className="material-symbols-outlined" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: MUTED }}>search</span>
                <input
                  type="text" placeholder="Search staff..." value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px 8px 30px", backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: "8px", color: "#fff", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                {filteredStaff.map(s => {
                  const isActive = selectedStaff?.id === s.id
                  const initials = s.fullName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?"
                  return (
                    <button key={s.id} onClick={() => { setSelectedStaff(s); setActiveRole((s.role as "OWNER" | "MANAGER" | "STYLIST") || "STYLIST") }} style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 10px",
                      marginBottom: "2px", borderRadius: "8px", border: "none", cursor: "pointer", textAlign: "left",
                      backgroundColor: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                      borderLeft: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                      color: isActive ? "#fff" : MID,
                    }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: ACC, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontSize: "12px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.fullName}</div>
                        <div style={{ ...mono, fontSize: "9px", color: MUTED, textTransform: "uppercase" }}>{s.position || s.role || "stylist"}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Right header */}
          <div style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, backgroundColor: "rgba(0,0,0,0.15)" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                {selectedStaff ? selectedStaff.fullName : activeRole} Permissions
              </div>
              <div style={{ fontSize: "12px", color: MUTED, marginTop: "2px" }}>
                {selectedStaff ? `Individual overrides for ${selectedStaff.fullName}` : `Configure what ${activeRole.toLowerCase()}s can access and do`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {saveStatus === "saved" && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px", animation: "fadeIn 0.2s ease" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px", color: GREEN }}>check_circle</span>
                  <span style={{ fontSize: "11px", color: GREEN, fontWeight: 600 }}>Saved</span>
                </div>
              )}
              {saveStatus === "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#ef4444" }}>error</span>
                  <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>Save failed</span>
                </div>
              )}
            </div>
          </div>

          {/* Owner banner */}
          {isOwnerRole && (
            <div style={{ padding: "12px 28px", backgroundColor: "rgba(201,168,76,0.04)", borderBottom: `1px solid rgba(201,168,76,0.1)`, display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: GOLD }}>shield</span>
              <span style={{ fontSize: "12px", color: GOLD }}>Owner always has full access to everything. These cannot be changed.</span>
            </div>
          )}

          {/* Permission sections */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px 80px" }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1,2,3,4,5].map(i => <div key={i} style={{ height: "56px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "10px", animation: "pulse 1.5s infinite", opacity: 1 - i * 0.15 }} />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {SECTIONS.map(section => {
                  const isCollapsed = collapsed[section.key]
                  const { enabled, total } = getSectionEnabledCount(section)
                  return (
                    <div key={section.key} style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: "12px", overflow: "hidden", boxShadow: CARD_SHADOW }}>
                      {/* Section header */}
                      <button onClick={() => toggleSection(section.key)} style={{
                        display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "14px 18px",
                        backgroundColor: "rgba(255,255,255,0.02)", border: "none", cursor: "pointer", textAlign: "left",
                        borderBottom: isCollapsed ? "none" : `1px solid ${BORDER}`,
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: ACC_B }}>{section.icon}</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff", flex: 1 }}>{section.label}</span>
                        <span style={{ ...mono, fontSize: "10px", color: enabled === total ? GREEN : MUTED }}>
                          {enabled}/{total}
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: MUTED, transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>expand_more</span>
                      </button>

                      {/* Section rows */}
                      {!isCollapsed && section.rows.map(row => (
                        <div key={row.key} style={{ padding: "12px 18px 12px 48px", borderBottom: `1px solid rgba(255,255,255,0.03)`, display: "flex", alignItems: "center", gap: "16px", transition: "background 0.1s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.015)" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent" }}
                        >
                          {/* Left: feature info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 500, color: "#fff" }}>{row.label}</div>
                            <div style={{ fontSize: "11px", color: MUTED, marginTop: "1px" }}>{row.description}</div>
                          </div>
                          {/* Right: action toggles */}
                          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                            {row.actions.map(act => {
                              const val = getVal(row.key, act.key)
                              const isToggling = saving === `${row.key}:${act.key}`
                              const disabled = isOwnerRole
                              return (
                                <div key={act.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                                  <button
                                    onClick={() => !disabled && togglePermission(row.key, act.key, val)}
                                    disabled={disabled || isToggling}
                                    title={disabled ? "Owner permissions cannot be modified" : `Toggle ${act.label}`}
                                    style={{
                                      width: "36px", height: "20px", borderRadius: "10px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
                                      backgroundColor: val ? GREEN : "rgba(255,255,255,0.1)",
                                      position: "relative", transition: "background-color 0.2s ease",
                                      opacity: disabled ? 0.35 : isToggling ? 0.6 : 1,
                                    }}
                                  >
                                    <div style={{
                                      width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#fff",
                                      position: "absolute", top: "2px",
                                      left: val ? "18px" : "2px",
                                      transition: "left 0.2s ease",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                    }} />
                                  </button>
                                  <span style={{ ...mono, fontSize: "8px", color: val ? GREEN : MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{act.label}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
