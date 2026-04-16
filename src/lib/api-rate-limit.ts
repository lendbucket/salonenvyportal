const store = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  keyId: string,
  limit = 1000,
  windowMs = 60 * 60 * 1000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = store.get(keyId)

  if (!record || record.resetAt < now) {
    store.set(keyId, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt }
}
