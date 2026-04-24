"use client"
import { useEffect, useState } from "react"
import { AddInventoryForm } from "./add-inventory-form"

type Loc = { id: string; name: string }

export default function AddInventoryPage() {
  const [locations, setLocations] = useState<Loc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/locations")
      .then(r => r.json())
      .then(d => setLocations(d.locations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Add inventory item</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Track stock by salon location. Low and critical levels use your reorder threshold.
      </p>
      <div className="mt-8">
        {loading ? (
          <div style={{ color: "rgba(26,19,19,0.4)", fontSize: "13px" }}>Loading locations...</div>
        ) : locations.length === 0 ? (
          <div style={{ color: "rgba(26,19,19,0.4)", fontSize: "13px" }}>No locations found.</div>
        ) : (
          <AddInventoryForm locations={locations} />
        )}
      </div>
    </div>
  )
}
