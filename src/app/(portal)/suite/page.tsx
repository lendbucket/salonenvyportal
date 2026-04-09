"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"

const mono: React.CSSProperties = { fontFamily: "'Fira Code', 'Courier New', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.07)"
const BORDER2 = "rgba(255,255,255,0.12)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#22c55e"

const APPS = [
  { id: "style-tax", name: "StyleTax", desc: "Track receipts, mileage, and quarterly taxes — built for 1099 stylists", price: "$40", period: "/mo", accent: "#7a8f96", icon: "receipt_long" },
  { id: "style-credit", name: "StyleCredit", desc: "Monitor your credit score, dispute errors, and build your credit profile", price: "$9", period: "/mo", accent: "#f59e0b", icon: "credit_score" },
  { id: "style-insure", name: "StyleInsure", desc: "Liability coverage and incident documentation for your booth", price: "$15", period: "/mo", accent: "#22c55e", icon: "shield" },
  { id: "style-edu", name: "StyleEdu", desc: "CE credits, TDLR license tracking, and professional development courses", price: "$19", period: "/mo", accent: "#3b82f6", icon: "school" },
  { id: "style-health", name: "StyleHealth", desc: "Health coverage options and HSA guidance for independent contractors", price: "$10", period: "/mo", accent: "#ec4899", icon: "favorite" },
]

export default function SuitePage() {
  const { isOwner } = useUserRole()
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    fetch("/api/suite/subscription")
      .then(r => r.json())
      .then(d => setHasAccess(d.hasAccess))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSubscribe = async () => {
    setSubscribing(true)
    const res = await fetch("/api/suite/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "monthly", paymentMethod: "paycheck_deduction" }),
    })
    const data = await res.json()
    if (data.subscription) setHasAccess(true)
    setSubscribing(false)
  }

  const canAccess = hasAccess || isOwner

  return (
    <div style={{ ...jakarta, backgroundColor: "#06080d", minHeight: "100%", color: "#fff", padding: "24px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`@media(max-width:767px){.suite-apps{grid-template-columns:1fr !important}}`}</style>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Envy Suite<sup style={{ fontSize: "50%", verticalAlign: "super", marginLeft: "1px", color: ACC_BRIGHT }}>&reg;</sup>
          </h1>
          <p style={{ fontSize: "14px", color: ACC_BRIGHT, margin: 0 }}>Professional tools for independent stylists</p>
        </div>

        {/* Subscription status */}
        {loading ? (
          <div style={{ height: "48px", backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: "10px", marginBottom: "24px", animation: "pulse 1.5s ease-in-out infinite" }} />
        ) : canAccess ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", backgroundColor: `${GREEN}08`, border: `1px solid ${GREEN}20`, borderRadius: "10px", marginBottom: "24px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: GREEN }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: GREEN }}>Active Subscriber</span>
            <span style={{ fontSize: "12px", color: MID, marginLeft: "auto" }}>All apps unlocked</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", backgroundColor: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "10px", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px" }}>Unlock all 5 apps</div>
              <div style={{ fontSize: "12px", color: MUTED }}>Subscribe to access the full Envy Suite</div>
            </div>
            <button onClick={handleSubscribe} disabled={subscribing} style={{ padding: "9px 20px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: subscribing ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {subscribing ? "Processing..." : "Subscribe"}
            </button>
          </div>
        )}

        {/* App cards */}
        <div className="suite-apps" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
          {APPS.map(app => (
            <div
              key={app.id}
              onClick={() => canAccess ? router.push(`/suite/${app.id}`) : undefined}
              style={{
                backgroundColor: "#0d1117",
                border: `1px solid rgba(26,35,50,0.8)`,
                borderLeft: `3px solid ${app.accent}`,
                borderRadius: "0 10px 10px 0",
                padding: "18px 20px",
                cursor: canAccess ? "pointer" : "default",
                opacity: canAccess ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: app.accent }}>{app.icon}</span>
                  <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.01em" }}>{app.name}</span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ ...mono, fontSize: "8px", padding: "2px 7px", borderRadius: "4px", backgroundColor: `${GREEN}10`, border: `1px solid ${GREEN}20`, color: GREEN, textTransform: "uppercase", letterSpacing: "0.06em" }}>Live</span>
                </div>
              </div>
              <p style={{ fontSize: "13px", color: ACC_BRIGHT, lineHeight: 1.5, margin: "0 0 12px" }}>{app.desc}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ ...mono, fontSize: "14px", fontWeight: 500, color: "#fff" }}>{app.price}<span style={{ fontSize: "10px", color: MUTED }}>{app.period}</span></span>
                {canAccess && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: ACC_BRIGHT, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "4px" }}>
                    Open <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_forward</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Combined value */}
        <div style={{ backgroundColor: "#0d1117", border: `1px solid rgba(26,35,50,0.8)`, borderRadius: "10px", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px" }}>All 5 apps</div>
            <div style={{ fontSize: "12px", color: MUTED }}>Tax, credit, insurance, education, and health</div>
          </div>
          <div style={{ ...mono, fontSize: "20px", fontWeight: 500, color: "#fff" }}>
            $93<span style={{ fontSize: "12px", color: MUTED }}>/mo total</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
