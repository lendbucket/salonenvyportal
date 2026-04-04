import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const { prisma } = await import("@/lib/prisma");
  const staff = await prisma.staffMember.findMany({
    include: { location: true },
    orderBy: [{ location: { name: "asc" } }, { fullName: "asc" }],
  });

  return NextResponse.json({ staff });
}
