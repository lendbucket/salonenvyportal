/**
 * Custom webhook HRIS provider.
 * POST payload to configured URL with HMAC-SHA256 signature.
 */

import { createHmac } from "node:crypto"

export async function sendWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  secret?: string,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  if (secret) {
    const signature = createHmac("sha256", secret).update(body).digest("hex")
    headers["X-Signature"] = signature
  }

  try {
    const res = await fetch(webhookUrl, { method: "POST", headers, body })
    if (res.ok) return { success: true, statusCode: res.status }
    return { success: false, statusCode: res.status, error: `HTTP ${res.status}: ${await res.text().catch(() => "")}` }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" }
  }
}
