"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUserRole } from "@/hooks/useUserRole"

type Subscription = { id: string; plan: string; price: number; status: string } | null
type Stats = { totalSubscribers: number; monthlyRevenue: number } | null

const APPS = [
  {
    id: "style-tax",
    name: "StyleTax",
    tagline: "AI-powered tax management for stylists",
    color: "#22c55e",
    gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    icon: "receipt_long",
    price: "Included",
    available: true,
    benefits: [
      "AI receipt scanner with instant categorization",
      "Mileage tracker at IRS $0.70/mile rate",
      "Quarterly tax estimates & payment reminders",
      "Comprehensive deduction guide for stylists",
      "Year-end tax summary export",
    ],
  },
  {
    id: "style-credit",
    name: "StyleCredit",
    tagline: "Build business credit as you grow",
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    icon: "credit_score",
    price: "Coming Soon",
    available: false,
    benefits: [
      "Business credit score monitoring",
      "Tradeline reporting to bureaus",
      "Credit-building payment plans",
      "Loan pre-qualification tools",
    ],
  },
  {
    id: "style-insure",
    name: "StyleInsure",
    tagline: "Professional liability & health coverage",
    color: "#eab308",
    gradient: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
    icon: "shield",
    price: "Coming Soon",
    available: false,
    benefits: [
      "Professional liability insurance",
      "Health insurance marketplace",
      "Equipment protection plans",
      "Workers comp alternatives",
    ],
  },
  {
    id: "style-edu",
    name: "StyleEdu",
    tagline: "Continuing education & certifications",
    color: "#a855f7",
    gradient: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
    icon: "school",
    price: "Coming Soon",
    available: false,
    benefits: [
      "CE credit tracking",
      "Online course library",
      "Certification management",
      "Tax-deductible education expenses",
    ],
  },
  {
    id: "style-health",
    name: "StyleHealth",
    tagline: "Wellness & ergonomic support",
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    icon: "favorite",
    price: "Coming Soon",
    available: false,
    benefits: [
      "Ergonomic assessment tools",
      "Mental health resources",
      "Fitness & wellness discounts",
      "Health savings account integration",
    ],
  },
]

