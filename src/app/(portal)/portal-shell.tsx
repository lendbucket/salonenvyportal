"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"

type NavItem = { href: string; icon: string; label: string; badge?: boolean; highlight?: boolean }

/* ── Role-based full nav ── */
const OWNER_NAV: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/performance", icon: "trending_up", label: "Performance" },
  { href: "/appointments", icon: "event", label: "Appointments" },
  { href: "/approvals", icon: "verified", label: "Approvals", badge: true },
  { href: "/metrics", icon: "insights", label: "Metrics" },
  { href: "/retention", icon: "favorite", label: "Retention" },
  { href: "/cancellations", icon: "event_busy", label: "Cancellations" },
  { href: "/schedule", icon: "calendar_month", label: "Schedule" },
  { href: "/staff", icon: "group", label: "Staff" },
  { href: "/inventory", icon: "inventory_2", label: "Inventory" },
  { href: "/pos", icon: "point_of_sale", label: "Kasse POS" },
  { href: "/reviews", icon: "star", label: "Reviews" },
  { href: "/purchase-orders", icon: "shopping_cart", label: "Purchase Orders" },
  { href: "/payroll", icon: "account_balance_wallet", label: "Payroll" },
  { href: "/financials", icon: "account_balance", label: "Financials" },
  { href: "/complaints", icon: "report", label: "Complaints" },
  { href: "/conduct", icon: "gavel", label: "Conduct" },
  { href: "/onboarding", icon: "person_add", label: "Onboarding" },
  { href: "/alerts", icon: "notifications", label: "Alerts", badge: true },
  { href: "/social", icon: "share", label: "Social Media" },
  { href: "/reyna-ai", icon: "auto_awesome", label: "Reyna AI", highlight: true },
  { href: "/permissions", icon: "admin_panel_settings", label: "Permissions" },
  { href: "/settings", icon: "settings", label: "Settings" },
  { href: "/suite", icon: "", label: "Envy Suite®" },
]

const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/performance", icon: "trending_up", label: "Performance" },
  { href: "/appointments", icon: "event", label: "Appointments" },
  { href: "/metrics", icon: "insights", label: "Metrics" },
  { href: "/retention", icon: "favorite", label: "Retention" },
  { href: "/cancellations", icon: "event_busy", label: "Cancellations" },
  { href: "/schedule", icon: "calendar_month", label: "Schedule" },
  { href: "/staff", icon: "group", label: "Staff" },
  { href: "/inventory", icon: "inventory_2", label: "Inventory" },
  { href: "/purchase-orders", icon: "shopping_cart", label: "Purchase Orders" },
  { href: "/payroll", icon: "account_balance_wallet", label: "Payroll" },
  { href: "/financials", icon: "account_balance", label: "Financials" },
  { href: "/pos", icon: "point_of_sale", label: "Kasse POS" },
  { href: "/reviews", icon: "star", label: "Reviews" },
  { href: "/complaints", icon: "report", label: "Complaints" },
  { href: "/conduct", icon: "gavel", label: "Conduct" },
  { href: "/social", icon: "share", label: "Social Media" },
  { href: "/reyna-ai", icon: "auto_awesome", label: "Reyna AI", highlight: true },
  { href: "/settings", icon: "settings", label: "Settings" },
  { href: "/suite", icon: "", label: "Envy Suite®" },
]

const STYLIST_NAV: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/performance", icon: "trending_up", label: "Performance" },
  { href: "/my-schedule", icon: "calendar_month", label: "My Schedule" },
  { href: "/appointments", icon: "event", label: "My Appts" },
  { href: "/reviews", icon: "star", label: "My Reviews" },
  { href: "/pos", icon: "point_of_sale", label: "Kasse POS" },
  { href: "/submit-complaint", icon: "report", label: "Report Issue" },
  { href: "/conduct", icon: "gavel", label: "My Record" },
  { href: "/reyna-ai", icon: "auto_awesome", label: "Reyna AI", highlight: true },
  { href: "/settings", icon: "settings", label: "Settings" },
  { href: "/suite", icon: "", label: "Envy Suite®" },
]

