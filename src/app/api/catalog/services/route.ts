import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SquareClient, SquareEnvironment } from "square"

function getSquare() { return new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production }) }

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const square = getSquare()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = []
    let cursor: string | undefined
    do {
      const res = await square.catalog.list({ types: "ITEM", cursor })
      for (const obj of (res.data || [])) allItems.push(obj)
      cursor = res.hasNextPage() ? undefined : undefined // SDK handles pagination
      if (res.hasNextPage()) { const next = await res.getNextPage(); for (const obj of next.data) allItems.push(obj); if (!next.hasNextPage()) break } else break
    } while (false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const services: any[] = []
    for (const item of allItems) {
      if (item.type !== "ITEM") continue
      const itemData = item.itemData
      if (!itemData?.variations) continue
      for (const v of itemData.variations) {
        const vData = v.itemVariationData
        if (!vData) continue
        services.push({
          id: v.id,
          name: vData.name || itemData.name || "Service",
          price: Number(vData.priceMoney?.amount || 0) / 100,
          durationMinutes: 60, // Default — Square doesn't always include this
          version: v.version,
        })
      }
    }

    return NextResponse.json({ services: services.sort((a, b) => a.name.localeCompare(b.name)) })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Catalog fetch failed", services: [] })
  }
}
