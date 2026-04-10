import { SquareClient, SquareEnvironment } from "square"

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  })
}

// variation_id → { name (item name, not "Regular"), price (cents), durationMinutes }
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

/** Fetch a single variation directly from Square API (fallback for cache misses) */
export async function fetchVariationDirect(variationId: string): Promise<{ name: string; price: number; durationMinutes: number }> {
  try {
    const square = getSquare()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await square.catalog.object.get({ objectId: variationId }) as any
    const obj = res.object
    if (!obj) return { name: "Service", price: 0, durationMinutes: 0 }

    const vData = obj.itemVariationData
    if (!vData) return { name: "Service", price: 0, durationMinutes: 0 }

    // Try to get the parent item name
    let itemName = vData.name || "Service"
    if (vData.itemId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentRes = await square.catalog.object.get({ objectId: vData.itemId }) as any
        if (parentRes.object?.itemData?.name) {
          itemName = parentRes.object.itemData.name
        }
      } catch { /* use variation name */ }
    }

    const price = vData.priceMoney?.amount ? Number(vData.priceMoney.amount) : 0
    const durationMs = vData.serviceDuration ? Number(vData.serviceDuration) : 0
    const durationMinutes = durationMs > 0 ? Math.round(durationMs / 60000) : 0

    // Store in cache for future lookups
    catalogCache[variationId] = { name: itemName, price, durationMinutes }

    return { name: itemName, price, durationMinutes }
  } catch {
    return { name: "Service", price: 0, durationMinutes: 0 }
  }
}

export async function refreshCatalogCache() {
  try {
    const square = getSquare()
    const newCache: Record<string, { name: string; price: number; durationMinutes: number }> = {}

    // Map of item_id → item_name for parent name lookups
    const itemNameMap: Record<string, string> = {}

    // Step 1: Fetch all ITEM types — get item names + embedded variations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function processItems(items: any[]) {
      for (const obj of items) {
        if (obj.type !== "ITEM") continue
        const itemData = obj.itemData
        if (!itemData) continue
        const itemName = itemData.name || "Service"
        if (obj.id) itemNameMap[obj.id] = itemName

        for (const v of itemData.variations || []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vData = (v as any).itemVariationData
          if (!vData || !v.id) continue

          const price = vData.priceMoney?.amount ? Number(vData.priceMoney.amount) : 0
          const durationMs = vData.serviceDuration ? Number(vData.serviceDuration) : 0
          const durationMinutes = durationMs > 0 ? Math.round(durationMs / 60000) : 0

          // Use ITEM name (e.g. "Envy Cut®") not variation name (e.g. "Regular")
          newCache[v.id] = {
            name: itemName,
            price,
            durationMinutes,
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

    // Step 2: Fetch ITEM_VARIATION types directly to catch any missed variations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function processVariations(items: any[]) {
      for (const obj of items) {
        if (obj.type !== "ITEM_VARIATION") continue
        if (!obj.id) continue

        // Only add if not already in cache from Step 1
        const vData = obj.itemVariationData
        if (!vData) continue

        const price = vData.priceMoney?.amount ? Number(vData.priceMoney.amount) : 0
        const durationMs = vData.serviceDuration ? Number(vData.serviceDuration) : 0
        const durationMinutes = durationMs > 0 ? Math.round(durationMs / 60000) : 0

        if (!newCache[obj.id]) {
          // Use parent item name if we fetched it, otherwise fall back to variation name
          const parentId = vData.itemId || ""
          const name = itemNameMap[parentId] || vData.name || "Service"
          newCache[obj.id] = { name, price, durationMinutes }
        } else {
          // Update price/duration if we got better data
          if (price > 0 && newCache[obj.id].price === 0) {
            newCache[obj.id].price = price
          }
          if (durationMinutes > 0 && newCache[obj.id].durationMinutes === 0) {
            newCache[obj.id].durationMinutes = durationMinutes
          }
        }
      }
    }

    let varPage = await square.catalog.list({ types: "ITEM_VARIATION" })
    processVariations(varPage.data || [])
    while (varPage.hasNextPage()) {
      varPage = await varPage.getNextPage()
      processVariations(varPage.data || [])
    }

    catalogCache = newCache
    cacheExpiry = Date.now() + 30 * 60 * 1000 // 30 min TTL
    console.log(`[CatalogCache] Loaded ${Object.keys(newCache).length} variations`)
  } catch (e) {
    console.error("Catalog cache refresh failed:", e)
  }
}