/* ── Bottom nav (max 5) ── */
const OWNER_BOTTOM: NavItem[] = [
  { href: "/dashboard", icon: "grid_view", label: "Home" },
  { href: "/metrics", icon: "insights", label: "Metrics" },
  { href: "/pos", icon: "point_of_sale", label: "Kasse" },
  { href: "/schedule", icon: "calendar_month", label: "Schedule" },
  { href: "/reyna-ai", icon: "auto_awesome", label: "Reyna" },
]

const STYLIST_BOTTOM: NavItem[] = [
  { href: "/dashboard", icon: "grid_view", label: "Home" },
  { href: "/my-schedule", icon: "calendar_month", label: "Schedule" },
  { href: "/pos", icon: "point_of_sale", label: "Kasse" },
  { href: "/reviews", icon: "star", label: "Reviews" },
  { href: "/reyna-ai", icon: "auto_awesome", label: "Reyna" },
]

/* ── Allowed pages per role for stylist redirect ── */
const STYLIST_ALLOWED = ["/dashboard", "/my-schedule", "/reyna-ai", "/profile", "/preferences", "/submit-complaint", "/conduct", "/pos", "/appointments", "/reviews", "/suite", "/performance", "/permissions"]

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { role, isOwner, isStylist, isManager, locationName } = useUserRole()

  const userName = session?.user?.name || "User"
  const userRole = role

  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      if (d.locations) setLocations(d.locations)
    }).catch(() => {})
  }, [])

  // suppress unused var warning — locations available for future use
  void locations

  /* Responsive listener */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  /* Close drawer on navigation */
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  /* Stylist redirect */
  useEffect(() => {
    if (isStylist && !STYLIST_ALLOWED.some(p => pathname === p || pathname.startsWith(p + "/"))) {
      router.push("/my-schedule")
    }
  }, [isStylist, pathname, router])

  const navItems = useMemo(() => {
    if (isOwner) return OWNER_NAV
    if (isManager) return MANAGER_NAV
    return STYLIST_NAV
  }, [isOwner, isManager])

  const bottomItems = useMemo(() => {
    if (isStylist) return STYLIST_BOTTOM
    return OWNER_BOTTOM
  }, [isStylist])

  const initials = userName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U"

  const pageTitle = useMemo(() => {
    if (pathname === "/dashboard" || pathname === "/") return "Dashboard"
    const seg = pathname.split("/").filter(Boolean)[0]
    if (!seg) return "Portal"
    return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ")
  }, [pathname])

  const [pendingCount, setPendingCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    if (!isOwner && !isManager) return
    const fetchCounts = () => {
      fetch("/api/approvals/pending").then(r => r.json()).then(d => {
        setPendingCount(d.users?.length || 0)
      }).catch(() => {})
      fetch("/api/alerts").then(r => r.json()).then(d => {
        if (d.unreadCount !== undefined) setAlertCount(d.unreadCount)
      }).catch(() => {})
    }
    fetchCounts()
    const id = setInterval(fetchCounts, 60000)
    return () => clearInterval(id)
  }, [isOwner, isManager])

  /* ── Section labels for desktop nav ── */
  const sectionStarts = useMemo((): Record<string, string> => {
    if (isOwner) return { "/appointments": "SALON", "/staff": "TEAM", "/payroll": "BUSINESS", "/alerts": "SYSTEM" }
    if (isManager) return { "/appointments": "SALON", "/staff": "TEAM", "/payroll": "BUSINESS", "/social": "SYSTEM" }
    return { "/my-schedule": "MY WORK", "/submit-complaint": "OTHER", "/settings": "SYSTEM" }
  }, [isOwner, isManager])

  /* ── Mobile drawer nav link ── */
  function mobileNavLink(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setDrawerOpen(false)}
        style={{
          display: "flex",
          flexDirection: "row" as const,
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          margin: "1px 8px",
          height: 38,
          borderRadius: 6,
          textDecoration: "none",
          borderLeft: isActive ? "3px solid #C9A84C" : "3px solid transparent",
          backgroundColor: isActive ? "rgba(201,168,76,0.08)" : "transparent",
          color: isActive ? "#C9A84C" : item.highlight ? "#C9A84C" : "rgba(255,255,255,0.5)",
          transition: "all 0.15s ease",
          overflow: "hidden",
          whiteSpace: "nowrap" as const,
          width: "calc(100% - 16px)",
          boxSizing: "border-box" as const,
        }}
      >
        {item.icon && (
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16, width: 16, height: 16, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: isActive ? "#C9A84C" : "rgba(255,255,255,0.4)",
            }}
          >
            {item.icon}
          </span>
        )}
        {!item.icon && <span style={{ width: 16, height: 16, flexShrink: 0 }} />}
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const, fontSize: 13, fontWeight: isActive ? 600 : 500,
          letterSpacing: "-0.31px", lineHeight: "1",
        }}>{item.label === "Envy Suite®" ? (<>Envy Suite<sup style={{ fontSize: "65%", verticalAlign: "super", marginLeft: "1px" }}>&reg;</sup></>) : item.label}</span>
        {item.badge && (() => {
          const count = item.href === "/alerts" ? alertCount : item.href === "/approvals" ? pendingCount : 0
          if (!count) return null
          return (
            <span style={{
              minWidth: 18, height: 18, borderRadius: 9, background: "#ef4444",
              color: "#ffffff", fontSize: 10, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginLeft: "auto", flexShrink: 0, letterSpacing: "0",
            }}>
              {count}
            </span>
          )
        })()}
      </Link>
    )
  }

  /* ── Desktop nav link ── */
  function desktopNavLink(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          display: "flex",
          flexDirection: "row" as const,
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          margin: "1px 8px",
          height: 40,
          minHeight: 40,
          borderRadius: 6,
          cursor: "pointer",
          textDecoration: "none",
          width: "calc(100% - 16px)",
          boxSizing: "border-box" as const,
          overflow: "hidden",
          whiteSpace: "nowrap" as const,
          transition: "all 0.15s ease",
          position: "relative" as const,
          borderLeft: isActive ? "3px solid #C9A84C" : "3px solid transparent",
          background: isActive ? "rgba(201,168,76,0.08)" : "transparent",
          color: isActive ? "#C9A84C" : "rgba(255,255,255,0.5)",
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)"
            e.currentTarget.style.color = "rgba(255,255,255,0.75)"
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.color = "rgba(255,255,255,0.5)"
          }
        }}
      >
        {item.icon && (
          <span
            className="material-symbols-outlined"
            style={{
              width: 16, height: 16, fontSize: 16, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
              color: isActive ? "#C9A84C" : "rgba(255,255,255,0.4)",
            }}
          >
            {item.icon}
          </span>
        )}
        {!item.icon && <span style={{ width: 16, height: 16, flexShrink: 0 }} />}
        <span style={{
          fontFamily: "Inter", fontSize: 13, fontWeight: isActive ? 600 : 500,
          letterSpacing: "-0.31px", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const, flex: 1, lineHeight: "1",
        }}>{item.label === "Envy Suite®" ? (<>Envy Suite<sup style={{ fontSize: "65%", verticalAlign: "super", marginLeft: "1px" }}>&reg;</sup></>) : item.label}</span>
        {item.badge && (() => {
          const count = item.href === "/alerts" ? alertCount : item.href === "/approvals" ? pendingCount : 0
          if (!count) return null
          return (
            <span style={{
              minWidth: 18, height: 18, borderRadius: 9, background: "#ef4444",
              color: "#ffffff", fontSize: 10, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginLeft: "auto", flexShrink: 0, letterSpacing: "0",
            }}>
              {count}
            </span>
          )
        })()}
      </Link>
    )
  }

  /* ═══════════════════════════════════════════
     MOBILE LAYOUT
     ═══════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", backgroundColor: "#1e2d35", overflow: "hidden" }}>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />

        {/* TOP BAR — fixed at top */}
        <header className="portal-header" style={{
          backgroundColor: "#080c10",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          zIndex: 50,
        }}>
        <div style={{
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src="/images/logo-white.png"
              alt="Salon Envy"
              style={{
                height: "32px",
                width: "auto",
                objectFit: "contain" as const,
                display: "block",
                filter: "brightness(0) saturate(100%) invert(78%) sepia(35%) saturate(800%) hue-rotate(5deg) brightness(95%)",
              }}
            />
            {isOwner && pendingCount > 0 && (
              <Link href="/approvals" style={{
                minWidth: "20px",
                height: "20px",
                borderRadius: "10px",
                backgroundColor: "#EF4444",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 6px",
                textDecoration: "none",
              }}>
                {pendingCount}
              </Link>
            )}
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "rgba(205,201,192,0.06)",
              border: "1px solid rgba(205,201,192,0.12)",
              color: "rgba(205,201,192,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>menu</span>
          </button>
        </div>
        </header>

        {/* DRAWER OVERLAY */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.55)",
              zIndex: 90,
            }}
          />
        )}

        {/* SLIDE-IN DRAWER from right */}
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "280px",
          maxWidth: "85vw",
          backgroundColor: "#080c10",
          zIndex: 100,
          transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* Drawer header — user info */}
          <div style={{
            padding: "20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(205,201,192,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#CDC9C0",
                fontSize: "13px",
                fontWeight: 800,
              }}>
                {initials}
              </div>
              <div>
                <div style={{ color: "#FBFBFB", fontSize: "13px", fontWeight: 700 }}>{userName}</div>
                <div style={{ color: "rgba(205,201,192,0.5)", fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{userRole}</div>
              </div>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(205,201,192,0.06)",
                border: "1px solid rgba(205,201,192,0.12)",
                color: "rgba(205,201,192,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
            </button>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "8px 0" }}>
            {navItems.map(item => mobileNavLink(item))}
          </nav>

          {/* Profile / Sign out at bottom */}
          <div style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: "8px",
          }}>
            <Link href="/profile" onClick={() => setDrawerOpen(false)} style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "rgba(205,201,192,0.06)",
              border: "1px solid rgba(205,201,192,0.12)",
              borderRadius: "8px",
              color: "rgba(205,201,192,0.6)",
              textDecoration: "none",
              display: "inline-flex",
              flexDirection: "row" as const,
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              overflow: "hidden",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>person</span>
              Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: "rgba(205,201,192,0.06)",
                border: "1px solid rgba(205,201,192,0.12)",
                borderRadius: "8px",
                color: "rgba(205,201,192,0.6)",
                cursor: "pointer",
                display: "inline-flex",
                flexDirection: "row" as const,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                overflow: "hidden",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>logout</span>
              Sign Out
            </button>
          </div>
        </div>

        {/* CONTENT — scrollable area */}
        <main className="portal-content" style={{
          flex: 1,
          backgroundColor: "#1e2d35",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "80px",
          width: "100%",
        }}>
          {children}
        </main>

        {/* BOTTOM NAV — 64px */}
        <nav className="portal-bottom-nav" style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: "60px",
          backgroundColor: "#080c10",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 50,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {bottomItems.map(({ href, icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link key={href} href={href} style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                color: isActive ? "#C9A84C" : "rgba(255,255,255,0.35)",
                textDecoration: "none",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "6px 12px",
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

  /* ═══════════════════════════════════════════
     DESKTOP LAYOUT
     ═══════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#06080d" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
      />

      {/* SIDEBAR — 220px fixed */}
      <aside style={{
        width: 220,
        minWidth: 220,
        maxWidth: 220,
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        background: "#0d1117",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        overflowY: "auto",
        zIndex: 50,
        paddingBottom: 16,
      }}>
        {/* Logo */}
        <div style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 8,
          flexShrink: 0,
        }}>
          <img
            src="/images/logo-white.png"
            alt="Salon Envy"
            style={{
              maxHeight: 32,
              width: "auto",
              objectFit: "contain" as const,
              display: "block",
              filter: "brightness(0) saturate(100%) invert(78%) sepia(35%) saturate(800%) hue-rotate(5deg) brightness(95%)",
            }}
          />
        </div>

        {/* Nav with section labels */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {navItems.map(item => {
            const sectionLabel = sectionStarts[item.href]
            return (
              <div key={item.href}>
                {sectionLabel && (
                  <span style={{
                    fontFamily: "Inter",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.3)",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    padding: "0 20px",
                    marginTop: 24,
                    marginBottom: 4,
                    display: "block",
                  }}>
                    {sectionLabel}
                  </span>
                )}
                {desktopNavLink(item)}
              </div>
            )
          })}
        </nav>

        {/* Powered by */}
        <div style={{
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{
            fontFamily: "Inter",
            fontSize: 10,
            fontWeight: 400,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.04em",
            textTransform: "uppercase" as const,
          }}>
            Powered by RunMySalon
          </span>
        </div>

        {/* User section */}
        <div style={{
          marginTop: "auto",
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}>
          {/* Avatar */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(201,168,76,0.15)",
            border: "1px solid rgba(201,168,76,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontFamily: "Inter",
            fontSize: 11,
            fontWeight: 600,
            color: "#C9A84C",
            letterSpacing: "0",
          }}>
            {initials}
          </div>
          {/* User info */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{
              fontFamily: "Inter",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "-0.31px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
              lineHeight: 1.3,
            }}>
              {userName}
            </div>
            <div style={{
              fontFamily: "Inter",
              fontSize: 11,
              fontWeight: 400,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.02em",
              textTransform: "uppercase" as const,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
              lineHeight: 1.3,
            }}>
              {userRole}
            </div>
          </div>
          {/* Settings */}
          <Link href="/profile" style={{
            width: 28, height: 28, borderRadius: 6,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,0.4)",
            flexShrink: 0, transition: "all 0.15s ease", textDecoration: "none",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>settings</span>
          </Link>
          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.4)",
              flexShrink: 0, transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>logout</span>
          </button>
        </div>
      </aside>

      {/* TOPBAR — 56px fixed */}
      <header style={{
        height: 56,
        minHeight: 56,
        position: "fixed",
        top: 0,
        left: 220,
        right: 0,
        background: "#0d1117",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        zIndex: 40,
        boxSizing: "border-box" as const,
      }}>
        <div style={{
          fontFamily: "Inter",
          fontSize: 16,
          fontWeight: 600,
          color: "#ffffff",
          letterSpacing: "-0.31px",
        }}>
          {pageTitle}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/reyna-ai" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0 14px",
            height: 32,
            borderRadius: 6,
            background: "rgba(201,168,76,0.1)",
            border: "1px solid rgba(201,168,76,0.25)",
            color: "#C9A84C",
            fontFamily: "Inter",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "-0.31px",
            cursor: "pointer",
            whiteSpace: "nowrap" as const,
            transition: "all 0.15s ease",
            textDecoration: "none",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,168,76,0.15)"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,168,76,0.1)"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
            Reyna AI
          </Link>
        </div>
      </header>

      {/* PAGE CONTENT — offset by sidebar and topbar */}
      <main style={{
        marginLeft: 220,
        marginTop: 56,
        minHeight: "calc(100vh - 56px)",
        background: "#06080d",
        overflowX: "hidden",
      }}>
        {children}
      </main>
    </div>
  )
}
