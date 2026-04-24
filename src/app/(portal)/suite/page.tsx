"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"
import { Receipt, CreditCard, Shield, GraduationCap, Heart, ArrowUpRight, Sparkles } from "lucide-react"

const GREEN = "#22c55e"

const APPS = [
  { id: "style-tax", name: "StyleTax", desc: "Track receipts, mileage, and quarterly estimated taxes — built for 1099 stylists", price: "$40", icon: Receipt, iconBg: "rgba(122,143,150,0.1)", iconColor: "#7a8f96" },
  { id: "style-credit", name: "StyleCredit", desc: "Monitor your credit score, dispute errors, and build your financial profile", price: "$9", icon: CreditCard, iconBg: "rgba(59,130,246,0.08)", iconColor: "#3b82f6" },
  { id: "style-insure", name: "StyleInsure", desc: "Liability coverage options and incident documentation for your booth rental", price: "$15", icon: Shield, iconBg: "rgba(34,197,94,0.08)", iconColor: "#16a34a" },
  { id: "style-edu", name: "StyleEdu", desc: "CE credits, TDLR license tracking, and professional development courses", price: "$19", icon: GraduationCap, iconBg: "rgba(168,85,247,0.08)", iconColor: "#9333ea" },
  { id: "style-health", name: "StyleHealth", desc: "Health coverage options and HSA guidance for independent contractors", price: "$10", icon: Heart, iconBg: "rgba(239,68,68,0.08)", iconColor: "#dc2626" },
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
    <div style={{ padding: 32, background: "#F4F5F7", minHeight: "calc(100vh - 56px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "Inter", fontSize: 24, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px", margin: 0 }}>Envy Suite</h1>
          <p style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 400, color: "rgba(26,19,19,0.45)", marginTop: 3 }}>Professional tools built for independent stylists</p>
        </div>

        {/* Subscriber status */}
        {loading ? (
          <div className="skeleton" style={{ height: 52, borderRadius: 12, marginBottom: 32 }} />
        ) : canAccess ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px",
            background: "rgba(122,143,150,0.06)", border: "1px solid rgba(122,143,150,0.2)", borderRadius: 12, marginBottom: 32,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.15)" }} />
              <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: "#15803d" }}>Active Subscriber</span>
            </div>
            <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.45)" }}>All apps unlocked</span>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px",
            background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, marginBottom: 32,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)", flexWrap: "wrap" as const, gap: 12,
          }}>
            <div>
              <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: "#1A1313", marginBottom: 2 }}>Unlock all 5 apps</div>
              <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "rgba(26,19,19,0.45)" }}>Subscribe to access the full Envy Suite</div>
            </div>
            <button onClick={handleSubscribe} disabled={subscribing} style={{
              height: 40, padding: "0 20px", borderRadius: 8, background: "#7a8f96", border: "1px solid #7a8f96",
              color: "#FBFBFB", fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 1px 2px rgba(122,143,150,0.3)", opacity: subscribing ? 0.6 : 1, whiteSpace: "nowrap" as const,
            }}>
              {subscribing ? "Processing..." : "Subscribe"}
            </button>
          </div>
        )}

        {/* Section label */}
        <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 16 }}>Apps</div>

        {/* App cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
          {APPS.map(app => {
            const Icon = app.icon
            return (
              <div
                key={app.id}
                onClick={() => canAccess ? router.push(`/suite/${app.id}`) : undefined}
                style={{
                  background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 14, padding: 24,
                  display: "flex", flexDirection: "column" as const,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04)",
                  transition: "all 0.2s ease", cursor: canAccess ? "pointer" : "default", opacity: canAccess ? 1 : 0.5,
                }}
                onMouseEnter={e => { if (canAccess) { e.currentTarget.style.borderColor = "rgba(122,143,150,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.07), 0 8px 16px rgba(0,0,0,0.05)" } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(26,19,19,0.07)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04)" }}
              >
                {/* Top row: icon + LIVE badge */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: app.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={20} color={app.iconColor} strokeWidth={1.5} />
                  </div>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 20,
                    background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                    color: "#15803d", fontSize: 10, fontWeight: 700, fontFamily: "Inter", letterSpacing: "0.06em", textTransform: "uppercase" as const,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />Live
                  </span>
                </div>

                {/* Name + description */}
                <div style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px", marginBottom: 6 }}>{app.name}</div>
                <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.55)", lineHeight: 1.5, marginBottom: 20, minHeight: 48 }}>{app.desc}</div>

                {/* Bottom: price + open */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid rgba(26,19,19,0.06)", marginTop: "auto" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px" }}>{app.price}</span>
                    <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.4)" }}>/mo</span>
                  </div>
                  {canAccess && (
                    <span style={{
                      height: 34, padding: "0 14px", borderRadius: 8, background: "#7a8f96", border: "1px solid #7a8f96",
                      color: "#FBFBFB", fontFamily: "Inter", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
                      boxShadow: "0 1px 2px rgba(122,143,150,0.25)",
                    }}>
                      Open <ArrowUpRight size={13} />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bundle section */}
        <div style={{
          background: "#FBFBFB", border: "1px solid rgba(122,143,150,0.15)", borderRadius: 14, padding: 24, position: "relative" as const, overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)",
        }}>
          {/* Accent strip */}
          <div style={{ position: "absolute" as const, top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #7a8f96 0%, #9aafb7 50%, #7a8f96 100%)" }} />

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px" }}>All 5 Apps Bundle</div>
              <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.45)", marginTop: 2 }}>Best value for independent stylists</div>
            </div>
            <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(122,143,150,0.1)", border: "1px solid rgba(122,143,150,0.25)", color: "#7a8f96", fontSize: 11, fontWeight: 700, fontFamily: "Inter", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Best Value</span>
          </div>

          {/* App pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 20 }}>
            {APPS.map(app => (
              <span key={app.id} style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(26,19,19,0.04)", border: "1px solid rgba(26,19,19,0.08)", fontFamily: "Inter", fontSize: 12, fontWeight: 500, color: "rgba(26,19,19,0.6)" }}>
                {app.name} {app.price}
              </span>
            ))}
          </div>

          {/* Price + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid rgba(26,19,19,0.06)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "Inter", fontSize: 28, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px" }}>$93</span>
              <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 400, color: "rgba(26,19,19,0.4)" }}>/mo for all 5 apps</span>
            </div>
            {!canAccess && (
              <button onClick={handleSubscribe} disabled={subscribing} style={{
                height: 40, padding: "0 20px", borderRadius: 8, background: "#7a8f96", border: "1px solid #7a8f96",
                color: "#FBFBFB", fontFamily: "Inter", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8,
                cursor: "pointer", boxShadow: "0 1px 3px rgba(122,143,150,0.3)", opacity: subscribing ? 0.6 : 1,
              }}>
                <Sparkles size={14} />{subscribing ? "Processing..." : "Subscribe Now"}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`@media(max-width:767px){.suite-grid-2{grid-template-columns:1fr !important}}`}</style>
    </div>
  )
}
