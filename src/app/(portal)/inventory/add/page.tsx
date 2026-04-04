import { prisma } from "@/lib/prisma";

import { AddInventoryForm } from "./add-inventory-form";

export default async function AddInventoryPage() {
  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Add inventory item</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Track stock by salon location. Low and critical levels use your reorder threshold.
      </p>
      <div className="mt-8">
        <AddInventoryForm locations={locations} />
      </div>
    </div>
  );
}
