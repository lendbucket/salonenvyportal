import { AddInventoryForm } from "./add-inventory-form"

/** Static placeholders — no DB on load (restore prisma.location.findMany when debugging DB). */
const LOCATIONS = [
  { id: "placeholder-cc", name: "Corpus Christi" },
  { id: "placeholder-sa", name: "San Antonio" },
]

export default function AddInventoryPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Add inventory item</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Track stock by salon location. Low and critical levels use your reorder threshold.
      </p>
      <div className="mt-8">
        <AddInventoryForm locations={LOCATIONS} />
      </div>
    </div>
  )
}
