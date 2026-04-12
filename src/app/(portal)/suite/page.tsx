"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"

const mono: React.CSSProperties = { fontFamily: "'Fira Code', 'Courier New', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const BORDER2 = "rgba(255,255,255,0.08)"
const CARD_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#22c55e"

const APPS = [
  { id: "style-tax", name: "StyleTax", desc: "Track receipts, mileage, and quarterly estimated taxes — built for 1099 stylists", price: "$40", accent: "#7a8f96", icon: "receipt_long" },
  { id: "style-credit", name: "StyleCredit", desc: "Monitor your credit score, dispute errors, and build your financial profile", price: "$9", accent: "#f59e0b", icon: "credit_score" },
  { id: "style-insure", name: "StyleInsure", desc: "Liability coverage options and incident documentation for your booth rental", price: "$15", accent: "#22c55e", icon: "shield" },
  { id: "style-edu", name: "StyleEdu", desc: "CE credits, TDLR license tracking, and professional development courses", price: "$19", accent: "#3b82f6", icon: "school" },
  { id: "style-health", name: "StyleHealth", desc: "Health coverage options and HSA guidance for independent contractors", price: "$10", accent: "#ec4899", icon: "favorite" },
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
    try {
      const res = await fetch("/api/suite/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "monthly", paymentMethod: "paycheck_deduction" }),
      })
      const data = await res.json()
      if (data.subscription) setHasAccess(true)
    } catch { /* noop */ }
    setSubscribing(false)
  }

  const canAccess = hasAccess || isOwner

  return (
    <div style={{ ...jakarta, backgroundColor: "#06080d", minHeight: "100%", color: "#fff", padding: "24px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`@media(max-width:767px){.suite-grid-2{grid-template-columns:1fr !important}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Envy Suite</h1>
          <p style={{ fontSize: "14px", color: ACC_BRIGHT, margin: 0 }}>Professional tools built for independent stylists</p>
        </div>

        {/* Subscription status */}
        {loading ? (
          <div style={{ height: "52px", backgroundColor: "#0d1117", border: "1px solid #1a2332", borderRadius: "12px", marginBottom: "24px", animation: "pulse 1.5s ease-in-out infinite" }} />
        ) : canAccess ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", backgroundColor: "#0d1117", border: "1px solid #1a2332", borderRadius: "12px", marginBottom: "24px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: GREEN }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: GREEN }}>Active Subscriber</span>
            <span style={{ fontSize: "12px", color: MID, marginLeft: "auto" }}>All apps unlocked</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", backgroundColor: "#0d1117", border: "1px solid #1a2332", borderRadius: "12px", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px" }}>Unlock all 5 apps</div>
              <div style={{ fontSize: "12px", color: MUTED }}>Subscribe to access the full Envy Suite</div>
            </div>
            <button onClick={handleSubscribe} disabled={subscribing} style={{ padding: "9px 20px", border: `1px solid ${ACC}`, borderRadius: "8px", backgroundColor: "transparent", color: ACC_BRIGHT, fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: subscribing ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {subscribing ? "Processing..." : "Subscribe"}
            </button>
          </div>
        )}

        {/* App cards */}
        <div className="suite-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "28px" }}>
          {APPS.map(app => (
            <div
              key={app.id}
              onClick={() => canAccess ? router.push(`/suite/${app.id}`) : undefined}
              style={{
                backgroundColor: "#0d1117",
                border: "1px solid #1a2332",
                borderLeft: `3px solid ${app.accent}`,
                borderRadius: "0 12px 12px 0",
                padding: "20px",
                cursor: canAccess ? "pointer" : "default",
                opacity: canAccess ? 1 : 0.5,
                transition: "opacity 0.15s",
              }}
            >
              {/* Name row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: app.accent }}>{app.icon}</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{app.name}</span>
                </div>
                <span style={{ ...mono, fontSize: "8px", padding: "2px 8px", borderRadius: "4px", backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: GREEN, textTransform: "uppercase", letterSpacing: "0.06em" }}>Live</span>
              </div>

              {/* Description */}
              <p style={{ fontSize: "13px", color: ACC_BRIGHT, lineHeight: 1.55, margin: "0 0 14px" }}>{app.desc}</p>

              {/* Price + Open */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ ...mono, fontSize: "14px", fontWeight: 500, color: "#fff" }}>{app.price}<span style={{ fontSize: "10px", color: MUTED }}>/mo</span></span>
                {canAccess && (
                  <button style={{ padding: "5px 14px", border: `1px solid ${ACC}`, borderRadius: "6px", backgroundColor: "transparent", color: ACC_BRIGHT, fontSize: "11px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "4px", ...jakarta }}>
                    Open <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_forward</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Combined value footer */}
        <div style={{ backgroundColor: "#0d1117", border: "1px solid #1a2332", borderRadius: "12px", padding: "18px 22px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
            {APPS.map(app => (
              <span key={app.id} style={{ ...mono, fontSize: "10px", padding: "3px 10px", borderRadius: "6px", backgroundColor: `${app.accent}10`, border: `1px solid ${app.accent}25`, color: app.accent }}>
                {app.name} {app.price}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BORDER2}`, paddingTop: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: MID }}>All 5 apps</span>
            <span style={{ ...mono, fontSize: "20px", fontWeight: 500, color: "#fff" }}>$93<span style={{ fontSize: "11px", color: MUTED }}>/mo for all 5 apps</span></span>
          </div>
        </div>
      </div>

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
