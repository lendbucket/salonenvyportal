"use client"
import { useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SalonEnvyLogo } from "@/components/SalonEnvyLogo"

type NavItem = { href: string; icon: string; label: string; badge?: boolean; highlight?: boolean }
type NavSection = { label: string; roles: string[]; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    label: "OWNER",
    roles: ["OWNER"],
    items: [
      { href: "/dashboard", icon: "dashboard", label: "OWNER DASHBOARD" },
      { href: "/approvals", icon: "verified", label: "APPROVALS", badge: true },
      { href: "/audit-log", icon: "history", label: "AUDIT LOG" },
      { href: "/bonus-triggers", icon: "stars", label: "BONUS TRIGGERS" },
      { href: "/service-pricing", icon: "sell", label: "SERVICE PRICING" },
    ]
  },
  {
    label: "MAIN",
    roles: ["OWNER", "MANAGER"],
    items: [
      { href: "/metrics", icon: "insights", label: "METRICS & GOALS" },
      { href: "/inventory", icon: "inventory_2", label: "INVENTORY" },
      { href: "/schedule", icon: "calendar_month", label: "SCHEDULE" },
      { href: "/staff", icon: "group", label: "STAFF" },
    ]
  },
  {
    label: "TOOLS",
    roles: ["OWNER", "MANAGER"],
    items: [
      { href: "/reviews", icon: "star", label: "REVIEWS" },
      { href: "/orders", icon: "shopping_cart", label: "PURCHASE ORDERS" },
      { href: "/alerts", icon: "notifications", label: "ALERTS" },
      { href: "/issue-reports", icon: "flag", label: "ISSUE REPORTS" },
      { href: "/complaints", icon: "shield", label: "COMPLAINTS" },
    ]
  },
  {
    label: "AI",
    roles: ["OWNER", "MANAGER", "STYLIST"],
    items: [
      { href: "/reyna-ai", icon: "auto_awesome", label: "REYNA AI", highlight: true },
    ]
  },
  {
    label: "STYLIST",
    roles: ["STYLIST"],
    items: [
      { href: "/my-schedule", icon: "calendar_month", label: "MY SCHEDULE" },
    ]
  },
  {
    label: "SETTINGS",
    roles: ["OWNER", "MANAGER", "STYLIST"],
    items: [
      { href: "/profile", icon: "person", label: "MY PROFILE" },
      { href: "/preferences", icon: "settings", label: "PREFERENCES" },
    ]
  },
]

const MOBILE_NAV = [
  { href: "/dashboard", icon: "grid_view", label: "HOME" },
  { href: "/metrics", icon: "insights", label: "METRICS" },
  { href: "/inventory", icon: "inventory", label: "STOCK" },
  { href: "/schedule", icon: "event", label: "SCHEDULE" },
  { href: "/more", icon: "more_horiz", label: "MORE" },
]

export function PortalShell({
  children,
  userName,
  userEmail,
  userRole,
}: {
  children: React.ReactNode
  userName: string
  userEmail: string
  userRole: string
}) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const initials = userName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U"

  const visibleSections = NAV_SECTIONS.filter(s => s.roles.includes(userRole))

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1e2d35", display: "flex" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
      />

      {/* SIDEBAR */}
      <aside style={{
        width: "280px",
        minWidth: "280px",
        backgroundColor: "#0a1520",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        borderRight: "1px solid rgba(205,201,192,0.1)",
        overflow: "hidden",
      }} className="hidden md:flex">

        {/* Logo section */}
        <div style={{
          padding: "20px 24px",
          minHeight: "80px",
          backgroundColor: "#060e14",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <SalonEnvyLogo width={160} />
          <div style={{
            marginTop: "10px",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: "rgba(205,201,192,0.4)",
            textTransform: "uppercase" as const,
          }}>
            Management Portal
          </div>
        </div>
        {/* Gold accent line */}
        <div style={{ height: "1px", backgroundColor: "rgba(205,201,192,0.25)" }} />

        {/* Nav sections */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          {visibleSections.map((section) => (
            <div key={section.label} style={{ marginBottom: "8px" }}>
              <div style={{
                padding: "8px 24px 4px",
                fontSize: "9px",
                fontWeight: 800,
                letterSpacing: "0.2em",
                color: "rgba(205,201,192,0.4)",
                textTransform: "uppercase" as const,
              }}>
                {section.label}
              </div>
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 24px",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase" as const,
                      textDecoration: "none",
                      borderLeft: isActive ? "3px solid #CDC9C0" : "3px solid transparent",
                      backgroundColor: isActive ? "rgba(205,201,192,0.08)" : "transparent",
                      color: isActive ? "#FFFFFF" : item.highlight ? "#CDC9C0" : "rgba(205,201,192,0.6)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "18px",
                        marginRight: "12px",
                        color: isActive ? "#CDC9C0" : item.highlight ? "#CDC9C0" : "rgba(205,201,192,0.5)",
                      }}
                    >
                      {item.icon}
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#EF4444",
                      }} />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User section */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(205,201,192,0.1)",
          backgroundColor: "#060e14",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "rgba(205,201,192,0.1)",
              border: "2px solid rgba(205,201,192,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#CDC9C0",
              fontSize: "14px",
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 700,
                whiteSpace: "nowrap" as const,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {userName}
              </div>
              <div style={{
                color: "#CDC9C0",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                opacity: 0.7,
              }}>
                {userRole}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Link href="/profile" style={{
              flex: 1,
              padding: "8px",
              backgroundColor: "rgba(205,201,192,0.08)",
              border: "1px solid rgba(205,201,192,0.15)",
              borderRadius: "6px",
              color: "rgba(205,201,192,0.7)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>settings</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                flex: 1,
                padding: "8px",
                backgroundColor: "rgba(205,201,192,0.08)",
                border: "1px solid rgba(205,201,192,0.15)",
                borderRadius: "6px",
                color: "rgba(205,201,192,0.7)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* TOP BAR */}
        <header style={{
          height: "64px",
          backgroundColor: "#0f1d24",
          borderBottom: "1px solid rgba(205,201,192,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 40,
          flexShrink: 0,
        }}>
          <div className="md:hidden">
            <SalonEnvyLogo width={120} />
          </div>
          <div className="hidden md:block" style={{ color: "#FFFFFF", fontSize: "16px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
            Salon Envy® Portal
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "rgba(205,201,192,0.08)",
              border: "1px solid rgba(205,201,192,0.15)",
              color: "rgba(205,201,192,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>notifications</span>
            </button>

            <Link href="/reyna-ai" style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              backgroundColor: "#CDC9C0",
              borderRadius: "8px",
              color: "#0f1d24",
              textDecoration: "none",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
              Reyna AI
            </Link>

            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "rgba(205,201,192,0.1)",
              border: "2px solid rgba(205,201,192,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#CDC9C0",
              fontSize: "12px",
              fontWeight: 800,
            }}>
              {initials}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main style={{
          flex: 1,
          backgroundColor: "#1e2d35",
          overflowY: "auto",
          paddingBottom: "80px",
        }}>
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden" style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "64px",
        backgroundColor: "#0f1d24",
        borderTop: "1px solid rgba(205,201,192,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 50,
      }}>
        {MOBILE_NAV.map(({ href, icon, label }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              color: isActive ? "#CDC9C0" : "rgba(205,201,192,0.4)",
              textDecoration: "none",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              padding: "8px 12px",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
