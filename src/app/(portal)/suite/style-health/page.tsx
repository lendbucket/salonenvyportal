"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const AMBER = "#ffb347"
const BORDER = "rgba(26,19,19,0.07)"
const BORDER2 = "rgba(26,19,19,0.12)"
const S1 = "rgba(26,19,19,0.03)"
const S2 = "rgba(26,19,19,0.05)"
const MUTED = "rgba(26,19,19,0.3)"
const MID = "rgba(26,19,19,0.6)"
const GREEN = "#10B981"
const RED = "#ff6b6b"
const BLUE = "#4da6ff"
const PURPLE = "#a78bfa"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "get-covered", label: "Get Covered" },
  { id: "my-coverage", label: "My Coverage" },
  { id: "hsa", label: "HSA Guide" },
]

type HealthProfile = {
  id: string; enrollmentStatus: string; planType: string | null; provider: string | null
  monthlyPremium: number | null; deductible: number | null; hasHsa: boolean
  hsaContribution: number | null; hasDental: boolean; hasVision: boolean
  coverageStartDate: string | null
}

export default function StyleHealthPage() {
  const { isOwner } = useUserRole()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [profile, setProfile] = useState<HealthProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [coverageForm, setCoverageForm] = useState({ planType: "individual", provider: "", monthlyPremium: "", deductible: "", hasDental: false, hasVision: false, coverageStartDate: "" })
  const [hsaInterest, setHsaInterest] = useState(false)

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
      const res = await fetch("/api/suite/health/profile")
      const data = await res.json()
      setProfile(data.profile)
      if (data.profile?.planType) setCoverageForm(f => ({ ...f, planType: data.profile.planType || "individual", provider: data.profile.provider || "", monthlyPremium: data.profile.monthlyPremium?.toString() || "", deductible: data.profile.deductible?.toString() || "", hasDental: data.profile.hasDental, hasVision: data.profile.hasVision, coverageStartDate: data.profile.coverageStartDate?.split("T")[0] || "" }))
      if (data.profile?.hasHsa) setHsaInterest(true)
    } catch { /* noop */ }
    setLoading(false)
  }

  const markInterested = async () => {
    setSaving(true)
    await fetch("/api/suite/health/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentStatus: "interested" }),
    })
    setProfile(p => p ? { ...p, enrollmentStatus: "interested" } : p)
    setSaving(false)
  }

  const saveCoverage = async () => {
    setSaving(true)
    await fetch("/api/suite/health/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentStatus: "enrolled",
        planType: coverageForm.planType,
        provider: coverageForm.provider || null,
        monthlyPremium: coverageForm.monthlyPremium ? parseFloat(coverageForm.monthlyPremium) : null,
        deductible: coverageForm.deductible ? parseFloat(coverageForm.deductible) : null,
        hasDental: coverageForm.hasDental,
        hasVision: coverageForm.hasVision,
        coverageStartDate: coverageForm.coverageStartDate ? new Date(coverageForm.coverageStartDate).toISOString() : null,
      }),
    })
    await loadData()
    setSaving(false)
    setActiveTab("my-coverage")
  }

  const saveHsaInterest = async (interested: boolean) => {
    setHsaInterest(interested)
    await fetch("/api/suite/health/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasHsa: interested }),
    })
  }

  const mono: React.CSSProperties = { fontFamily: "'Inter', sans-serif" }
  const jakarta: React.CSSProperties = { fontFamily: "'Inter', -apple-system, sans-serif" }
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", backgroundColor: "rgba(26,19,19,0.06)", border: `1px solid ${BORDER2}`, borderRadius: "8px", color: "#1A1313", fontSize: "14px", outline: "none", boxSizing: "border-box" as const, ...jakarta }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "6px", ...mono }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 500 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 60, background: "#FBFBFB", border: "1px solid rgba(205,201,192,0.12)", borderRadius: 10, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 700, color: "#1A1313", marginBottom: 8 }}>StyleHealth</div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#7a8f96", marginBottom: 24, textAlign: "center" }}>Subscribe to Envy Suite to access this feature</div>
        <button onClick={() => router.push("/suite")} style={{ background: "transparent", border: "1px solid #606E74", color: "#7a8f96", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>View Plans</button>
      </div>
    )
  }

  return (
    <div style={{ ...jakarta, minHeight: "100vh", backgroundColor: "#F4F5F7", color: "#1A1313", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "800px", height: "400px", background: `radial-gradient(ellipse at 50% 0%, ${ACC_DIM} 0%, transparent 65%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1000px", margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(16px,4vw,32px)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/suite")} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: MUTED, background: "none", border: "none", cursor: "pointer", ...jakarta }}>&larr; Envy Suite</button>
          <span style={{ color: BORDER, fontSize: "12px" }}>&rsaquo;</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "22px", height: "22px", borderRadius: "5px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px", color: RED }}>favorite</span>
            </div>
            <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em" }}>StyleHealth</span>
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
          <div style={{ textAlign: "center", padding: "60px", color: MUTED }}>Loading health profile...</div>
        ) : (
          <>
            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === "overview" && (
              <div>
                {/* Coming soon banner */}
                <div style={{ padding: "16px 20px", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, borderRadius: "10px", marginBottom: "24px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: ACC_BRIGHT, flexShrink: 0 }}>sync</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1313", marginBottom: "4px" }}>Group health access launching soon</div>
                    <div style={{ fontSize: "12px", color: MID, lineHeight: 1.6 }}>
                      We&apos;re negotiating group rates with carriers specifically for <strong style={{ color: ACC_BRIGHT }}>1099 beauty professionals</strong>. Sign up below to be notified when enrollment opens. In the meantime, use the Get Covered tab to explore your options.
                    </div>
                  </div>
                </div>

                {/* Problem stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                  {[
                    { stat: "$612/mo", desc: "Average individual plan cost for 1099 workers", color: RED },
                    { stat: "1 in 4", desc: "Self-employed workers are uninsured", color: AMBER },
                    { stat: "$200/mo", desc: "Target StyleHealth group rate", color: GREEN },
                    { stat: "67%", desc: "Estimated savings vs individual market", color: BLUE },
                  ].map(s => (
                    <div key={s.stat} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px", textAlign: "center" }}>
                      <div style={{ ...mono, fontSize: "24px", fontWeight: 500, color: s.color, marginBottom: "6px" }}>{s.stat}</div>
                      <div style={{ fontSize: "10px", color: MID, lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Pain points with solutions */}
                <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "18px" }}>The Problem &amp; Our Solution</div>
                  {[
                    { problem: "Individual plans are expensive", solution: "We negotiate group rates for all StyleSuite members", icon: "payments", color: RED },
                    { problem: "Hard to qualify as self-employed", solution: "Association membership qualifies you for group coverage", icon: "verified_user", color: AMBER },
                    { problem: "Complex to set up and manage", solution: "We handle enrollment, billing, and support", icon: "support_agent", color: GREEN },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "16px", padding: "14px 0", borderBottom: i < 2 ? `1px solid ${BORDER}` : "none" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `${item.color}10`, border: `1px solid ${item.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: item.color }}>{item.icon}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: RED, marginBottom: "3px", textDecoration: "line-through", opacity: 0.6 }}>{item.problem}</div>
                        <div style={{ fontSize: "13px", color: GREEN, fontWeight: 600 }}>{item.solution}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Interest registration */}
                <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", padding: "24px", textAlign: "center" }}>
                  {profile?.enrollmentStatus === "interested" ? (
                    <div>
                      <span className="material-symbols-outlined" style={{ fontSize: "32px", color: GREEN, display: "block", marginBottom: "10px" }}>check_circle</span>
                      <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>You&apos;re on the list!</div>
                      <div style={{ fontSize: "12px", color: MID }}>We&apos;ll notify you when StyleHealth group enrollment opens.</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>Be the first to know when StyleHealth launches</div>
                      <div style={{ fontSize: "12px", color: MID, marginBottom: "16px" }}>We&apos;ll email you when group enrollment opens.</div>
                      <button onClick={markInterested} disabled={saving} style={{ padding: "11px 28px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#1A1313", fontSize: "13px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: saving ? 0.7 : 1 }}>
                        {saving ? "Saving..." : "Notify Me When It Launches"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ GET COVERED TAB ═══ */}
            {activeTab === "get-covered" && (
              <div>
                {/* Three tiers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                  {[
                    { name: "Basic", price: "$150", features: ["Major medical coverage", "$5,000 deductible", "Preventive care 100%", "Emergency room coverage", "Generic prescriptions"], badge: null, color: ACC_BRIGHT },
                    { name: "Standard", price: "$250", features: ["Everything in Basic", "$2,500 deductible", "Specialist visits covered", "Brand name prescriptions", "Mental health coverage"], badge: "Most Popular", color: BLUE },
                    { name: "Premium", price: "$400", features: ["Everything in Standard", "$1,000 deductible", "Dental included", "Vision included", "HSA eligible"], badge: null, color: PURPLE },
                  ].map(tier => (
                    <div key={tier.name} style={{ background: S1, border: `1px solid ${tier.badge ? ACC_BORDER : BORDER}`, borderRadius: "12px", padding: "22px", position: "relative", boxShadow: tier.badge ? "0 0 30px rgba(96,110,116,0.08)" : "none" }}>
                      {tier.badge && <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", ...mono, fontSize: "9px", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 12px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, color: "#1A1313", borderRadius: "100px", whiteSpace: "nowrap" }}>{tier.badge}</div>}
                      <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "10px" }}>{tier.name}</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.04em", color: tier.color, ...mono }}>{tier.price}</span>
                        <span style={{ fontSize: "11px", color: MUTED, paddingBottom: "6px" }}>/month est.</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "14px" }}>
                        {tier.features.map((f, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: MID }}>
                            <span style={{ color: GREEN, fontSize: "10px" }}>&#10003;</span>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add-ons */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>Add-Ons</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {[
                      { name: "Dental Only", price: "+$25/mo", icon: "dentistry" },
                      { name: "Vision Only", price: "+$15/mo", icon: "visibility" },
                      { name: "HSA Setup", price: "Free", icon: "savings" },
                    ].map(a => (
                      <div key={a.name} style={{ padding: "12px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: ACC_BRIGHT }}>{a.icon}</span>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600 }}>{a.name}</div>
                          <div style={{ ...mono, fontSize: "11px", color: GREEN }}>{a.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Partners */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>Explore Your Options</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {[
                      { label: "Healthcare.gov", desc: "ACA Marketplace", href: "https://www.healthcare.gov/see-plans/" },
                      { label: "PeopleKeep", desc: "HRA Administration", href: "https://www.peoplekeep.com/" },
                      { label: "Take Command", desc: "ICHRA Specialist", href: "https://www.takecommandhealth.com/" },
                    ].map(p => (
                      <a key={p.label} href={p.href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: "180px", padding: "14px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "8px", textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: BLUE }}>open_in_new</span>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#1A1313" }}>{p.label}</div>
                          <div style={{ fontSize: "10px", color: MUTED }}>{p.desc}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Tax deduction callout */}
                <div style={{ padding: "16px 20px", background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "10px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: GREEN, flexShrink: 0 }}>savings</span>
                  <div style={{ fontSize: "12px", color: MID, lineHeight: 1.7 }}>
                    <strong style={{ color: GREEN }}>100% tax deductible.</strong> Self-employed health insurance premiums are an above-the-line deduction. A $250/month plan costs you just <strong style={{ color: GREEN }}>~$182/month</strong> after the tax deduction (assuming 27% effective rate).
                  </div>
                </div>
              </div>
            )}

            {/* ═══ MY COVERAGE TAB ═══ */}
            {activeTab === "my-coverage" && (
              <div>
                {profile?.enrollmentStatus === "enrolled" && profile.provider ? (
                  <div>
                    {/* Coverage card */}
                    <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Your Coverage</h3>
                        <span style={{ ...mono, fontSize: "9px", padding: "3px 10px", borderRadius: "4px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: GREEN, textTransform: "uppercase" }}>Enrolled</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        {[
                          { label: "Provider", value: profile.provider },
                          { label: "Plan Type", value: profile.planType === "family" ? "Family" : "Individual" },
                          { label: "Monthly Premium", value: profile.monthlyPremium ? `$${profile.monthlyPremium}` : "N/A" },
                          { label: "Deductible", value: profile.deductible ? `$${profile.deductible}` : "N/A" },
                          { label: "Coverage Start", value: profile.coverageStartDate ? new Date(profile.coverageStartDate).toLocaleDateString() : "N/A" },
                          { label: "Tax Savings/Year", value: profile.monthlyPremium ? `$${Math.round(profile.monthlyPremium * 12 * 0.27)}` : "N/A" },
                        ].map(item => (
                          <div key={item.label} style={{ padding: "12px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                            <div style={{ ...mono, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, marginBottom: "4px" }}>{item.label}</div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: ACC_BRIGHT }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Coverage checklist */}
                    <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px" }}>
                      <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>Coverage Checklist</div>
                      {[
                        { text: "Health insurance active", done: true },
                        { text: "Dental coverage", done: profile.hasDental },
                        { text: "Vision coverage", done: profile.hasVision },
                        { text: "HSA set up", done: profile.hasHsa },
                        { text: "Premium deduction set up for taxes", done: false },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                          <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: item.done ? GREEN : "transparent", border: `2px solid ${item.done ? GREEN : BORDER2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {item.done && <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "#1A1313" }}>check</span>}
                          </div>
                          <span style={{ fontSize: "12px", color: item.done ? MID : "#fff" }}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Enrollment wizard */
                  <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", padding: "24px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px" }}>Track Your Coverage</h3>
                    <p style={{ fontSize: "12px", color: MID, marginBottom: "20px" }}>Already have health insurance? Enter your plan details to track deductions and coverage.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                      <div>
                        <label style={labelStyle}>Plan Type</label>
                        <select value={coverageForm.planType} onChange={e => setCoverageForm(p => ({ ...p, planType: e.target.value }))} style={inputStyle}>
                          <option value="individual">Individual</option>
                          <option value="family">Family</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Insurance Provider</label>
                        <input value={coverageForm.provider} onChange={e => setCoverageForm(p => ({ ...p, provider: e.target.value }))} placeholder="e.g. Blue Cross, Oscar, Ambetter" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Monthly Premium</label>
                        <input type="number" value={coverageForm.monthlyPremium} onChange={e => setCoverageForm(p => ({ ...p, monthlyPremium: e.target.value }))} placeholder="e.g. 250" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Annual Deductible</label>
                        <input type="number" value={coverageForm.deductible} onChange={e => setCoverageForm(p => ({ ...p, deductible: e.target.value }))} placeholder="e.g. 2500" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Coverage Start Date</label>
                        <input type="date" value={coverageForm.coverageStartDate} onChange={e => setCoverageForm(p => ({ ...p, coverageStartDate: e.target.value }))} style={inputStyle} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input type="checkbox" checked={coverageForm.hasDental} onChange={e => setCoverageForm(p => ({ ...p, hasDental: e.target.checked }))} style={{ accentColor: ACC }} />
                          <label style={{ fontSize: "12px", color: MID }}>Includes dental</label>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input type="checkbox" checked={coverageForm.hasVision} onChange={e => setCoverageForm(p => ({ ...p, hasVision: e.target.checked }))} style={{ accentColor: ACC }} />
                          <label style={{ fontSize: "12px", color: MID }}>Includes vision</label>
                        </div>
                      </div>
                    </div>
                    <button onClick={saveCoverage} disabled={saving} style={{ padding: "11px 24px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#1A1313", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: saving ? 0.7 : 1 }}>
                      {saving ? "Saving..." : "Save Coverage Info"}
                    </button>

                    {coverageForm.monthlyPremium && (
                      <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "8px", fontSize: "12px", color: MID }}>
                        <strong style={{ color: GREEN }}>Tax deduction:</strong> Your ${coverageForm.monthlyPremium}/month premium = <strong style={{ color: GREEN }}>${(parseFloat(coverageForm.monthlyPremium) * 12).toLocaleString()}/year</strong> deduction on Schedule 1, Line 17. That saves you ~${Math.round(parseFloat(coverageForm.monthlyPremium) * 12 * 0.27).toLocaleString()} in taxes.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══ HSA GUIDE TAB ═══ */}
            {activeTab === "hsa" && (
              <div>
                {/* Hero */}
                <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "14px", padding: "28px", marginBottom: "16px", textAlign: "center" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>Health Savings Account</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "8px" }}>The Best Tax Advantage You&apos;re Not Using</div>
                  <div style={{ ...mono, fontSize: "36px", fontWeight: 500, color: GREEN, marginBottom: "6px" }}>$4,300</div>
                  <div style={{ fontSize: "12px", color: MID }}>per year saved tax-free (2025 individual limit)</div>
                </div>

                {/* How HSA works */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                  {[
                    { step: "01", title: "Contribute pre-tax", desc: "Saves ~25% immediately off every dollar", icon: "add_card", color: BLUE },
                    { step: "02", title: "Money grows tax-free", desc: "Invest in index funds — no capital gains tax", icon: "trending_up", color: GREEN },
                    { step: "03", title: "Withdraw tax-free", desc: "For any qualified medical expense — ever", icon: "payments", color: PURPLE },
                  ].map(s => (
                    <div key={s.step} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "22px", color: s.color, display: "block", marginBottom: "10px" }}>{s.icon}</span>
                      <div style={{ ...mono, fontSize: "9px", color: ACC_BRIGHT, letterSpacing: "0.1em", marginBottom: "6px" }}>STEP {s.step}</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>{s.title}</div>
                      <div style={{ fontSize: "11px", color: MID, lineHeight: 1.6 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Triple tax advantage */}
                <div style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: GREEN, marginBottom: "12px" }}>Triple Tax Advantage</div>
                  {[
                    { text: "Contribution is tax-deductible", detail: "Saves ~$1,075 in taxes on max contribution" },
                    { text: "Growth is tax-free", detail: "Invest in stocks, bonds, index funds with no capital gains" },
                    { text: "Withdrawals for medical are tax-free", detail: "No taxes when you use it for qualified expenses" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "10px", padding: "8px 0", borderBottom: i < 2 ? `1px solid ${BORDER}` : "none" }}>
                      <span style={{ color: GREEN, fontSize: "12px", flexShrink: 0, marginTop: "2px" }}>&#10003;</span>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700 }}>{item.text}</div>
                        <div style={{ fontSize: "11px", color: MID }}>{item.detail}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(26,19,19,0.03)", borderRadius: "8px", fontSize: "12px", color: AMBER, fontStyle: "italic" }}>
                    No other account gives you this. Not a 401(k), not an IRA, not a Roth.
                  </div>
                </div>

                {/* 2025 HSA limits */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>2025 HSA Contribution Limits</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {[
                      { label: "Individual", annual: "$4,300", monthly: "$358/mo" },
                      { label: "Family", annual: "$8,550", monthly: "$712/mo" },
                      { label: "Age 55+ Catch-Up", annual: "+$1,000", monthly: "+$83/mo" },
                    ].map(l => (
                      <div key={l.label} style={{ padding: "14px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "8px", textAlign: "center" }}>
                        <div style={{ ...mono, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, marginBottom: "6px" }}>{l.label}</div>
                        <div style={{ ...mono, fontSize: "18px", fontWeight: 500, color: GREEN }}>{l.annual}</div>
                        <div style={{ ...mono, fontSize: "10px", color: MUTED }}>{l.monthly}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What HSA pays for */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>What Your HSA Pays For</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                    {[
                      "Doctor visits", "Prescriptions", "Dental work", "Eye exams & glasses",
                      "Contacts", "Therapy", "Chiropractic", "Physical therapy",
                      "First aid supplies", "Sunscreen (SPF 15+)", "Feminine hygiene", "OTC medications",
                      "Lab tests", "X-rays & MRIs", "Ambulance", "LASIK surgery",
                      "Orthodontics", "Hearing aids", "Acupuncture", "Weight loss (Rx)",
                    ].map(item => (
                      <div key={item} style={{ padding: "8px 10px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "6px", fontSize: "10px", color: MID, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: GREEN, fontSize: "9px" }}>&#10003;</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Where to open */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "6px" }}>How to Open an HSA</div>
                  <p style={{ fontSize: "12px", color: MID, lineHeight: 1.7, marginBottom: "14px" }}>
                    You must have an HSA-eligible (High Deductible) health plan first. Then open an HSA at one of these providers:
                  </p>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {[
                      { name: "Fidelity HSA", note: "Free, best overall", href: "https://www.fidelity.com/go/hsa/why-hsa" },
                      { name: "Lively", note: "No fees, great app", href: "https://livelyme.com/" },
                      { name: "HealthEquity", note: "Largest HSA provider", href: "https://www.healthequity.com/" },
                    ].map(p => (
                      <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: "150px", padding: "12px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "8px", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: BLUE }}>open_in_new</span>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#1A1313" }}>{p.name}</div>
                          <div style={{ fontSize: "9px", color: MUTED }}>{p.note}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                {/* HSA interest */}
                <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "10px", padding: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "3px" }}>Want us to set up your HSA when StyleHealth launches?</div>
                    <div style={{ fontSize: "11px", color: MID }}>We&apos;ll help you open and fund your HSA automatically.</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => saveHsaInterest(true)} style={{ padding: "8px 16px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer", ...jakarta, background: hsaInterest ? GREEN : "transparent", border: `1px solid ${hsaInterest ? GREEN : BORDER2}`, color: hsaInterest ? "#fff" : MID }}>Yes</button>
                    <button onClick={() => saveHsaInterest(false)} style={{ padding: "8px 16px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer", ...jakarta, background: !hsaInterest ? "rgba(26,19,19,0.05)" : "transparent", border: `1px solid ${BORDER2}`, color: MID }}>No</button>
                  </div>
                </div>
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
