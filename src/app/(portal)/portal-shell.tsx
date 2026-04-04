"use client"
import { useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const ownerNav = [
  { href: "/dashboard", icon: "dashboard", label: "Owner Dashboard" },
  { href: "/approvals", icon: "verified", label: "Approvals", badge: true },
  { href: "/audit-log", icon: "history", label: "Audit Log" },
  { href: "/bonus-triggers", icon: "stars", label: "Bonus Triggers" },
  { href: "/service-pricing", icon: "sell", label: "Service Pricing" },
]

const mainNav = [
  { href: "/metrics", icon: "insights", label: "Metrics & Goals" },
  { href: "/inventory", icon: "inventory_2", label: "Inventory" },
  { href: "/schedule", icon: "calendar_month", label: "Schedule" },
  { href: "/staff", icon: "group", label: "Staff" },
  { href: "/reyna-ai", icon: "auto_awesome", label: "Reyna AI", highlight: true },
]

const toolsNav = [
  { href: "/reviews", icon: "star", label: "Reviews" },
  { href: "/orders", icon: "shopping_cart", label: "Purchase Orders" },
  { href: "/alerts", icon: "notifications", label: "Alerts" },
  { href: "/issue-reports", icon: "flag", label: "Issue Reports" },
  { href: "/complaints", icon: "shield", label: "Anonymous Complaints" },
]

const settingsNav = [
  { href: "/profile", icon: "person", label: "My Profile" },
  { href: "/preferences", icon: "settings", label: "Preferences" },
]

const mobileNav = [
  { href: "/dashboard", icon: "grid_view", label: "Dashboard" },
  { href: "/metrics", icon: "insights", label: "Metrics" },
  { href: "/inventory", icon: "inventory", label: "Inventory" },
  { href: "/schedule", icon: "event", label: "Schedule" },
  { href: "/more", icon: "more_horiz", label: "More" },
]

function NavItem({ href, icon, label, badge, highlight }: {
  href: string
  icon: string
  label: string
  badge?: boolean
  highlight?: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")
  return (
    <Link
      href={href}
      className={`flex items-center px-6 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${
        isActive
          ? "bg-[#29373c] text-[#e9e5dc] border-l-[3px] border-[#CDC9C0]"
          : highlight
          ? "text-[#CDC9C0] hover:bg-[#1f2c31]"
          : "text-[#CDC9C0]/70 hover:bg-[#1f2c31]"
      }`}
    >
      <span className="material-symbols-outlined mr-3 text-lg">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="w-2 h-2 bg-red-500 rounded-full ml-2"></span>
      )}
    </Link>
  )
}

export function PortalShell({ children, userName, userEmail, userRole }: {
  children: React.ReactNode
  userName: string
  userEmail: string
  userRole: string
}) {
  const pathname = usePathname()
  const initials = userName?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-[#07151a]">
      {/* Google Fonts for Material Symbols */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0&display=swap" />

      {/* Top App Bar */}
      <header className="bg-[#142127] flex justify-between items-center px-6 h-16 w-full fixed top-0 z-50 border-b border-[rgba(205,201,192,0.1)]">
        <div className="flex items-center h-10 overflow-hidden py-1 md:hidden">
          <img
            src="/images/logo-white.png"
            alt="Salon Envy"
            className="h-full w-auto object-contain"
          />
        </div>
        <div className="hidden md:block" />
        <div className="flex items-center gap-3">
          <Link
            href="/reyna-ai"
            className="border border-[rgba(205,201,192,0.3)] text-[#CDC9C0] px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-[#1f2c31] transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            Reyna AI
          </Link>
          <div className="w-8 h-8 rounded-full bg-[#29373c] border border-[rgba(205,201,192,0.3)] flex items-center justify-center text-[#CDC9C0] text-xs font-bold">
            {initials}
          </div>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex bg-[#142127] flex-col h-screen w-[260px] fixed left-0 top-0 z-40 border-r border-[rgba(205,201,192,0.1)]">
        {/* Logo area */}
        <div className="h-16 flex items-center px-6 border-b border-[rgba(205,201,192,0.1)]">
          <img src="/images/logo-white.png" alt="Salon Envy" className="h-8 w-auto object-contain" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0">
          {/* Owner section */}
          {userRole === "OWNER" && (
            <>
              <p className="px-6 py-2 text-[10px] font-bold text-[#CDC9C0]/40 tracking-[0.2em] uppercase">Owner</p>
              {ownerNav.map(item => <NavItem key={item.href} {...item} />)}
            </>
          )}

          {/* Main section */}
          <p className="px-6 py-2 text-[10px] font-bold text-[#CDC9C0]/40 tracking-[0.2em] uppercase mt-2">Main</p>
          {mainNav.map(item => <NavItem key={item.href} {...item} />)}

          {/* Tools section */}
          <p className="px-6 py-2 text-[10px] font-bold text-[#CDC9C0]/40 tracking-[0.2em] uppercase mt-2">Tools</p>
          {toolsNav.map(item => <NavItem key={item.href} {...item} />)}

          {/* Settings section */}
          <p className="px-6 py-2 text-[10px] font-bold text-[#CDC9C0]/40 tracking-[0.2em] uppercase mt-2">Settings</p>
          {settingsNav.map(item => <NavItem key={item.href} {...item} />)}
        </nav>

        {/* Bottom user section */}
        <div className="border-t border-[rgba(205,201,192,0.1)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#29373c] border border-[rgba(205,201,192,0.3)] flex items-center justify-center text-[#CDC9C0] text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#e9e5dc] truncate">{userName}</p>
              <p className="text-[10px] text-[#CDC9C0]/60 truncate">{userRole}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/profile" className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[#CDC9C0]/60 hover:text-[#CDC9C0] text-xs transition-colors">
              <span className="material-symbols-outlined text-sm">settings</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[#CDC9C0]/60 hover:text-[#CDC9C0] text-xs transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:pl-[260px] pt-16 pb-24 md:pb-8 min-h-screen bg-[#606E74]">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden bg-[#142127] fixed bottom-0 left-0 w-full flex justify-around items-center h-16 z-50 border-t border-[rgba(205,201,192,0.1)]">
        {mobileNav.map(({ href, icon, label }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 ${isActive ? "text-[#e9e5dc]" : "text-[#CDC9C0]/50"}`}>
              <span className="material-symbols-outlined text-xl">{icon}</span>
              <span className="text-[9px] uppercase tracking-tight font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
