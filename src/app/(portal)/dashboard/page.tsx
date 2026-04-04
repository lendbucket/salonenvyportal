"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

type LocationTab = "cc" | "sa" | "both";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [locationTab, setLocationTab] = useState<LocationTab>("both");
  const pendingApprovals = 0;

  const firstName = session?.user?.name?.split(/\s+/)[0] ?? "Robert";

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

  const metrics: {
    label: string;
    value: string;
    showDollar: boolean;
    badge?: boolean;
  }[] = [
    { label: "Revenue This Week", value: "0", showDollar: true },
    { label: "Services This Week", value: "0", showDollar: false },
    { label: "New Clients", value: "0", showDollar: false },
    {
      label: "Pending Approvals",
      value: String(pendingApprovals),
      showDollar: false,
      badge: pendingApprovals > 0,
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100 md:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[#888]">{dateStr}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                locationTab === t.id
                  ? "bg-[#C9A84C] text-[#0d0d0d] shadow-[0_0_20px_-4px_rgba(201,168,76,0.5)]"
                  : "bg-[#1f1f1f] text-neutral-400 ring-1 ring-[#2a2a2a] hover:bg-[#252525]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="group rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] p-5 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.45)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55),0_8px_24px_-8px_rgba(201,168,76,0.08)]"
          >
            <p className="text-sm font-medium text-[#888]">{m.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              {m.showDollar ? (
                <span className="text-xl font-semibold text-[#C9A84C]">$</span>
              ) : null}
              <p className="text-3xl font-semibold tabular-nums text-[#C9A84C]">{m.value}</p>
              {m.badge ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingApprovals}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#888]">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/inventory/add"
            className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-[#C9A84C]/45 hover:bg-[#1f1f1f]"
          >
            <span aria-hidden>➕</span>
            Add Inventory
          </Link>
          <Link
            href="/schedule"
            className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-[#C9A84C]/45 hover:bg-[#1f1f1f]"
          >
            <span aria-hidden>📅</span>
            View Schedule
          </Link>
          <Link
            href="/reyna-ai"
            className="inline-flex items-center gap-2 rounded-xl bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-[#0d0d0d] shadow-[0_6px_28px_-8px_rgba(201,168,76,0.55)] transition hover:bg-[#b89642] hover:shadow-[0_8px_32px_-8px_rgba(201,168,76,0.45)]"
          >
            <span aria-hidden>✨</span>
            Ask Reyna AI
          </Link>
        </div>
      </div>

      <section className="mt-10 rounded-2xl border border-[#2a2a2a] bg-[#161616] p-8">
        <h2 className="text-lg font-semibold text-neutral-100">Recent activity</h2>
        <div className="mt-10 flex flex-col items-center justify-center py-6 text-center">
          <p className="text-4xl" aria-hidden>
            ✨
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#888]">
            No activity yet — when your team uses the portal, updates will show up here.
          </p>
        </div>
      </section>
    </div>
  );
}
