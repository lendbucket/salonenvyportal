import { SquareClient, SquareEnvironment } from "square"

// Static catalog — fallback when Square API is unavailable
// Last updated: April 2026
export const STATIC_CATALOG: Record<string, { name: string; price: number; durationMinutes: number }> = {
  // Cuts
  "POE6SDZB3ISP2MPUO6TV2K3T": { name: "Envy Cut®", price: 85, durationMinutes: 45 },
  "QMPSENCSASW4UIOPTQFJPUED": { name: "Envy Dry Cut®", price: 70, durationMinutes: 30 },
  "EZ6V2LLLWT4MZSZUNVPMDJN7": { name: "Envy Men's Haircut®", price: 35, durationMinutes: 30 },
  "DDCKYSU2WSDSDJSFQLXS2KSD": { name: "Envy Children's Cut®", price: 43, durationMinutes: 30 },
  "MRIUJBOXXNIJKWJGWUVIQNI6": { name: "Bang Trim", price: 12, durationMinutes: 15 },
  "KEIPWOBHQM5AJ6D2YA4OKWBB": { name: "Envy Trim®", price: 35, durationMinutes: 30 },
  "WZGEY6FQD4FBHPOW44YENGQY": { name: "Envy Men's Trim®", price: 25, durationMinutes: 20 },
  "YN5ZLP5KFYK4FRUZZ5WETXQV": { name: "Envy Children's Trim®", price: 20, durationMinutes: 20 },
  "RUTBAQ35T3VIWN2N7XQQJL2S": { name: "Envy Dry Cut® + Style", price: 85, durationMinutes: 30 },
  // Color
  "3N3MWKKUO5ZLSPRV77K6SX4Z": { name: "Full Highlight", price: 210, durationMinutes: 270 },
  "3UI5L7VG7WWPD3KJDSMECBYE": { name: "Partial Highlight", price: 165, durationMinutes: 120 },
  "KIEQ7NE6EKITICOUCKGVAO3K": { name: "Partial Highlight & Base Color", price: 200, durationMinutes: 150 },
  "MYWNX5PWUQU34FPT5VRUS7KJ": { name: "Envy Color®", price: 110, durationMinutes: 95 },
  "SV4PGKMCWEKTSWGIGUQX6ZVE": { name: "Color Touch Up", price: 130, durationMinutes: 90 },
  "2UIPZ6UL2E3BCPDKW57FST74": { name: "Blonde Touch Up", price: 155, durationMinutes: 150 },
  "2TDK7VZIKPB6IVRVKZS53Y2W": { name: "Envy Blonde®", price: 265, durationMinutes: 150 },
  "HIVCZWVEXFWHUQXI6FMAE5PK": { name: "Full Highlight & Base Color", price: 240, durationMinutes: 240 },
  "STMYYY7OH5IIEIOSV5U5ZNQM": { name: "Wedding Updo", price: 150, durationMinutes: 60 },
  "EPHRYYHYKXOUS3AMWBVMWLVW": { name: "Toner", price: 130, durationMinutes: 45 },
  "KCBATXZWQ5WJ2MQKD6CZMJL6": { name: "Envy Gloss®", price: 55, durationMinutes: 30 },
  "PHC4JW6TWTLLI3YREQ2Q3VHM": { name: "Brazilian Blowout", price: 250, durationMinutes: 180 },
  // Add-ons
  "W2PGQF37TRD63JZN6GKSR7WC": { name: "Extra Bowl - Bleach", price: 53, durationMinutes: 30 },
  "4PK44QOV5RZFMWKK5NBXASNK": { name: "Extra Bowl - Color", price: 40, durationMinutes: 30 },
  "64LUY6AYVAD6M4GT4H5ELQZL": { name: "Extra Bowl", price: 53, durationMinutes: 30 },
  "NY6PW3FTWO74QTZ2W3L47TKX": { name: "Extra Bowl - Toner", price: 53, durationMinutes: 30 },
  "7SUXOQACVU6RPNGN33S4YXQQ": { name: "Envy Treatment®", price: 15, durationMinutes: 10 },
  "YWBAGHCQOFEO267RSWUPTKLN": { name: "Brow Wax", price: 25, durationMinutes: 10 },
  "V6GZJJ3UAVNWD4QDY5MNM5ET": { name: "Olaplex 4c Hair Treatment", price: 20, durationMinutes: 15 },
  "B2ABXNFZP24OLVGNOZCFJQMR": { name: "Envy Scalp Treatment®", price: 25, durationMinutes: 20 },
}

