"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Loc = { id: string; name: string };

type StaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  position: string;
  inviteStatus: string;
  location: Loc;
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function badgeFor(status: string) {
  const s = status.toLowerCase();
  if (s === "active")
    return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  if (s === "invited") return "bg-amber-500/15 text-amber-300 ring-amber-500/35";
  return "bg-neutral-600/30 text-neutral-400 ring-neutral-500/30";
}

function labelFor(status: string) {
  const s = status.toLowerCase();
  if (s === "not_invited") return "not invited";
  return s;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [locationTab, setLocationTab] = useState<"all" | "cc" | "sa">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/staff");
      const data = (await res.json()) as { staff?: StaffRow[] };
      if (!res.ok) throw new Error("Could not load staff");
      setStaff(data.staff ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return staff.filter((m) => {
      if (locationTab === "cc" && m.location.name !== "Corpus Christi") return false;
      if (locationTab === "sa" && m.location.name !== "San Antonio") return false;
      return true;
    });
  }, [staff, locationTab]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Staff</h1>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-[#0d0d0d] hover:bg-[#b89642]"
        >
          Invite Staff
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "cc" as const, label: "Corpus Christi" },
            { id: "sa" as const, label: "San Antonio" },
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

      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading team…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-[#2a2a2a] bg-[#161616] px-6 py-16 text-center">
          <Users className="size-12 text-neutral-600" />
          <p className="mt-4 text-neutral-400">No staff found for this filter.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="rounded-2xl border border-[#2a2a2a] bg-[#161616] p-5 transition hover:border-[#C9A84C]/25"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#2a2618] text-sm font-semibold text-[#C9A84C] ring-1 ring-[#C9A84C]/30">
                  {initials(m.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-100">{m.fullName}</p>
                  <p className="text-sm capitalize text-neutral-500">{m.position}</p>
                  {m.email ? (
                    <Link
                      href={`mailto:${m.email}`}
                      className="mt-1 block truncate text-xs text-[#C9A84C]/80 hover:underline"
                    >
                      {m.email}
                    </Link>
                  ) : null}
                  <p className="mt-2 text-xs text-neutral-600">{m.location.name}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${badgeFor(m.inviteStatus)}`}
                >
                  {labelFor(m.inviteStatus)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
