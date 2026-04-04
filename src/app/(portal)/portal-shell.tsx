"use client";

import {
  BarChart3,
  Bell,
  Calendar,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";

const mainNav: { href: string; label: string; icon: typeof Home }[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/staff", label: "Staff", icon: Users },
];

const toolsNav: { href: string; label: string; icon: typeof Star }[] = [
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reyna-ai", label: "Reyna AI", icon: Sparkles },
];

const mobileTabs: { href: string; label: string; icon: typeof Home }[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/more", label: "More", icon: LayoutGrid },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function titleForPath(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/") return "Dashboard";
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return "Portal";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export function PortalShell({
  children,
  userName,
  userEmail,
  userRole,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const pageTitle = useMemo(() => titleForPath(pathname), [pathname]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const inMore =
    ["/staff", "/reviews", "/orders", "/alerts", "/reyna-ai", "/more"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    ) || pathname === "/more";

  return (
    <div className="min-h-dvh bg-[#0d0d0d] pb-16 md:pb-0">
      {/* Top bar */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[#2a2a2a] bg-[#161616]/95 px-3 backdrop-blur md:left-[260px] md:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 text-neutral-300 md:hidden"
            aria-label="Menu"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="size-6" />
          </button>
          <span className="hidden font-medium text-neutral-100 md:inline">{pageTitle}</span>
          <span className="font-medium text-neutral-100 md:hidden">{pageTitle}</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="relative rounded-lg p-2 text-neutral-400 hover:bg-[#1f1f1f] hover:text-neutral-200"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
          </button>
          <Link
            href="/reyna-ai"
            className="hidden items-center gap-1.5 rounded-full bg-[#C9A84C]/15 px-3 py-1.5 text-sm font-medium text-[#C9A84C] md:inline-flex"
          >
            <Sparkles className="size-4" />
            Reyna AI
          </Link>
          <div
            className="flex size-9 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-semibold text-[#C9A84C]"
            title={userName}
          >
            {initials(userName)}
          </div>
        </div>
      </header>

      {/* Sidebar desktop */}
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[260px] flex-col border-r border-[#2a2a2a] bg-[#161616] md:flex">
        <div className="border-b border-[#2a2a2a] px-4 py-5">
          <p className="text-lg font-bold text-[#C9A84C]">
            Salon Envy<sup className="text-xs">®</sup>
          </p>
          <p className="text-xs text-neutral-500">Management Portal</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Main
          </p>
          <div className="space-y-0.5">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive(item.href)
                    ? "border-l-[3px] border-[#C9A84C] bg-[#1f1f1f] pl-[9px] font-medium text-[#C9A84C]"
                    : "border-l-[3px] border-transparent text-neutral-400 hover:bg-[#1a1a1a]"
                }`}
              >
                <item.icon className="size-4 shrink-0 opacity-90" />
                {item.label}
              </Link>
            ))}
          </div>
          <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Tools
          </p>
          <div className="space-y-0.5">
            {toolsNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                  item.href === "/reyna-ai"
                    ? "text-[#C9A84C]"
                    : "text-neutral-400"
                } ${
                  isActive(item.href)
                    ? "border-l-[3px] border-[#C9A84C] bg-[#1f1f1f] pl-[9px] font-medium text-[#C9A84C]"
                    : "border-l-[3px] border-transparent hover:bg-[#1a1a1a]"
                }`}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="border-t border-[#2a2a2a] p-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-sm font-semibold text-[#C9A84C]">
              {initials(userName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-200">{userName || "User"}</p>
              <p className="truncate text-xs capitalize text-neutral-500">{userRole.toLowerCase()}</p>
            </div>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-neutral-500 hover:bg-[#1f1f1f] hover:text-neutral-300"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-neutral-500 hover:bg-[#1f1f1f] hover:text-neutral-300"
              aria-label="Sign out"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile nav overlay */}
      {navOpen ? (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(100%,280px)] flex-col bg-[#161616] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
              <span className="font-semibold text-[#C9A84C]">Menu</span>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Close">
                <X className="size-6 text-neutral-400" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {[...mainNav, ...toolsNav].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  className={`mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                    isActive(item.href) ? "bg-[#1f1f1f] text-[#C9A84C]" : "text-neutral-300"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <div className="pt-14 md:pl-[260px]">
        <main className="min-h-[calc(100dvh-3.5rem)]">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t border-[#2a2a2a] bg-[#161616] md:hidden">
        {mobileTabs.map((tab) => {
          const active =
            tab.href === "/more"
              ? moreOpen || inMore
              : tab.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          if (tab.href === "/more") {
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => setMoreOpen(true)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  active ? "text-[#C9A84C]" : "text-neutral-500"
                }`}
              >
                <tab.icon className="size-5" />
                {tab.label}
                {active ? (
                  <span className="h-0.5 w-6 rounded-full bg-[#C9A84C]" />
                ) : (
                  <span className="h-0.5 w-6 opacity-0" />
                )}
              </button>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? "text-[#C9A84C]" : "text-neutral-500"
              }`}
            >
              <tab.icon className="size-5" />
              {tab.label}
              {active ? (
                <span className="h-0.5 w-6 rounded-full bg-[#C9A84C]" />
              ) : (
                <span className="h-0.5 w-6 opacity-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* More drawer */}
      {moreOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl border border-b-0 border-[#2a2a2a] bg-[#161616] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold text-neutral-100">More</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close">
                <X className="size-6 text-neutral-400" />
              </button>
            </div>
            <div className="grid max-h-[50vh] gap-1 overflow-y-auto">
              <Link
                href="/staff"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-neutral-200 hover:bg-[#1f1f1f]"
              >
                <Users className="size-5 text-[#C9A84C]" />
                Staff
              </Link>
              {toolsNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-neutral-200 hover:bg-[#1f1f1f]"
                >
                  <item.icon className="size-5 text-[#C9A84C]" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
