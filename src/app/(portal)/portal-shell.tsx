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

  /* ── Shared helpers ── */
  function navLink(item: NavItem, compact?: boolean) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setDrawerOpen(false)}
        style={{
          display: "flex",
          alignItems: "center",
          padding: compact ? "10px 20px" : "9px 20px",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
          borderLeft: isActive ? "2px solid #7a8f96" : "2px solid transparent",
          backgroundColor: isActive ? "rgba(255,255,255,0.06)" : "transparent",
          color: isActive ? "#FBFBFB" : item.highlight ? "#CDC9C0" : "rgba(205,201,192,0.55)",
          transition: "all 0.15s ease",
        }}
      >
        {item.icon && (
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "17px",
              marginRight: "10px",
              color: isActive ? "#CDC9C0" : item.highlight ? "#CDC9C0" : "rgba(205,201,192,0.4)",
            }}
          >
            {item.icon}
          </span>
        )}
        {!item.icon && <span style={{ width: "17px", marginRight: "10px" }} />}
        <span style={{ flex: 1 }}>{item.label === "Envy Suite®" ? (<>Envy Suite<sup style={{ fontSize: "65%", verticalAlign: "super", marginLeft: "1px" }}>&reg;</sup></>) : item.label}</span>
        {item.badge && (() => {
          const count = item.href === "/alerts" ? alertCount : item.href === "/approvals" ? pendingCount : 0
          if (!count) return null
          return (
            <span style={{
              minWidth: "18px",
              height: "18px",
              borderRadius: "9px",
              backgroundColor: "#EF4444",
              color: "#fff",
              fontSize: "9px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
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
              style={{ height: "40px", width: "auto", objectFit: "contain", display: "block" }}
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
            {navItems.map(item => navLink(item, true))}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
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
                color: isActive ? "#CDC9C0" : "rgba(205,201,192,0.35)",
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
    <div style={{ minHeight: "100vh", backgroundColor: "#1e2d35", display: "flex" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
      />

      {/* SIDEBAR — 220px */}
      <aside style={{
        width: "220px",
        minWidth: "220px",
        backgroundColor: "#080c10",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: "18px 20px",
          backgroundColor: "rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <img
            src="/images/logo-white.png"
            alt="Salon Envy"
            style={{ width: "120px", height: "auto", objectFit: "contain", display: "block" }}
          />
          <div style={{
            marginTop: "8px",
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "rgba(205,201,192,0.4)",
            textTransform: "uppercase",
          }}>
            Management Portal
          </div>
          {isManager && locationName && (
            <div style={{
              marginTop: "4px",
              fontSize: "9px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "rgba(205,201,192,0.55)",
              textTransform: "uppercase",
            }}>
              {locationName}
            </div>
          )}
        </div>
        <div style={{ height: "1px", backgroundColor: "rgba(205,201,192,0.2)" }} />

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {navItems.map(item => navLink(item))}
        </nav>

        {/* User section */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(0,0,0,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1.5px solid rgba(205,201,192,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#CDC9C0",
              fontSize: "12px",
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: "#FBFBFB",
                fontSize: "12px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {userName}
              </div>
              <div style={{
                color: "#CDC9C0",
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.6,
              }}>
                {userRole}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <Link href="/profile" style={{
              flex: 1,
              padding: "7px",
              backgroundColor: "rgba(205,201,192,0.06)",
              border: "1px solid rgba(205,201,192,0.12)",
              borderRadius: "6px",
              color: "rgba(205,201,192,0.6)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>settings</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                flex: 1,
                padding: "7px",
                backgroundColor: "rgba(205,201,192,0.06)",
                border: "1px solid rgba(205,201,192,0.12)",
                borderRadius: "6px",
                color: "rgba(205,201,192,0.6)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        {/* TOP BAR — 52px */}
        <header style={{
          height: "52px",
          flexShrink: 0,
          backgroundColor: "#080c10",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          <div style={{
            color: "#FBFBFB",
            fontSize: "15px",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}>
            {pageTitle}
          </div>
          <Link href="/reyna-ai" style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "7px 14px",
            backgroundColor: "#CDC9C0",
            borderRadius: "7px",
            color: "#0f1d24",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>auto_awesome</span>
            Reyna AI
          </Link>
        </header>

        {/* PAGE CONTENT */}
        <main style={{
          flex: 1,
          backgroundColor: "#1e2d35",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
