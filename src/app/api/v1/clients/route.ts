import { NextRequest } from "next/server"
import { validateApiKey, apiResponse, apiError } from "@/lib/api-v1-auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return apiError(auth.error!, auth.status || 401)
  if (!auth.apiKey!.permissions.includes("clients:read")) {
    return apiError("Insufficient permissions: clients:read required", 403)
  }

  const q = req.nextUrl.searchParams.get("q") || ""
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 200)

  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {},
    take: limit,
    orderBy: { lastVisitAt: "desc" },
  })

  return apiResponse({
    clients: clients.map((c) => ({
      id: c.id,
      squareCustomerId: c.squareCustomerId,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown",
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      totalVisits: c.totalVisits,
      totalSpend: c.totalSpend,
      lastVisitAt: c.lastVisitAt,
      cardOnFile: c.cardOnFile,
    })),
    total: clients.length,
  })
}