// Keep backward compat — CATALOG is the static version used by getFullCache/getServiceName
export const CATALOG = STATIC_CATALOG

// ── Dynamic catalog from Square API with 1-hour memory cache ──

interface CatalogItem {
  id: string
  name: string
  variationName: string
  price: number
  durationMinutes: number
}

let cachedItems: CatalogItem[] | null = null
let cacheExpiry = 0

export async function getCatalogItems(): Promise<CatalogItem[]> {
  if (cachedItems && Date.now() < cacheExpiry) return cachedItems

  try {
    const square = new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production })
    const items: CatalogItem[] = []

    let page = await square.catalog.list({ types: "ITEM" })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processPage = (data: any[]) => {
      for (const item of data) {
        if (item.type !== "ITEM" || !item.itemData?.variations) continue
        for (const v of item.itemData.variations) {
          const vd = v.itemVariationData || v.item_variation_data
          if (!vd) continue
          const price = vd.priceMoney?.amount ? Number(vd.priceMoney.amount) / 100 : 0
          const dur = vd.serviceDuration ? Math.round(Number(vd.serviceDuration) / 60000) : 30
          items.push({
            id: v.id || "",
            name: item.itemData.name || "Service",
            variationName: vd.name || "Regular",
            price,
            durationMinutes: dur,
          })
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processPage(page.data as unknown as any[])
    while (page.hasNextPage()) {
      page = await page.getNextPage()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processPage(page.data as unknown as any[])
    }

    items.sort((a, b) => a.name.localeCompare(b.name))
    cachedItems = items
    cacheExpiry = Date.now() + 60 * 60 * 1000
    console.log("[catalog] Loaded", items.length, "services from Square")
    return items
  } catch (err) {
    console.error("[catalog] Square fetch failed, using static fallback:", err instanceof Error ? err.message : err)
    return Object.entries(STATIC_CATALOG).map(([id, item]) => ({
      id,
      name: item.name,
      variationName: "Regular",
      price: item.price,
      durationMinutes: item.durationMinutes,
    }))
  }
}

// ── Backward-compatible helpers (used by appointments, cancellations, POS) ──

export function getServiceName(variationId: string): string {
  return CATALOG[variationId]?.name || "Service"
}

export function getServicePrice(variationId: string): number {
  return CATALOG[variationId]?.price || 0
}

export function getServiceDuration(variationId: string): number {
  return CATALOG[variationId]?.durationMinutes || 0
}

export function getServiceInfo(variationId: string): { name: string; price: number; durationMinutes: number } {
  return CATALOG[variationId] || { name: "Service", price: 0, durationMinutes: 0 }
}

export function getFullCache(): Record<string, { name: string; price: number; durationMinutes: number }> {
  return CATALOG
}

// Backward compatibility stubs
export async function refreshCatalogCache(): Promise<void> { await getCatalogItems() }
export async function getBulkServiceNames(ids: string[]): Promise<Record<string, string>> {
  return Object.fromEntries(ids.map(id => [id, getServiceName(id)]))
}
export async function fetchVariationDirect(variationId: string): Promise<{ name: string; price: number; durationMinutes: number }> {
  return CATALOG[variationId] || { name: "Service", price: 0, durationMinutes: 0 }
}
