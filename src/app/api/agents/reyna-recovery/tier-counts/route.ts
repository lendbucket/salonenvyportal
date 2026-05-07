import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")

  // Count clients per vipTier (only those with phone + SMS consent)
  const vipCounts = await prisma.client.groupBy({
    by: ["vipTier"],
    where: { phone: { not: null }, smsMarketingConsent: true, smsOptedOutAt: null },
    _count: true,
  })

  const valueCounts = await prisma.client.groupBy({
    by: ["valueTier"],
    where: { phone: { not: null }, smsMarketingConsent: true, smsOptedOutAt: null },
    _count: true,
  })

  const vip: Record<string, number> = {}
  for (const r of vipCounts) vip[r.vipTier || "UNKNOWN"] = r._count
  const value: Record<string, number> = {}
  for (const r of valueCounts) value[r.valueTier || "UNKNOWN"] = r._count

  return NextResponse.json({ vip, value })
}
