import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const staff = await prisma.staffMember.findMany({
    include: { location: true },
    orderBy: [{ location: { name: "asc" } }, { fullName: "asc" }],
  });

  return NextResponse.json({ staff });
}
