import { Bell, ShoppingBag, Sparkles, Star, Users } from "lucide-react";
import Link from "next/link";

const links = [
  { href: "/staff", label: "Staff", icon: Users },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reyna-ai", label: "Reyna AI", icon: Sparkles },
];

export default function MorePage() {
  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">More</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#1f1f1f] px-4 py-3 text-neutral-200 transition hover:border-[#C9A84C]/40"
            >
              <Icon className="size-5 text-[#C9A84C]" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
