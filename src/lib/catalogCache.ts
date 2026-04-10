import { SquareClient, SquareEnvironment } from "square"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

// variation_id → { name, price (cents), durationMinutes }
let catalogCache: Record<string, { name: string; price: number; durationMinutes: number }> = {}
let cacheExpiry = 0

export async function getServiceName(variationId: string): Promise<string> {
  if (Date.now() > cacheExpiry || Object.keys(catalogCache).length === 0) {
    await refreshCatalogCache()
  }
  return catalogCache[variationId]?.name || "Service"
}

export async function getServiceInfo(variationId: string): Promise<{ name: string; price: number; durationMinutes: number }> {
  if (Date.now() > cacheExpiry || Object.keys(catalogCache).length === 0) {
    await refreshCatalogCache()
  }
  return catalogCache[variationId] || { name: "Service", price: 0, durationMinutes: 60 }
}

export async function getBulkServiceNames(variationIds: string[]): Promise<Record<string, string>> {
  if (Date.now() > cacheExpiry || Object.keys(catalogCache).length === 0) {
    await refreshCatalogCache()
  }
  const result: Record<string, string> = {}
  for (const id of variationIds) {
    result[id] = catalogCache[id]?.name || "Service"
  }
  return result
}

export async function getFullCache(): Promise<Record<string, { name: string; price: number; durationMinutes: number }>> {
  if (Date.now() > cacheExpiry || Object.keys(catalogCache).length === 0) {
    await refreshCatalogCache()
  }
  return { ...catalogCache }
}

export async function refreshCatalogCache() {
  try {
    const square = getSquare()
    const newCache: Record<string, { name: string; price: number; durationMinutes: number }> = {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function processItems(items: any[]) {
      for (const obj of items) {
        if (obj.type !== "ITEM") continue
        const itemData = obj.itemData
        if (!itemData?.variations) continue
        for (const v of itemData.variations) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vData = (v as any).itemVariationData
          if (!vData || !v.id) continue
          newCache[v.id] = {
            name: vData.name || itemData.name || "Service",
            price: Number(vData.priceMoney?.amount || 0),
            durationMinutes: 60,
          }
        }
      }
    }

    let page = await square.catalog.list({ types: "ITEM" })
    processItems(page.data || [])
    while (page.hasNextPage()) {
      page = await page.getNextPage()
      processItems(page.data || [])
    }

    catalogCache = newCache
    cacheExpiry = Date.now() + 30 * 60 * 1000 // 30 min cache
  } catch (e) {
    console.error("Catalog cache refresh failed:", e)
  }
}