export default function SuitePage() {
  const { data: session } = useSession()
  const { isOwner } = useUserRole()
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription>(null)
  const [stats, setStats] = useState<Stats>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    fetch("/api/suite/subscription")
      .then((r) => r.json())
      .then((data) => {
        setHasAccess(data.hasAccess)
        setSubscription(data.subscription)
        setStats(data.stats)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSubscribe = async (plan: "monthly" | "annual") => {
    setSubscribing(true)
    try {
      const res = await fetch("/api/suite/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      setSubscription(data.subscription)
      setHasAccess(true)
      setShowModal(false)
    } catch {
      // handle error
    } finally {
      setSubscribing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "rgba(205,201,192,0.5)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "32px", animation: "spin 1s linear infinite" }}>progress_activity</span>
        <p style={{ marginTop: "12px", fontSize: "13px" }}>Loading Envy Suite...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#CDC9C0" }}>diamond</span>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Envy Suite</h1>
          {hasAccess && (
            <span style={{
              padding: "4px 12px",
              borderRadius: "20px",
              backgroundColor: "rgba(34,197,94,0.15)",
              color: "#22c55e",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              {isOwner ? "Owner Access" : "Active"}
            </span>
          )}
        </div>
        <p style={{ color: "rgba(205,201,192,0.6)", fontSize: "14px", margin: 0 }}>
          Premium tools designed exclusively for beauty professionals. Manage taxes, build credit, and grow your career.
        </p>
      </div>

      {/* Owner Stats */}
      {isOwner && stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}>
          <div style={{
            padding: "20px",
            borderRadius: "12px",
            backgroundColor: "rgba(205,201,192,0.04)",
            border: "1px solid rgba(205,201,192,0.1)",
          }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>Active Subscribers</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#FFFFFF" }}>{stats.totalSubscribers}</div>
          </div>
          <div style={{
            padding: "20px",
            borderRadius: "12px",
            backgroundColor: "rgba(205,201,192,0.04)",
            border: "1px solid rgba(205,201,192,0.1)",
          }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>Monthly Revenue</div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#22c55e" }}>${stats.monthlyRevenue.toFixed(0)}</div>
          </div>
        </div>
      )}

      {/* Credit Building Callout */}
      {!isOwner && !hasAccess && (
        <div style={{
          padding: "20px 24px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(147,51,234,0.1) 100%)",
          border: "1px solid rgba(59,130,246,0.2)",
          marginBottom: "28px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#3b82f6" }}>trending_up</span>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>Build Your Financial Future</div>
            <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.6)" }}>
              Subscribe to Envy Suite and start building business credit, tracking deductions, and saving on taxes from day one.
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              backgroundColor: "#CDC9C0",
              color: "#0f1d24",
              border: "none",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Subscribe Now
          </button>
        </div>
      )}

      {/* App Cards Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "20px",
        marginBottom: "32px",
      }}>
        {APPS.map((app) => {
          const locked = !hasAccess && !isOwner
          return (
            <div
              key={app.id}
              style={{
                borderRadius: "16px",
                overflow: "hidden",
                backgroundColor: "rgba(205,201,192,0.03)",
                border: "1px solid rgba(205,201,192,0.1)",
                position: "relative",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              {/* Gradient Header */}
              <div style={{
                background: app.gradient,
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#FFFFFF" }}>{app.icon}</span>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#FFFFFF" }}>{app.name}</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>{app.tagline}</div>
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: 700,
                }}>
                  {app.price}
                </div>
              </div>

              {/* Benefits */}
              <div style={{ padding: "20px 24px" }}>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {app.benefits.map((b, i) => (
                    <li key={i} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      padding: "6px 0",
                      fontSize: "12px",
                      color: "rgba(205,201,192,0.7)",
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px", color: app.color, marginTop: "1px" }}>check_circle</span>
                      {b}
                    </li>
                  ))}
                </ul>

                {/* Action */}
                <div style={{ marginTop: "16px" }}>
                  {app.available && (hasAccess || isOwner) ? (
                    <Link
                      href={`/suite/${app.id}`}
                      style={{
                        display: "block",
                        textAlign: "center",
                        padding: "10px",
                        borderRadius: "8px",
                        backgroundColor: app.color,
                        color: "#FFFFFF",
                        textDecoration: "none",
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Open {app.name}
                    </Link>
                  ) : app.available && locked ? (
                    <button
                      onClick={() => setShowModal(true)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(205,201,192,0.08)",
                        border: "1px solid rgba(205,201,192,0.15)",
                        color: "rgba(205,201,192,0.5)",
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      Subscribe to Unlock
                    </button>
                  ) : (
                    <div style={{
                      textAlign: "center",
                      padding: "10px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(205,201,192,0.04)",
                      border: "1px solid rgba(205,201,192,0.08)",
                      color: "rgba(205,201,192,0.3)",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}>
                      Coming Soon
                    </div>
                  )}
                </div>
              </div>

              {/* Lock overlay for non-subscribers on available apps */}
              {locked && app.available && (
                <div
                  onClick={() => setShowModal(true)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(10,21,32,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    borderRadius: "16px",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "rgba(205,201,192,0.4)" }}>lock</span>
                    <div style={{ color: "rgba(205,201,192,0.5)", fontSize: "11px", fontWeight: 700, marginTop: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Subscribe to Access
                    </div>
                  </div>
                </div>
              )}

              {/* Lock overlay for coming soon */}
              {!app.available && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(10,21,32,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "16px",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "rgba(205,201,192,0.3)" }}>hourglass_top</span>
                    <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "11px", fontWeight: 700, marginTop: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Coming Soon
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Subscribe Modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#1a2a32",
              borderRadius: "16px",
              border: "1px solid rgba(205,201,192,0.15)",
              padding: "32px",
              maxWidth: "480px",
              width: "100%",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#CDC9C0" }}>diamond</span>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#FFFFFF", margin: "12px 0 8px" }}>Subscribe to Envy Suite</h2>
              <p style={{ fontSize: "13px", color: "rgba(205,201,192,0.6)", margin: 0 }}>
                Unlock all premium tools and start optimizing your business today.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
              {/* Monthly */}
              <button
                onClick={() => handleSubscribe("monthly")}
                disabled={subscribing}
                style={{
                  flex: 1,
                  minWidth: "180px",
                  padding: "20px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(205,201,192,0.06)",
                  border: "2px solid rgba(205,201,192,0.2)",
                  cursor: subscribing ? "not-allowed" : "pointer",
                  textAlign: "center",
                  opacity: subscribing ? 0.6 : 1,
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>Monthly</div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#FFFFFF" }}>$40</div>
                <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)" }}>per month</div>
              </button>

              {/* Annual */}
              <button
                onClick={() => handleSubscribe("annual")}
                disabled={subscribing}
                style={{
                  flex: 1,
                  minWidth: "180px",
                  padding: "20px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(34,197,94,0.08)",
                  border: "2px solid rgba(34,197,94,0.3)",
                  cursor: subscribing ? "not-allowed" : "pointer",
                  textAlign: "center",
                  opacity: subscribing ? 0.6 : 1,
                  position: "relative",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: "-10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  padding: "2px 10px",
                  borderRadius: "10px",
                  backgroundColor: "#22c55e",
                  color: "#FFFFFF",
                  fontSize: "9px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}>
                  Save $81/yr
                </div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>Annual</div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#FFFFFF" }}>$399</div>
                <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)" }}>per year ($33.25/mo)</div>
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                backgroundColor: "transparent",
                border: "1px solid rgba(205,201,192,0.1)",
                color: "rgba(205,201,192,0.4)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
