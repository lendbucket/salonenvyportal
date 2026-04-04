import Link from "next/link"

const links = [
  { href: "/staff", icon: "group", label: "Staff" },
  { href: "/reviews", icon: "star", label: "Reviews" },
  { href: "/orders", icon: "shopping_cart", label: "Purchase Orders" },
  { href: "/alerts", icon: "notifications", label: "Alerts" },
  { href: "/reyna-ai", icon: "auto_awesome", label: "Reyna AI" },
  { href: "/issue-reports", icon: "flag", label: "Issue Reports" },
  { href: "/complaints", icon: "shield", label: "Anonymous Complaints" },
  { href: "/profile", icon: "person", label: "My Profile" },
  { href: "/preferences", icon: "settings", label: "Preferences" },
]

export default function MorePage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="font-[var(--font-noto-serif)] text-3xl text-white">More</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, icon, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-xl border border-[rgba(205,201,192,0.15)] bg-[#1f2c31] px-5 py-4 text-[#e9e5dc] transition hover:bg-[#29373c]"
            >
              <span className="material-symbols-outlined text-[#CDC9C0]">{icon}</span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
