"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const AMBER = "#ffb347"
const BORDER = "rgba(255,255,255,0.07)"
const BORDER2 = "rgba(255,255,255,0.12)"
const S1 = "rgba(255,255,255,0.03)"
const S2 = "rgba(255,255,255,0.05)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#10B981"
const RED = "#ff6b6b"

const TABS = [
  { id: "get-covered", label: "Get Covered" },
  { id: "my-coverage", label: "My Coverage" },
  { id: "whats-covered", label: "What\u2019s Covered" },
  { id: "file-claim", label: "File a Claim" },
]

const INCIDENT_TYPES = [
  { id: "chemical_burn", label: "Chemical burn" },
  { id: "allergic_reaction", label: "Allergic reaction" },
  { id: "slip_fall", label: "Slip / fall" },
  { id: "property_damage", label: "Property damage" },
  { id: "client_injury", label: "Client injury" },
  { id: "other", label: "Other" },
]

type InsuranceProfile = {
  id: string; status: string; policyNumber: string | null; provider: string | null
  coverageAmount: number | null; monthlyPremium: number | null
  startDate: string | null; expirationDate: string | null
}
type Incident = {
  id: string; incidentDate: string; clientName: string | null; incidentType: string
  description: string; witnessName: string | null; medicalAttention: boolean; status: string; createdAt: string
}

