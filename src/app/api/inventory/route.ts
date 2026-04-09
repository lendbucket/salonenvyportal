import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/api-auth";
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger";

const createSchema = z.object({
  brand: z.string().min(1),
  productName: z.string().min(1),
  category: z.string().min(1),
  locationId: z.string().min(1),
  quantityOnHand: z.number().nonnegative().optional(),
  reorderThreshold: z.number().nonnegative().optional(),
  reorderQty: z.number().int().positive().optional(),
  shadeOrVolume: z.string().optional().nullable(),
  unitType: z.string().optional().nullable(),
  costPerUnit: z.number().nonnegative().optional().nullable(),
  ouncesPerUnit: z.number().nonnegative().optional().nullable(),
  ouncesPerService: z.number().nonnegative().optional().nullable(),
  ouncesOnHand: z.number().nonnegative().optional().nullable(),
  supplier: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { response, session } = await requireSession();
  if (response) return response;

  const role = (session?.user as Record<string, unknown>)?.role as string
  const userLocationId = (session?.user as Record<string, unknown>)?.locationId as string | undefined

  const { prisma } = await import("@/lib/prisma");
  const items = await prisma.inventoryItem.findMany({
    where: role === "MANAGER" && userLocationId ? { locationId: userLocationId } : {},
    include: { location: true },
    orderBy: [{ isLowStock: "desc" }, { brand: "asc" }, { productName: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { response, session } = await requireSession();
  if (response) return response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const qty = d.quantityOnHand ?? 0;
  const threshold = d.reorderThreshold ?? 2;
  const isLowStock = qty <= threshold;

  const { prisma } = await import("@/lib/prisma");
  const item = await prisma.inventoryItem.create({
    data: {
      brand: d.brand,
      productName: d.productName,
      category: d.category,
      locationId: d.locationId,
      quantityOnHand: qty,
      reorderThreshold: threshold,
      reorderQty: d.reorderQty ?? 6,
      shadeOrVolume: d.shadeOrVolume ?? null,
      unitType: d.unitType ?? null,
      costPerUnit: d.costPerUnit ?? null,
      ouncesPerUnit: d.ouncesPerUnit ?? null,
      ouncesPerService: d.ouncesPerService ?? null,
      ouncesOnHand: d.ouncesOnHand ?? null,
      supplier: d.supplier ?? null,
      sku: d.sku ?? null,
      notes: d.notes ?? null,
      isLowStock,
      approvalStatus: "approved",
    },
    include: { location: true },
  });

  logAction({ action: AUDIT_ACTIONS.INVENTORY_ADDED, entity: "InventoryItem", entityId: item.id, userId: (session?.user as Record<string, unknown>)?.id as string, metadata: { brand: item.brand, name: item.productName }, locationId: item.locationId });
  return NextResponse.json({ item });
}
