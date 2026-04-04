import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const createSchema = z.object({
  brand: z.string().min(1),
  productName: z.string().min(1),
  category: z.string().min(1),
  locationId: z.string().min(1),
  quantityOnHand: z.number().nonnegative().optional(),
  reorderThreshold: z.number().nonnegative().optional(),
  supplier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  shadeOrVolume: z.string().optional().nullable(),
});

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const items = await prisma.inventoryItem.findMany({
    include: { location: true },
    orderBy: [{ location: { name: "asc" } }, { brand: "asc" }, { productName: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { response } = await requireSession();
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

  const item = await prisma.inventoryItem.create({
    data: {
      brand: d.brand,
      productName: d.productName,
      category: d.category,
      locationId: d.locationId,
      quantityOnHand: qty,
      reorderThreshold: threshold,
      supplier: d.supplier ?? null,
      notes: d.notes ?? null,
      shadeOrVolume: d.shadeOrVolume ?? null,
      isLowStock,
      approvalStatus: "approved",
    },
    include: { location: true },
  });

  return NextResponse.json({ item });
}