export default function StyleInsurePage() {
  const { isOwner } = useUserRole()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("get-covered")
  const [profile, setProfile] = useState<InsuranceProfile | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [showPolicyForm, setShowPolicyForm] = useState(false)
  const [policyForm, setPolicyForm] = useState({ policyNumber: "", provider: "Next Insurance", startDate: "", expirationDate: "" })
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [incidentForm, setIncidentForm] = useState({ incidentDate: "", clientName: "", incidentType: "chemical_burn", description: "", witnessName: "", witnessContact: "", medicalAttention: false })
  const [savingIncident, setSavingIncident] = useState(false)

  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    if (isOwner) { setHasAccess(true); loadData(); return }
    fetch("/api/suite/subscription")
      .then(r => r.json())
      .then(data => {
        if (data.hasAccess) { setHasAccess(true); loadData() }
        else { setHasAccess(false); setLoading(false) }
      })
      .catch(() => { setHasAccess(true); loadData() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [pRes, iRes] = await Promise.all([
        fetch("/api/suite/insurance/profile"),
        fetch("/api/suite/insurance/incidents"),
      ])
      const pData = await pRes.json()
      const iData = await iRes.json()
      setProfile(pData.profile)
      setIncidents(iData.incidents || [])
    } catch { /* noop */ }
    setLoading(false)
  }

  const savePolicy = async () => {
    setSavingPolicy(true)
    await fetch("/api/suite/insurance/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "active", policyNumber: policyForm.policyNumber, provider: policyForm.provider,
        startDate: policyForm.startDate ? new Date(policyForm.startDate).toISOString() : null,
        expirationDate: policyForm.expirationDate ? new Date(policyForm.expirationDate).toISOString() : null,
      }),
    })
    await loadData()
    setShowPolicyForm(false)
    setSavingPolicy(false)
    setActiveTab("my-coverage")
  }

  const saveIncident = async () => {
    if (!incidentForm.incidentDate || !incidentForm.description) return
    setSavingIncident(true)
    const res = await fetch("/api/suite/insurance/incidents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incidentForm),
    })
    const data = await res.json()
    if (data.incident) {
      setIncidents(prev => [data.incident, ...prev])
      setShowIncidentForm(false)
      setIncidentForm({ incidentDate: "", clientName: "", incidentType: "chemical_burn", description: "", witnessName: "", witnessContact: "", medicalAttention: false })
    }
    setSavingIncident(false)
  }

  const hasPolicy = profile && profile.status === "active" && profile.policyNumber
  const daysRemaining = profile?.expirationDate ? Math.max(0, Math.ceil((new Date(profile.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  const mono: React.CSSProperties = { fontFamily: "'Inter', sans-serif" }
  const jakarta: React.CSSProperties = { fontFamily: "'Inter', -apple-system, sans-serif" }
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", backgroundColor: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER2}`, borderRadius: "8px", color: "#FBFBFB", fontSize: "14px", outline: "none", boxSizing: "border-box" as const, ...jakarta }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "6px", ...mono }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 500 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 60, background: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: 10, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 700, color: "#FBFBFB", marginBottom: 8 }}>StyleInsure</div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#7a8f96", marginBottom: 24, textAlign: "center" }}>Subscribe to Envy Suite to access this feature</div>
        <button onClick={() => router.push("/suite")} style={{ background: "transparent", border: "1px solid #606E74", color: "#7a8f96", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>View Plans</button>
      </div>
    )
  }

  return (
    <div style={{ ...jakarta, minHeight: "100vh", backgroundColor: "#06080d", color: "#fff", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "800px", height: "400px", background: `radial-gradient(ellipse at 50% 0%, ${ACC_DIM} 0%, transparent 65%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1000px", margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(16px,4vw,32px)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/suite")} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: MUTED, background: "none", border: "none", cursor: "pointer", ...jakarta }}>&larr; Envy Suite</button>
          <span style={{ color: BORDER, fontSize: "12px" }}>&rsaquo;</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "22px", height: "22px", borderRadius: "5px", background: "rgba(255,179,71,0.1)", border: "1px solid rgba(255,179,71,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px", color: AMBER }}>shield</span>
            </div>
            <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em" }}>StyleInsure</span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "1px", background: S1, border: `1px solid ${BORDER}`, borderRadius: "9px", padding: "3px", marginBottom: "20px", overflowX: "auto" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: "6px", border: activeTab === tab.id ? `1px solid ${ACC_BORDER}` : "1px solid transparent", background: activeTab === tab.id ? `linear-gradient(135deg, rgba(122,143,150,0.15), rgba(96,110,116,0.08))` : "transparent", color: activeTab === tab.id ? "#fff" : MUTED, fontSize: "9px", fontWeight: activeTab === tab.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em", ...mono }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: MUTED }}>Loading insurance profile...</div>
        ) : (
          <>
            {/* ═══ GET COVERED TAB ═══ */}
            {activeTab === "get-covered" && (
              <div>
                {/* Coverage hero */}
                <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "14px", padding: "32px", marginBottom: "16px", textAlign: "center" }}>
                  <div style={{ ...mono, fontSize: "48px", fontWeight: 500, color: AMBER, marginBottom: "8px" }}>$1,000,000</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "4px" }}>Professional Liability Coverage</div>
                  <div style={{ fontSize: "12px", color: MUTED }}>Per occurrence / $2M aggregate</div>
                </div>

                {/* 3 coverage highlights */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                  {[
                    { icon: "science", title: "Chemical Services", desc: "Color treatments, perms, relaxers covered", color: "#a78bfa" },
                    { icon: "personal_injury", title: "Client Injuries", desc: "Slip and fall, burns, allergic reactions", color: RED },
                    { icon: "construction", title: "Property Damage", desc: "Damage to client property or salon equipment", color: AMBER },
                  ].map(c => (
                    <div key={c.title} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "22px", color: c.color, marginBottom: "10px", display: "block" }}>{c.icon}</span>
                      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>{c.title}</div>
                      <div style={{ fontSize: "11px", color: MID, lineHeight: 1.6 }}>{c.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Pricing */}
                <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <div style={{ ...mono, fontSize: "32px", fontWeight: 500, color: "#fff" }}>$15<span style={{ fontSize: "14px", color: MUTED }}>/month</span></div>
                      <div style={{ fontSize: "11px", color: MUTED }}>Through Next Insurance &mdash; the #1 digital insurer for small business</div>
                    </div>
                    <div style={{ ...mono, fontSize: "9px", padding: "4px 10px", borderRadius: "4px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: GREEN, textTransform: "uppercase" }}>100% tax deductible</div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <a href="https://www.nextinsurance.com/profession/hair-stylist-insurance/" target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "11px 20px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", textDecoration: "none", textAlign: "center", ...jakarta }}>
                      Get Quote at Next Insurance &rarr;
                    </a>
                    <button onClick={() => setShowPolicyForm(true)} style={{ flex: 1, padding: "11px 20px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "8px", color: MID, fontSize: "12px", cursor: "pointer", ...jakarta }}>
                      I Already Have Coverage &mdash; Add to Profile
                    </button>
                  </div>
                </div>

                {/* Add existing policy form */}
                {showPolicyForm && (
                  <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", padding: "24px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 16px" }}>Add Existing Policy</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div><label style={labelStyle}>Policy Number</label><input value={policyForm.policyNumber} onChange={e => setPolicyForm(p => ({ ...p, policyNumber: e.target.value }))} placeholder="e.g. NI-12345678" style={inputStyle} /></div>
                      <div><label style={labelStyle}>Insurance Provider</label><input value={policyForm.provider} onChange={e => setPolicyForm(p => ({ ...p, provider: e.target.value }))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Start Date</label><input type="date" value={policyForm.startDate} onChange={e => setPolicyForm(p => ({ ...p, startDate: e.target.value }))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Expiration Date</label><input type="date" value={policyForm.expirationDate} onChange={e => setPolicyForm(p => ({ ...p, expirationDate: e.target.value }))} style={inputStyle} /></div>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => setShowPolicyForm(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "7px", color: MID, cursor: "pointer", ...jakarta }}>Cancel</button>
                      <button onClick={savePolicy} disabled={savingPolicy || !policyForm.policyNumber} style={{ flex: 2, padding: "10px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "7px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: !policyForm.policyNumber ? 0.5 : 1 }}>{savingPolicy ? "Saving..." : "Save Policy"}</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ MY COVERAGE TAB ═══ */}
            {activeTab === "my-coverage" && (
              <div>
                {!hasPolicy ? (
                  <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "48px", textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "40px", color: MUTED, display: "block", marginBottom: "14px" }}>shield</span>
                    <p style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>No active coverage</p>
                    <p style={{ fontSize: "12px", color: MUTED, marginBottom: "20px" }}>Get covered for as little as $15/month to protect yourself from liability claims.</p>
                    <button onClick={() => setActiveTab("get-covered")} style={{ padding: "10px 20px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta }}>Get Covered</button>
                  </div>
                ) : (
                  <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Policy Details</h3>
                      <span style={{ ...mono, fontSize: "9px", padding: "3px 10px", borderRadius: "4px", background: profile?.status === "active" ? "rgba(16,185,129,0.08)" : "rgba(255,107,107,0.08)", border: `1px solid ${profile?.status === "active" ? "rgba(16,185,129,0.2)" : "rgba(255,107,107,0.2)"}`, color: profile?.status === "active" ? GREEN : RED, textTransform: "uppercase" }}>{profile?.status}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {[
                        { label: "Provider", value: profile?.provider || "N/A" },
                        { label: "Policy Number", value: profile?.policyNumber || "N/A" },
                        { label: "Coverage Amount", value: "$1,000,000" },
                        { label: "Monthly Premium", value: `$${profile?.monthlyPremium || 15}` },
                        { label: "Expiration", value: profile?.expirationDate ? new Date(profile.expirationDate).toLocaleDateString() : "N/A" },
                        { label: "Days Remaining", value: daysRemaining !== null ? `${daysRemaining} days` : "N/A" },
                      ].map(item => (
                        <div key={item.label} style={{ padding: "12px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                          <div style={{ ...mono, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, marginBottom: "4px" }}>{item.label}</div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: ACC_BRIGHT }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Why every stylist needs this */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "14px" }}>Why every stylist needs this</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {[
                      { stat: "1 in 4", desc: "stylists face a client complaint each year", color: AMBER },
                      { stat: "$50,000+", desc: "average cost of defending a liability lawsuit", color: RED },
                      { stat: "$15/mo", desc: "is less than a single bottle of color", color: GREEN },
                    ].map(s => (
                      <div key={s.stat} style={{ padding: "14px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "8px", textAlign: "center" }}>
                        <div style={{ ...mono, fontSize: "22px", fontWeight: 500, color: s.color, marginBottom: "6px" }}>{s.stat}</div>
                        <div style={{ fontSize: "11px", color: MID, lineHeight: 1.5 }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ WHAT'S COVERED TAB ═══ */}
            {activeTab === "whats-covered" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  {/* Covered */}
                  <div style={{ background: S1, border: `1px solid rgba(16,185,129,0.15)`, borderRadius: "12px", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: GREEN }}>check_circle</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: GREEN }}>Covered</span>
                    </div>
                    {[
                      "Chemical service reactions (color, perm, relaxer, keratin)",
                      "Allergic reactions to products",
                      "Scalp burns from chemicals or heat",
                      "Hair breakage from chemical services",
                      "Slip and fall in your workspace",
                      "Damage to client\u2019s clothing during service",
                      "Client\u2019s personal property damaged",
                      "Professional negligence claims",
                      "Legal defense costs (up to coverage limit)",
                      "Medical payments for injured clients",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", padding: "6px 0", borderBottom: `1px solid ${BORDER}`, fontSize: "12px", color: MID, lineHeight: 1.5 }}>
                        <span style={{ color: GREEN, flexShrink: 0 }}>&#10003;</span>
                        {item}
                      </div>
                    ))}
                  </div>
                  {/* Not covered */}
                  <div style={{ background: S1, border: `1px solid rgba(255,107,107,0.15)`, borderRadius: "12px", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: RED }}>cancel</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: RED }}>Not Covered</span>
                    </div>
                    {[
                      "Intentional acts or illegal services",
                      "Services performed while unlicensed",
                      "Business property (your tools/equipment) \u2014 needs separate policy",
                      "Employee injuries \u2014 not applicable (you\u2019re 1099)",
                      "Auto accidents commuting to salon",
                      "Cyber liability",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", padding: "6px 0", borderBottom: `1px solid ${BORDER}`, fontSize: "12px", color: MID, lineHeight: 1.5 }}>
                        <span style={{ color: RED, flexShrink: 0 }}>&#10007;</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Important note */}
                <div style={{ padding: "16px 20px", background: "rgba(255,179,71,0.04)", border: "1px solid rgba(255,179,71,0.15)", borderRadius: "10px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: AMBER, flexShrink: 0 }}>warning</span>
                  <div style={{ fontSize: "12px", color: MID, lineHeight: 1.7 }}>
                    <strong style={{ color: AMBER }}>Important:</strong> As a 1099 contractor, you are personally liable for any claims. The salon&apos;s insurance does <strong>NOT</strong> cover you. This policy protects <strong>YOU</strong> specifically.
                  </div>
                </div>
              </div>
            )}

            {/* ═══ FILE A CLAIM TAB ═══ */}
            {activeTab === "file-claim" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 3px" }}>Incident Documentation</h3>
                    <p style={{ fontSize: "12px", color: MUTED, margin: 0 }}>Document incidents immediately &mdash; then follow the claim guide below</p>
                  </div>
                  <button onClick={() => setShowIncidentForm(true)} style={{ padding: "9px 16px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "7px", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", ...jakarta }}>Document Incident</button>
                </div>

                {/* Claim guide */}
                <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "14px" }}>Claim Filing Guide</div>
                  {[
                    { step: 1, title: "Document the incident thoroughly", desc: "Use the form above to record all details while they\u2019re fresh", color: ACC_BRIGHT },
                    { step: 2, title: "Take photos immediately", desc: "Photograph the injury, workspace, products used, and any damage", color: "#4da6ff" },
                    { step: 3, title: "Get client\u2019s contact information", desc: "Full name, phone, email, and address for the insurance company", color: "#a78bfa" },
                    { step: 4, title: "Contact Next Insurance within 24 hours", desc: "Phone: 1-855-222-5919 \u00b7 Email: claims@nextinsurance.com \u00b7 Online: app.nextinsurance.com", color: AMBER },
                    { step: 5, title: "Do NOT admit fault or make payments", desc: "Let the insurance company handle all communications and payments", color: RED },
                    { step: 6, title: "Keep all records and communications", desc: "Save every email, receipt, photo, and document related to the incident", color: GREEN },
                  ].map(s => (
                    <div key={s.step} style={{ display: "flex", gap: "14px", padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: `${s.color}15`, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ ...mono, fontSize: "11px", color: s.color }}>{s.step}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "3px" }}>{s.title}</div>
                        <div style={{ fontSize: "11px", color: MID, lineHeight: 1.6 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Incidents list */}
                {incidents.length === 0 ? (
                  <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "40px", textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "36px", color: MUTED, display: "block", marginBottom: "12px" }}>folder_open</span>
                    <p style={{ fontSize: "13px", color: MUTED }}>No incidents documented. Use the button above to record an incident.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "4px" }}>Documented Incidents</div>
                    {incidents.map(inc => (
                      <div key={inc.id} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                          <div>
                            <span style={{ fontSize: "13px", fontWeight: 700 }}>{inc.incidentType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                            {inc.clientName && <span style={{ fontSize: "11px", color: MUTED }}> &middot; {inc.clientName}</span>}
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            {inc.medicalAttention && <span style={{ ...mono, fontSize: "8px", padding: "2px 6px", borderRadius: "3px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: RED, textTransform: "uppercase" }}>Medical</span>}
                            <span style={{ ...mono, fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT, textTransform: "uppercase" }}>{inc.status}</span>
                          </div>
                        </div>
                        <p style={{ fontSize: "11px", color: MID, margin: "0 0 4px", lineHeight: 1.5 }}>{inc.description.slice(0, 200)}{inc.description.length > 200 ? "..." : ""}</p>
                        <div style={{ fontSize: "10px", color: MUTED }}>{new Date(inc.incidentDate).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Incident form modal */}
                {showIncidentForm && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
                    <div style={{ background: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "14px", padding: "28px", width: "100%", maxWidth: "500px", maxHeight: "85vh", overflow: "auto" }}>
                      <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: "20px" }}>Document an Incident</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div><label style={labelStyle}>Incident Date</label><input type="date" value={incidentForm.incidentDate} onChange={e => setIncidentForm(p => ({ ...p, incidentDate: e.target.value }))} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Client Name</label><input value={incidentForm.clientName} onChange={e => setIncidentForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Full name" style={inputStyle} /></div>
                        <div><label style={labelStyle}>Incident Type</label>
                          <select value={incidentForm.incidentType} onChange={e => setIncidentForm(p => ({ ...p, incidentType: e.target.value }))} style={inputStyle}>
                            {INCIDENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </div>
                        <div><label style={labelStyle}>Description</label><textarea value={incidentForm.description} onChange={e => setIncidentForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe what happened in detail..." style={{ ...inputStyle, height: "100px", resize: "vertical" as const }} /></div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input type="checkbox" checked={incidentForm.medicalAttention} onChange={e => setIncidentForm(p => ({ ...p, medicalAttention: e.target.checked }))} style={{ accentColor: ACC }} />
                          <label style={{ fontSize: "12px", color: MID }}>Medical attention was required</label>
                        </div>
                        <div><label style={labelStyle}>Witness Name (optional)</label><input value={incidentForm.witnessName} onChange={e => setIncidentForm(p => ({ ...p, witnessName: e.target.value }))} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Witness Contact (optional)</label><input value={incidentForm.witnessContact} onChange={e => setIncidentForm(p => ({ ...p, witnessContact: e.target.value }))} style={inputStyle} /></div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                        <button onClick={() => setShowIncidentForm(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "7px", color: MID, cursor: "pointer", ...jakarta }}>Cancel</button>
                        <button onClick={saveIncident} disabled={savingIncident || !incidentForm.incidentDate || !incidentForm.description} style={{ flex: 2, padding: "10px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "7px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: (!incidentForm.incidentDate || !incidentForm.description) ? 0.5 : 1 }}>{savingIncident ? "Saving..." : "Document Incident"}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
