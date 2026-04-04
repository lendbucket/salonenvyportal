"use client"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useState } from "react"

export default function DashboardPage() {
  const { data: session } = useSession()
  const [activeLocation, setActiveLocation] = useState("Corpus Christi")
  const userName = session?.user?.name?.split(" ")[0] || "Robert"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  }).toUpperCase()

  const metrics = [
    { label: "Revenue This Week", value: "$0", icon: "payments", sub: "\u2194 0% vs last week" },
    { label: "Services This Week", value: "0", icon: "content_cut", sub: "Across all stylists" },
    { label: "New Clients", value: "0", icon: "person_add", sub: "This week" },
    { label: "Pending Approvals", value: "0", icon: "rule", sub: "Needs attention" },
  ]

  const statusCards = [
    { label: "Low Stock Items", sub: "Reorder suggested", icon: "inventory_2", count: 0 },
    { label: "Pending Schedules", sub: "Awaiting approval", icon: "event_note", count: 0 },
    { label: "Open Issues", sub: "Needs resolution", icon: "report_problem", count: 0 },
  ]

  const quickActions = [
    { href: "/inventory/add", icon: "add_box", label: "Add Inventory" },
    { href: "/schedule", icon: "calendar_today", label: "Build Schedule" },
    { href: "/approvals", icon: "task_alt", label: "Review Approvals" },
  ]

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px 24px" }}>

      {/* HERO HEADER */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{
          fontSize: "36px",
          fontWeight: 800,
          color: "#FFFFFF",
          margin: "0 0 6px 0",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}>
          {greeting}, {userName} <span aria-hidden>&#x1F44B;</span>
        </h1>
        <p style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "#94A3B8",
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          margin: 0,
        }}>
          {dateStr}
        </p>
      </div>

      {/* LOCATION TABS */}
      <div style={{
        display: "inline-flex",
        gap: "2px",
        backgroundColor: "#1a2a32",
        padding: "4px",
        borderRadius: "10px",
        marginBottom: "28px",
        border: "1px solid rgba(205,201,192,0.1)",
      }}>
        {["Corpus Christi", "San Antonio", "Both"].map((loc) => (
          <button
            key={loc}
            onClick={() => setActiveLocation(loc)}
            style={{
              padding: "8px 20px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              borderRadius: "7px",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeLocation === loc ? "#CDC9C0" : "transparent",
              color: activeLocation === loc ? "#0f1d24" : "rgba(205,201,192,0.5)",
              transition: "all 0.2s",
            }}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* METRIC CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
      }}>
        {metrics.map((m) => (
          <div key={m.label} style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(205,201,192,0.12)",
            borderRadius: "12px",
            padding: "24px",
            transition: "transform 0.2s, box-shadow 0.2s",
            cursor: "default",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <span style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#CDC9C0",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
              }}>
                {m.label}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "rgba(205,201,192,0.3)" }}>
                {m.icon}
              </span>
            </div>
            <div style={{
              fontSize: "40px",
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1,
              marginBottom: "8px",
              letterSpacing: "-0.02em",
            }}>
              {m.value}
            </div>
            <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 500 }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* STATUS CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
      }}>
        {statusCards.map((s) => (
          <div key={s.label} style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(205,201,192,0.12)",
            borderRadius: "12px",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "rgba(205,201,192,0.08)",
                border: "1px solid rgba(205,201,192,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#CDC9C0" }}>
                  {s.icon}
                </span>
              </div>
              <div>
                <div style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#CDC9C0",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  marginBottom: "3px",
                }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8" }}>{s.sub}</div>
              </div>
            </div>
            <div style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#FFFFFF",
              backgroundColor: "rgba(205,201,192,0.08)",
              width: "52px",
              height: "52px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {s.count}
            </div>
          </div>
        ))}
      </div>

      {/* QUICK ACTIONS */}
      <div style={{
        backgroundColor: "#1a2a32",
        border: "1px solid rgba(205,201,192,0.12)",
        borderRadius: "12px",
        padding: "20px 24px",
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "12px",
        alignItems: "center",
        marginBottom: "24px",
      }}>
        <span style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "rgba(205,201,192,0.4)",
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          marginRight: "8px",
        }}>
          Quick Actions
        </span>
        {quickActions.map(({ href, icon, label }) => (
          <Link key={href} href={href} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            backgroundColor: "transparent",
            border: "1px solid rgba(205,201,192,0.3)",
            borderRadius: "8px",
            color: "#CDC9C0",
            textDecoration: "none",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            transition: "all 0.15s",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{icon}</span>
            {label}
          </Link>
        ))}
        <Link href="/reyna-ai" style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 24px",
          backgroundColor: "#CDC9C0",
          borderRadius: "8px",
          color: "#0f1d24",
          textDecoration: "none",
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          marginLeft: "auto",
          boxShadow: "0 4px 12px rgba(205,201,192,0.2)",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>auto_awesome</span>
          Ask Reyna AI
        </Link>
      </div>

      {/* BENTO: ACTIVITY + ALERTS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "24px",
      }} className="lg:!grid-cols-[1fr_400px]">
        {/* Recent Activity */}
        <div style={{
          backgroundColor: "#1a2a32",
          border: "1px solid rgba(205,201,192,0.12)",
          borderRadius: "12px",
          padding: "28px",
          minHeight: "360px",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: 0 }}>
              Recent Activity
            </h3>
            <span className="material-symbols-outlined" style={{ color: "rgba(205,201,192,0.3)", fontSize: "20px" }}>history</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: "2px dashed rgba(205,201,192,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#CDC9C0" }}>sync</span>
            </div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 4px" }}>Awaiting Activity</p>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>The portal is synchronized.</p>
          </div>
        </div>

        {/* Admin Alerts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#CDC9C0", letterSpacing: "0.2em", textTransform: "uppercase" as const, margin: "0 0 4px" }}>
            Admin Alerts
          </h3>
          {[
            { priority: "URGENT", color: "#EF4444", icon: "priority_high", text: "End of month reconciliation due in 48 hours." },
            { priority: "HIGH", color: "#F59E0B", icon: "warning", text: "3 staff members have not confirmed their schedules." },
            { priority: "MEDIUM", color: "#CDC9C0", icon: "info", text: "Quarterly inventory audit scheduled for next Monday." },
          ].map((alert) => (
            <div key={alert.priority} style={{
              backgroundColor: "#1a2a32",
              border: "1px solid rgba(205,201,192,0.1)",
              borderLeft: `4px solid ${alert.color}`,
              borderRadius: "0 10px 10px 0",
              padding: "16px 18px",
              display: "flex",
              gap: "14px",
            }}>
              <span className="material-symbols-outlined" style={{ color: alert.color, fontSize: "20px", flexShrink: 0 }}>{alert.icon}</span>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: alert.color, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "4px" }}>
                  {alert.priority}
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.4 }}>{alert.text}</div>
              </div>
            </div>
          ))}
          <div style={{
            backgroundColor: "#0a151b",
            border: "1px solid rgba(205,201,192,0.1)",
            borderRadius: "10px",
            padding: "24px",
            textAlign: "center" as const,
          }}>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(205,201,192,0.3)", letterSpacing: "0.25em", textTransform: "uppercase" as const, marginBottom: "8px" }}>
              System Health
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", marginBottom: "12px" }}>Optimal</div>
            <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
              <div style={{ height: "3px", width: "32px", backgroundColor: "#CDC9C0", borderRadius: "4px" }} />
              <div style={{ height: "3px", width: "32px", backgroundColor: "rgba(205,201,192,0.2)", borderRadius: "4px" }} />
              <div style={{ height: "3px", width: "32px", backgroundColor: "rgba(205,201,192,0.2)", borderRadius: "4px" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
