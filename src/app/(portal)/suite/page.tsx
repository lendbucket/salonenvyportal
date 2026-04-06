"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useUserRole } from "@/hooks/useUserRole"

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.07)"
const BORDER2 = "rgba(255,255,255,0.12)"
const S1 = "rgba(255,255,255,0.03)"
const S2 = "rgba(255,255,255,0.05)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"

const APPS = [
  { id: "style-credit", name: "StyleCredit", tag: "Credit Builder", icon: "credit_score", dotColor: "#4da6ff", features: ["Reported to all 3 bureaus", "Income verification letters"], price: "$0", period: "included", live: true },
  { id: "style-insure", name: "StyleInsure", tag: "Professional Liability", icon: "shield", dotColor: "#ffb347", features: ["$1M professional liability", "Chemical incidents covered"], price: "$15", period: "/ month", live: true },
  { id: "style-edu", name: "StyleEdu", tag: "CE Credits + Education", icon: "school", dotColor: "#a78bfa", features: ["TDLR CE credits tracked", "License renewal reminders"], price: "$0", period: "included", live: true },
  { id: "style-health", name: "StyleHealth", tag: "Group Health Insurance", icon: "favorite", dotColor: "#ff6b6b", features: ["Group rates as contractor", "Dental and vision included"], price: "$25", period: "/ month", live: false },
]

