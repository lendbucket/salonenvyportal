import { randomBytes, createHash, timingSafeEqual } from "node:crypto"

/**
 * Generates a cryptographically secure invite token.
 * Returns both the plaintext (for sending to user) and the hash (for storage).
 */
export function generateToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString("base64url") // ~43 chars
  const hash = hashToken(plaintext)
  return { plaintext, hash }
}

/**
 * SHA-256 hash of a plaintext token (for lookup/storage).
 */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex")
}

/**
 * Constant-time comparison of two strings.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Check if an enrollment token is expired.
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return new Date() > expiresAt
}
