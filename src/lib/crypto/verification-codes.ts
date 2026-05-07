import { randomInt, timingSafeEqual } from "node:crypto"

/**
 * Generate a 6-digit numeric verification code.
 */
export function generateCode(): string {
  return randomInt(100000, 999999).toString()
}

/**
 * Constant-time comparison for verification codes.
 */
export function isCodeValid(code: string, storedCode: string | null, expiresAt: Date | null): boolean {
  if (!storedCode || !code) return false
  if (expiresAt && new Date() > expiresAt) return false
  if (code.length !== storedCode.length) return false
  try {
    return timingSafeEqual(Buffer.from(code), Buffer.from(storedCode))
  } catch {
    return false
  }
}

const MAX_SENDS_PER_HOUR = 3
const MIN_SEND_INTERVAL_MS = 60 * 1000 // 60 seconds
const MAX_VERIFY_ATTEMPTS = 5
const CODE_EXPIRY_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Check if a new verification code can be sent.
 */
export function canSendCode(attempts: number, lastSentAt: Date | null): { allowed: boolean; reason?: string } {
  if (lastSentAt) {
    const sinceLast = Date.now() - lastSentAt.getTime()
    if (sinceLast < MIN_SEND_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_SEND_INTERVAL_MS - sinceLast) / 1000)
      return { allowed: false, reason: `Wait ${waitSec} seconds before requesting another code` }
    }
  }
  if (attempts >= MAX_SENDS_PER_HOUR) {
    return { allowed: false, reason: "Too many attempts. Try again in 1 hour." }
  }
  return { allowed: true }
}

/**
 * Check if code verification attempts are exhausted.
 */
export function canVerifyCode(attempts: number): boolean {
  return attempts < MAX_VERIFY_ATTEMPTS
}

export { CODE_EXPIRY_MS }
