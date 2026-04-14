import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CATALOG } from "@/lib/catalogCache"

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Use the static catalog cache — always fast, always available
  const services = Object.entries(CATALOG).map(([id, item]) => ({
    id,
    name: item.name,
    price: item.price,
    durationMinutes: item.durationMinutes,
  })).sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ services })
}
