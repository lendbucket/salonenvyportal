import { NextRequest } from "next/server"
import { SquareClient, SquareEnvironment } from "square"
import { validateApiKey, apiResponse, apiError } from "@/lib/api-v1-auth"

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return apiError(auth.error!, auth.status || 401)
  if (!auth.apiKey!.permissions.includes("services:read")) {
    return apiError("Insufficient permissions: services:read required", 403)
  }

  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    const result = await square.catalog.list({ types: "ITEM" })
    const services: { id: string; name: string; category: string; price: number; durationMinutes: number | null; isActive: boolean }[] = []

    for (const item of result.data || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemObj = item as any
      if (itemObj.type !== "ITEM" || !itemObj.itemData) continue
      for (const variation of itemObj.itemData.variations || []) {
        const varData = variation.itemVariationData || {}
        const price = varData.priceMoney
        services.push({
          id: variation.id,
          name: varData.name || itemObj.itemData.name || "",
          category: itemObj.itemData.name || "",
          price: price ? Number(price.amount || 0) / 100 : 0,
          durationMinutes: varData.serviceDuration ? Number(varData.serviceDuration) / 60000 : null,
          isActive: !itemObj.isDeleted,
        })
      }
    }

    return apiResponse({ services, total: services.length })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to fetch services", 500)
  }
}
