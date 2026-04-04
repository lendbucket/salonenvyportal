"use client";

import {
  BarChart3,
  Bell,
  Calendar,
  LayoutDashboard,
  LayoutGrid,
  Package,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const sidebarNav: { href: string; label: string; icon?: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/staff", label: "Staff", icon: Users },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reyna-ai", label: "Reyna AI", icon: Sparkles },
];

const mobileNav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/more", label: "More", icon: LayoutGrid },
];

function NavLink({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-l-2 border-[#C9A84C] bg-[#1f1f1f] pl-[10px] text-[#C9A84C]"
          : "border-l-2 border-transparent pl-[10px] text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200"
      }`}
    >
      {Icon ? <Icon className="size-4 shrink-0 opacity-90" aria-hidden /> : null}
      {label}
    </Link>
  );
}

export function PortalShell({
  userName,
  userEmail,
  children,
}: {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh bg-[#0d0d0d] pb-16 md:pb-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-800 bg-[#161616] md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-neutral-800 px-4">
          <span className="text-lg font-semibold text-[#C9A84C]">Salon Envy®</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {sidebarNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
              }
              icon={item.icon}
            />
          ))}
        </nav>
        <div className="border-t border-neutral-800 p-3">
          <p className="truncate text-xs font-medium text-neutral-200">{userName ?? "User"}</p>
          <p className="truncate text-xs text-neutral-500">{userEmail}</p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-2 w-full rounded-md border border-neutral-700 py-1.5 text-xs text-neutral-300 transition hover:bg-[#1f1f1f]"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col md:pl-64">
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-neutral-800 bg-[#161616] md:hidden"
        aria-label="Primary"
      >
        {mobileNav.map((item) => {
          const active =
            item.href === "/more"
              ? pathname === "/more" || ["/staff", "/reviews", "/orders", "/alerts", "/reyna-ai"].some((p) => pathname.startsWith(p))
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-[#C9A84C]" : "text-neutral-500"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
