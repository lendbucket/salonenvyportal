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
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>

      {/* HERO HEADER */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          fontSize: "32px",
          fontWeight: 800,
          color: "#FFFFFF",
          margin: "0 0 5px 0",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}>
          {greeting}, {userName} <span aria-hidden>&#x1F44B;</span>
        </h1>
        <p style={{
          fontSize: "11px",
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
        padding: "3px",
        borderRadius: "8px",
        marginBottom: "24px",
        border: "1px solid rgba(205,201,192,0.08)",
      }}>
        {["Corpus Christi", "San Antonio", "Both"].map((loc) => (
          <button
            key={loc}
            onClick={() => setActiveLocation(loc)}
            style={{
              padding: "7px 16px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeLocation === loc ? "#CDC9C0" : "transparent",
              color: activeLocation === loc ? "#0f1d24" : "rgba(205,201,192,0.45)",
              transition: "all 0.15s",
            }}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* METRIC CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "14px",
        marginBottom: "20px",
      }}>
        {metrics.map((m) => (
          <div key={m.label} style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(205,201,192,0.1)",
            borderRadius: "10px",
            padding: "20px",
            transition: "transform 0.15s, box-shadow 0.15s",
            cursor: "default",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <span style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "#CDC9C0",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
              }}>
                {m.label}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "rgba(205,201,192,0.25)" }}>
                {m.icon}
              </span>
            </div>
            <div style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1,
              marginBottom: "6px",
              letterSpacing: "-0.02em",
            }}>
              {m.value}
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500 }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* STATUS CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "14px",
        marginBottom: "20px",
      }}>
        {statusCards.map((s) => (
          <div key={s.label} style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(205,201,192,0.1)",
            borderRadius: "10px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "rgba(205,201,192,0.06)",
                border: "1px solid rgba(205,201,192,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0" }}>
                  {s.icon}
                </span>
              </div>
              <div>
                <div style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#CDC9C0",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  marginBottom: "2px",
                }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>{s.sub}</div>
              </div>
            </div>
            <div style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#FFFFFF",
              backgroundColor: "rgba(205,201,192,0.06)",
              width: "44px",
              height: "44px",
              borderRadius: "8px",
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
        border: "1px solid rgba(205,201,192,0.1)",
        borderRadius: "10px",
        padding: "16px 20px",
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "10px",
        alignItems: "center",
        marginBottom: "20px",
      }}>
        <span style={{
          fontSize: "9px",
          fontWeight: 700,
          color: "rgba(205,201,192,0.35)",
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          marginRight: "6px",
        }}>
          Quick Actions
        </span>
        {quickActions.map(({ href, icon, label }) => (
          <Link key={href} href={href} style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 16px",
            backgroundColor: "transparent",
            border: "1px solid rgba(205,201,192,0.25)",
            borderRadius: "7px",
            color: "#CDC9C0",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{icon}</span>
            {label}
          </Link>
        ))}
        <Link href="/reyna-ai" style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "9px 20px",
          backgroundColor: "#CDC9C0",
          borderRadius: "7px",
          color: "#0f1d24",
          textDecoration: "none",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          marginLeft: "auto",
          boxShadow: "0 2px 8px rgba(205,201,192,0.15)",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
          Ask Reyna AI
        </Link>
      </div>

      {/* BENTO: ACTIVITY + ALERTS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "20px",
      }} className="lg:!grid-cols-[1fr_380px]">
        {/* Recent Activity */}
        <div style={{
          backgroundColor: "#1a2a32",
          border: "1px solid rgba(205,201,192,0.1)",
          borderRadius: "10px",
          padding: "24px",
          minHeight: "340px",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: 0 }}>
              Recent Activity
            </h3>
            <span className="material-symbols-outlined" style={{ color: "rgba(205,201,192,0.25)", fontSize: "18px" }}>history</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.35 }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "1.5px dashed rgba(205,201,192,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "14px",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#CDC9C0" }}>sync</span>
            </div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 3px" }}>Awaiting Activity</p>
            <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>The portal is synchronized.</p>
          </div>
        </div>

        {/* Admin Alerts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ fontSize: "9px", fontWeight: 800, color: "#CDC9C0", letterSpacing: "0.2em", textTransform: "uppercase" as const, margin: "0 0 2px" }}>
            Admin Alerts
          </h3>
          {[
            { priority: "URGENT", color: "#EF4444", icon: "priority_high", text: "End of month reconciliation due in 48 hours." },
            { priority: "HIGH", color: "#F59E0B", icon: "warning", text: "3 staff members have not confirmed their schedules." },
            { priority: "MEDIUM", color: "#CDC9C0", icon: "info", text: "Quarterly inventory audit scheduled for next Monday." },
          ].map((alert) => (
            <div key={alert.priority} style={{
              backgroundColor: "#1a2a32",
              border: "1px solid rgba(205,201,192,0.08)",
              borderLeft: `3px solid ${alert.color}`,
              borderRadius: "0 8px 8px 0",
              padding: "14px 16px",
              display: "flex",
              gap: "12px",
            }}>
              <span className="material-symbols-outlined" style={{ color: alert.color, fontSize: "18px", flexShrink: 0 }}>{alert.icon}</span>
              <div>
                <div style={{ fontSize: "9px", fontWeight: 800, color: alert.color, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "3px" }}>
                  {alert.priority}
                </div>
                <div style={{ fontSize: "12px", color: "#CBD5E1", lineHeight: 1.4 }}>{alert.text}</div>
              </div>
            </div>
          ))}
          <div style={{
            backgroundColor: "#0a151b",
            border: "1px solid rgba(205,201,192,0.08)",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center" as const,
          }}>
            <div style={{ fontSize: "8px", fontWeight: 700, color: "rgba(205,201,192,0.3)", letterSpacing: "0.25em", textTransform: "uppercase" as const, marginBottom: "6px" }}>
              System Health
            </div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", marginBottom: "10px" }}>Optimal</div>
            <div style={{ display: "flex", justifyContent: "center", gap: "3px" }}>
              <div style={{ height: "2px", width: "28px", backgroundColor: "#CDC9C0", borderRadius: "4px" }} />
              <div style={{ height: "2px", width: "28px", backgroundColor: "rgba(205,201,192,0.15)", borderRadius: "4px" }} />
              <div style={{ height: "2px", width: "28px", backgroundColor: "rgba(205,201,192,0.15)", borderRadius: "4px" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
