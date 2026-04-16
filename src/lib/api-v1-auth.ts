import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"
import { checkRateLimit } from "@/lib/api-rate-limit"

interface ApiKeyRecord {
  id: string
  keyId: string
  locationId: string | null
  permissions: string[]
  isActive: boolean
  expiresAt: Date | null
  ipWhitelist: string[]
}

export async function validateApiKey(req: NextRequest): Promise<{
  valid: boolean
  apiKey?: ApiKeyRecord
  error?: string
  status?: number
}> {
  const authHeader = req.headers.get("authorization")
  const apiKeyHeader = req.headers.get("x-api-key")

  let rawKey = ""
  if (authHeader?.startsWith("Bearer ")) {
    rawKey = authHeader.substring(7)
  } else if (apiKeyHeader) {
    rawKey = apiKeyHeader
  }

  if (!rawKey) {
    return { valid: false, error: "Missing API key. Include X-API-Key header or Authorization: Bearer <key>", status: 401 }
  }

  const dotIndex = rawKey.lastIndexOf(".")
  if (dotIndex === -1) {
    return { valid: false, error: "Invalid API key format. Expected: sk_live_xxxx.secret", status: 401 }
  }

  const keyId = rawKey.substring(0, dotIndex)
  const keySecret = rawKey.substring(dotIndex + 1)

  const apiKey = await prisma.apiKey.findUnique({ where: { keyId } })
  if (!apiKey || !apiKey.isActive) {
    return { valid: false, error: "Invalid or inactive API key", status: 401 }
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: "API key has expired", status: 401 }
  }

  const secretValid = await compare(keySecret, apiKey.keySecretHash)
  if (!secretValid) {
    return { valid: false, error: "Invalid API key", status: 401 }
  }

  if (apiKey.ipWhitelist.length > 0) {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || ""
    if (!apiKey.ipWhitelist.includes(clientIp)) {
      return { valid: false, error: "IP address not whitelisted", status: 403 }
    }
  }

  // Rate limit check
  const rl = checkRateLimit(apiKey.keyId)
  if (!rl.allowed) {
    return { valid: false, error: "Rate limit exceeded. Try again later.", status: 429 }
  }

  // Update usage (non-blocking)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
  }).catch(() => {})

  prisma.apiKeyLog.create({
    data: {
      apiKeyId: apiKey.id,
      endpoint: new URL(req.url).pathname,
      method: req.method,
      statusCode: 200,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  }).catch(() => {})

  return { valid: true, apiKey }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiResponse(data: any, status = 200) {
  return Response.json(
    { success: true, data, timestamp: new Date().toISOString() },
    {
      status,
      headers: {
        "X-RateLimit-Limit": "1000",
        "Content-Type": "application/json",
      },
    }
  )
}

export function apiError(message: string, status = 400, code?: string) {
  return Response.json(
    { success: false, error: { message, code: code || "ERROR", status }, timestamp: new Date().toISOString() },
    { status }
  )
}
