"use client";

import Link from "next/link";
import { Sparkles, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

type Alert = {
  id: string;
  title: string;
  body: string;
  severity: string;
  createdAt: string;
};

export function DashboardClient({
  userName,
  alerts,
}: {
  userName: string;
  alerts: Alert[];
}) {
  const [locationTab, setLocationTab] = useState<"cc" | "sa" | "both">("both");

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const displayName = userName?.trim() || "there";
  const pendingApprovals = 0;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100 md:text-3xl">
            {greeting}, {displayName} 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{dateStr}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 md:mt-0">
          {(
            [
              { id: "cc" as const, label: "Corpus Christi" },
              { id: "sa" as const, label: "San Antonio" },
              { id: "both" as const, label: "Both" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setLocationTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                locationTab === t.id
                  ? "bg-[#C9A84C] text-[#0d0d0d]"
                  : "bg-[#1f1f1f] text-neutral-400 hover:bg-[#2a2a2a]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Revenue This Week",
            value: "$0",
            trendUp: true,
          },
          { label: "Services This Week", value: "0", trendUp: false },
          { label: "New Clients", value: "0", trendUp: false },
          {
            label: "Pending Approvals",
            value: String(pendingApprovals),
            pendingBadge: pendingApprovals > 0,
          },
        ].map((m) => (
          <div
            key={m.label}
            className="group rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
          >
            <p className="text-sm font-medium text-neutral-500">{m.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-semibold tabular-nums text-[#C9A84C]">{m.value}</p>
              {"trendUp" in m && m.trendUp ? (
                <TrendingUp className="size-5 text-emerald-500/90" aria-hidden />
              ) : null}
              {"pendingBadge" in m && m.pendingBadge ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {pendingApprovals}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/inventory/add"
          className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-[#1f1f1f]"
        >
          Add Inventory
        </Link>
        <Link
          href="/schedule"
          className="rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-[#1f1f1f]"
        >
          View Schedule
        </Link>
        <Link
          href="/reyna-ai"
          className="inline-flex items-center gap-2 rounded-xl bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-[#0d0d0d] hover:bg-[#b89642]"
        >
          <Sparkles className="size-4" />
          Ask Reyna AI
        </Link>
      </div>

      <section className="mt-10 rounded-2xl border border-[#2a2a2a] bg-[#161616] p-6">
        <h2 className="text-lg font-semibold text-neutral-100">Recent Activity</h2>
        <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
          <p className="text-4xl">📋</p>
          <p className="mt-3 max-w-md text-sm text-neutral-500">
            No activity yet — data will appear as your team uses the portal
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[#2a2a2a] bg-[#161616] p-6">
        <h2 className="text-lg font-semibold text-neutral-100">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No alerts right now.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[#2a2a2a] bg-[#1f1f1f] px-4 py-3"
              >
                <p className="font-medium text-neutral-200">{a.title}</p>
                <p className="mt-1 text-sm text-neutral-500">{a.body}</p>
                <p className="mt-2 text-xs text-neutral-600">
                  {a.severity} · {new Date(a.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
