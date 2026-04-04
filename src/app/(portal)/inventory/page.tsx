"use client";

import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Loc = { id: string; name: string; address: string; phone: string };

type Item = {
  id: string;
  brand: string;
  productName: string;
  category: string;
  quantityOnHand: number;
  reorderThreshold: number;
  location: Loc;
};

const CATEGORIES = ["All", "Color", "Bleach", "Toner", "Shampoo", "Other"] as const;

function statusFor(qty: number, threshold: number): { label: string; className: string } {
  if (qty <= 0) return { label: "Critical", className: "bg-red-500/20 text-red-400 ring-red-500/40" };
  if (qty <= threshold)
    return { label: "Low", className: "bg-amber-500/20 text-amber-300 ring-amber-500/35" };
  return { label: "OK", className: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30" };
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [locationTab, setLocationTab] = useState<"all" | "cc" | "sa">("all");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/inventory");
      const data = (await res.json()) as { items?: Item[]; error?: unknown };
      if (!res.ok) throw new Error("Could not load inventory");
      setItems(data.items ?? []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (locationTab === "cc" && it.location.name !== "Corpus Christi") return false;
      if (locationTab === "sa" && it.location.name !== "San Antonio") return false;
      if (category !== "All" && it.category !== category) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        const hay = `${it.brand} ${it.productName} ${it.category} ${it.location.name}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, locationTab, category, q]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Inventory</h1>
        <Link
          href="/inventory/add"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-[#0d0d0d] hover:bg-[#b89642]"
        >
          <Plus className="size-4" />
          Add Item
        </Link>
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

      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              category === c
                ? "bg-[#2a2618] text-[#C9A84C] ring-1 ring-[#C9A84C]/40"
                : "bg-[#1a1a1a] text-neutral-500 hover:bg-[#222]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brand, product, category…"
          className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] py-2.5 pl-10 pr-4 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 placeholder:text-neutral-600 focus:ring-2"
        />
      </div>

      {fetchError ? (
        <p className="mt-4 text-sm text-red-400">{fetchError}</p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading inventory…</p>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a2a2a] bg-[#161616] px-6 py-16 text-center">
          <Package className="size-12 text-neutral-600" aria-hidden />
          <p className="mt-4 text-lg font-medium text-neutral-300">No inventory items yet</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">
            Add your first product to track stock by location.
          </p>
          <Link
            href="/inventory/add"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-[#0d0d0d] hover:bg-[#b89642]"
          >
            <Plus className="size-4" />
            Add your first inventory item
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-neutral-500">
          No items match your filters. Try adjusting search or tabs.
        </p>
      ) : (
        <>
          <div className="mt-8 hidden overflow-hidden rounded-xl border border-[#2a2a2a] md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1a1a1a] text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {filtered.map((it) => {
                  const st = statusFor(it.quantityOnHand, it.reorderThreshold);
                  return (
                    <tr key={it.id} className="bg-[#161616] hover:bg-[#1c1c1c]">
                      <td className="px-4 py-3 text-neutral-200">{it.brand}</td>
                      <td className="px-4 py-3 text-neutral-100">{it.productName}</td>
                      <td className="px-4 py-3 text-neutral-400">{it.category}</td>
                      <td className="px-4 py-3 text-neutral-400">{it.location.name}</td>
                      <td className="px-4 py-3 tabular-nums text-neutral-200">{it.quantityOnHand}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${st.className}`}
                        >
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="mt-6 space-y-3 md:hidden">
            {filtered.map((it) => {
              const st = statusFor(it.quantityOnHand, it.reorderThreshold);
              return (
                <li
                  key={it.id}
                  className="rounded-xl border border-[#2a2a2a] bg-[#161616] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-neutral-100">{it.productName}</p>
                      <p className="text-sm text-neutral-500">{it.brand}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${st.className}`}
                    >
                      {st.label}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                    <div>
                      <dt className="text-neutral-600">Category</dt>
                      <dd className="text-neutral-300">{it.category}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-600">Location</dt>
                      <dd className="text-neutral-300">{it.location.name}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-600">Qty</dt>
                      <dd className="tabular-nums text-neutral-200">{it.quantityOnHand}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
