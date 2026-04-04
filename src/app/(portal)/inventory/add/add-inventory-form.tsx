"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Loc = { id: string; name: string };

const CATEGORIES = ["Color", "Bleach", "Toner", "Shampoo", "Other"] as const;

export function AddInventoryForm({ locations }: { locations: Loc[] }) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("2");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(quantity);
    const th = Number(reorderThreshold);
    if (!brand.trim() || !productName.trim() || !locationId) {
      setError("Brand, product, and location are required.");
      return;
    }
    if (Number.isNaN(qty) || qty < 0) {
      setError("Quantity must be a valid number.");
      return;
    }
    if (Number.isNaN(th) || th < 0) {
      setError("Reorder threshold must be valid.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(),
          productName: productName.trim(),
          category,
          locationId,
          quantityOnHand: qty,
          reorderThreshold: th,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save item.");
        return;
      }
      router.push("/inventory");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[#2a2a2a] bg-[#161616] p-6 md:p-8"
    >
      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Brand
        </label>
        <input
          required
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
        />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Product name
        </label>
        <input
          required
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Location
          </label>
          <select
            required
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Quantity
          </label>
          <input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Reorder threshold
          </label>
          <input
            inputMode="decimal"
            value={reorderThreshold}
            onChange={(e) => setReorderThreshold(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Supplier
        </label>
        <input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
        />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 focus:ring-2"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[#C9A84C] py-3 text-sm font-semibold text-[#0d0d0d] transition hover:bg-[#b89642] disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save item"}
      </button>
    </form>
  );
}