export default function SuitePage() {
  const { isOwner } = useUserRole()
  const { data: session } = useSession()
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [subCount, setSubCount] = useState(0)

  useEffect(() => {
    fetch("/api/suite/subscription").then(r => r.json()).then(d => { setHasAccess(d.hasAccess); if (d.subCount) setSubCount(d.subCount) })
  }, [])

  const handleSubscribe = async (plan: string) => {
    setSubscribing(true)
    const res = await fetch("/api/suite/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, paymentMethod: "paycheck_deduction" }) })
    const data = await res.json()
    if (data.subscription) { setHasAccess(true); setShowModal(false) }
    setSubscribing(false)
  }

  const mono: React.CSSProperties = { fontFamily: "'Fira Code', monospace" }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#06080d", color: "#fff", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "800px", height: "400px", background: "radial-gradient(ellipse at 50% 0%, rgba(96,110,116,0.1) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1000px", margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(16px,4vw,32px)" }}>

        {isOwner && (
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <span style={{ ...mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 14px", borderRadius: "100px", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT }}>Owner Access</span>
          </div>
        )}

        {/* HERO */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          {!isOwner && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 14px", borderRadius: "100px", border: `1px solid ${ACC_BORDER}`, background: ACC_DIM, marginBottom: "28px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ACC, boxShadow: `0 0 6px ${ACC}`, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ ...mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: ACC_BRIGHT }}>For Salon Envy Professionals</span>
            </div>
          )}

          <h1 style={{ fontSize: "clamp(36px,6vw,64px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.0, margin: "0 0 18px" }}>
            <span style={{ background: "linear-gradient(135deg,#fff 40%,rgba(255,255,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Envy Suite</span>
            <sup style={{ fontSize: "40%", WebkitTextFillColor: ACC_BRIGHT, background: "none", verticalAlign: "super", marginLeft: "2px" }}>&reg;</sup>
          </h1>

          {!isOwner && (
            <>
              <p style={{ fontSize: "16px", color: MID, maxWidth: "460px", margin: "0 auto 28px", lineHeight: 1.7, fontWeight: 300 }}>Five professional tools built exclusively for 1099 beauty professionals. No one else has done this — until now.</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginBottom: "28px" }}>
                <button onClick={() => hasAccess ? router.push("/suite/style-tax") : setShowModal(true)} style={{ padding: "11px 24px", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, color: "#fff", boxShadow: "0 0 20px rgba(96,110,116,0.25)" }}>{hasAccess ? "Open StyleTax" : "Subscribe — $40/mo"}</button>
                <button style={{ padding: "11px 24px", background: S1, color: MID, border: `1px solid ${BORDER2}`, borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>Learn more</button>
              </div>
            </>
          )}

          {isOwner && <p style={{ fontSize: "15px", color: MID, margin: "0 auto 24px", maxWidth: "460px", lineHeight: 1.7, fontWeight: 300 }}>Premium tools for your stylists. As owner you have full access to all apps.</p>}

          {!isOwner && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "14px", padding: "12px 18px", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", maxWidth: "600px", margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ ...mono, fontSize: "12px", color: ACC_BRIGHT, padding: "4px 12px", background: "rgba(96,110,116,0.1)", border: `1px solid ${ACC_BORDER}`, borderRadius: "100px", flexShrink: 0, fontWeight: 500 }}>+40-80 pts credit score</span>
              <span style={{ fontSize: "12px", color: MID, lineHeight: 1.6 }}>Your <strong style={{ color: ACC_BRIGHT, fontWeight: 600 }}>subscription payments</strong> are reported to all 3 credit bureaus — building your score at zero extra cost.</span>
            </div>
          )}
        </div>

        {isOwner && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "32px" }}>
            {[
              { label: "Active Subscribers", value: subCount.toString(), color: ACC_BRIGHT },
              { label: "Monthly Revenue", value: `$${(subCount * 40).toLocaleString()}`, color: "#10B981" },
              { label: "Annual Run Rate", value: `$${(subCount * 40 * 12).toLocaleString()}`, color: ACC_BRIGHT },
            ].map(s => (
              <div key={s.label} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px" }}>
                <div style={{ ...mono, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "8px" }}>{s.label}</div>
                <div style={{ ...mono, fontSize: "24px", fontWeight: 500, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...mono, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: MUTED, display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>Five apps. One subscription.<div style={{ flex: 1, height: "1px", background: BORDER }} /></div>

        {/* STYLETAX FEATURED */}
        <div onClick={() => (hasAccess || isOwner) ? router.push("/suite/style-tax") : setShowModal(true)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "16px", overflow: "hidden", marginBottom: "12px", boxShadow: "0 0 40px rgba(96,110,116,0.06)", cursor: "pointer" }}>
          <div style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "22px", color: ACC_BRIGHT }}>receipt_long</span>
              </div>
              <span style={{ ...mono, fontSize: "9px", padding: "3px 8px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.08em", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT }}>Live</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "4px", background: "linear-gradient(135deg,#fff,rgba(255,255,255,0.7))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>StyleTax</div>
            <div style={{ fontSize: "11px", color: MUTED, marginBottom: "18px" }}>Tax Samurai for 1099 Stylists</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {["AI receipt scanner — auto-categorizes deductions", "Mileage tracker at $0.70/mile IRS rate", "Quarterly tax calculator + IRS Direct Pay", "Complete Schedule C ready for your CPA"].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "9px", fontSize: "12px", color: MID }}>
                  <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: ACC, flexShrink: 0, marginTop: "5px" }} />
                  {f}
                </div>
              ))}
            </div>
            <div style={{ ...mono, fontSize: "22px", fontWeight: 500, marginTop: "20px", color: "#fff" }}>$40 <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>/ month</span></div>
          </div>
          <div style={{ background: S2, borderLeft: `1px solid ${BORDER}`, padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ ...mono, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "14px" }}>Tax snapshot — 2025</div>
              {[
                { label: "Gross income", value: "$38,400", color: "#fff", barW: "100%", barC: "rgba(255,255,255,0.08)" },
                { label: "Deductions", value: "\u2212$12,840", color: ACC_BRIGHT, barW: "33%", barC: "rgba(96,110,116,0.5)" },
                { label: "Taxable income", value: "$23,800", color: "#CDC9C0", barW: "62%", barC: "rgba(205,201,192,0.1)" },
              ].map((row, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
                    <span style={{ color: MUTED }}>{row.label}</span>
                    <span style={{ ...mono, fontSize: "11px", color: row.color }}>{row.value}</span>
                  </div>
                  <div style={{ height: "2px", background: "rgba(255,255,255,0.04)", borderRadius: "1px", marginBottom: "8px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: row.barW, background: row.barC, borderRadius: "1px" }} />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", paddingTop: "10px", borderTop: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: "12px", fontWeight: 600 }}>Tax saved</span>
                <span style={{ ...mono, fontSize: "16px", color: ACC_BRIGHT, fontWeight: 500 }}>$4,230</span>
              </div>
            </div>
            <div>
              <div style={{ ...mono, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, margin: "18px 0 10px" }}>Latest scan</div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "28px", height: "36px", background: "rgba(255,255,255,0.04)", borderRadius: "3px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px", flexShrink: 0 }}>
                  {[16, 12, 14, 10].map((w, i) => <div key={i} style={{ height: "2px", width: `${w}px`, background: "rgba(255,255,255,0.1)", borderRadius: "1px" }} />)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>Salon Centric</div>
                  <div style={{ ...mono, fontSize: "9px", color: MUTED }}>Line 22 · Supplies · 100%</div>
                </div>
                <div style={{ ...mono, fontSize: "13px", color: ACC_BRIGHT, fontWeight: 500 }}>$127.50</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 SMALL CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "40px" }}>
          {APPS.map(app => {
            const unlocked = app.live && (hasAccess || isOwner)
            return (
              <div key={app.id} onClick={() => unlocked ? router.push(`/suite/${app.id}`) : undefined} style={{ background: S1, border: `1px solid ${unlocked ? ACC_BORDER : BORDER}`, borderRadius: "12px", padding: "20px", position: "relative", overflow: "hidden", cursor: unlocked ? "pointer" : "default", boxShadow: unlocked ? "0 0 30px rgba(96,110,116,0.06)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "9px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: app.dotColor }}>{app.icon}</span>
                  </div>
                  <span style={{ ...mono, fontSize: "9px", padding: "3px 8px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.08em", background: unlocked ? ACC_DIM : S1, border: `1px solid ${unlocked ? ACC_BORDER : BORDER}`, color: unlocked ? ACC_BRIGHT : MUTED }}>{unlocked ? "Live" : "Soon"}</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "2px" }}>{app.name}</div>
                <div style={{ fontSize: "10px", color: MUTED, marginBottom: "12px" }}>{app.tag}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", opacity: unlocked ? 1 : 0.5 }}>
                  {app.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", color: MID }}>
                      <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: app.dotColor, flexShrink: 0 }} />
                      {f}
                    </div>
                  ))}
                </div>
                <div style={{ ...mono, fontSize: "15px", fontWeight: 500, marginTop: "14px", color: ACC_BRIGHT }}>{app.price}<span style={{ fontSize: "10px", color: MUTED, fontWeight: 400 }}> {app.period}</span></div>
                {!unlocked && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,13,0.72)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", borderRadius: "11px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px", color: MUTED }}>lock</span>
                    <span style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED }}>Coming soon</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ ...mono, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: MUTED, display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>Pricing<div style={{ flex: 1, height: "1px", background: BORDER }} /></div>

        {/* PRICING */}
        {!isOwner && !hasAccess && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxWidth: "460px", margin: "0 auto 24px" }}>
              {[
                { id: "monthly", label: "Monthly", price: "$40", per: "per month", note: "or $10/paycheck", best: false },
                { id: "annual", label: "Annual", price: "$399", per: "per year", note: "save $81 vs monthly", best: true },
              ].map(plan => (
                <div key={plan.id} style={{ background: S1, border: `1px solid ${plan.best ? ACC_BORDER : BORDER}`, borderRadius: "12px", padding: "22px", position: "relative", boxShadow: plan.best ? "0 0 30px rgba(96,110,116,0.08)" : "none" }}>
                  {plan.best && <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", ...mono, fontSize: "9px", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 12px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, color: "#fff", borderRadius: "100px", whiteSpace: "nowrap" }}>Best value</div>}
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>{plan.label}</div>
                  <div style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1, marginBottom: "4px", background: "linear-gradient(135deg,#fff,rgba(255,255,255,0.7))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{plan.price}</div>
                  <div style={{ fontSize: "11px", color: MUTED, marginBottom: "5px" }}>{plan.per}</div>
                  <div style={{ ...mono, fontSize: "10px", color: ACC_BRIGHT, marginBottom: "18px" }}>{plan.note}</div>
                  <button onClick={() => handleSubscribe(plan.id)} disabled={subscribing} style={{ width: "100%", padding: "9px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, cursor: "pointer", ...(plan.best ? { background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, color: "#fff", border: "none", boxShadow: "0 0 15px rgba(96,110,116,0.2)" } : { background: "transparent", color: MID, border: `1px solid ${BORDER}` }) }}>{subscribing ? "Processing..." : "Get started"}</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
              {["Builds your credit score", "Cancel anytime", "Deducted from paycheck", "TX — no state income tax"].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: MUTED }}>
                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke={ACC_BRIGHT} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </>
        )}

        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
            <div style={{ background: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "420px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: 800, textAlign: "center", marginBottom: "8px", letterSpacing: "-0.03em" }}>Join Envy Suite<sup style={{ fontSize: "50%", color: ACC_BRIGHT }}>&reg;</sup></h3>
              <p style={{ fontSize: "13px", color: MID, textAlign: "center", marginBottom: "24px", lineHeight: 1.6 }}>Unlock StyleTax, credit building, and all premium tools. Deducted from your paycheck.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                <button onClick={() => handleSubscribe("monthly")} disabled={subscribing} style={{ padding: "13px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "9px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Start Monthly — $40/mo</button>
                <button onClick={() => handleSubscribe("annual")} disabled={subscribing} style={{ padding: "13px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "9px", color: MID, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Annual Plan — $399/yr (save $81)</button>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: "100%", padding: "10px", background: "transparent", border: "none", color: MUTED, fontSize: "12px", cursor: "pointer" }}>Not right now</button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 6px ${ACC}} 50%{opacity:0.3;box-shadow:none} }`}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
