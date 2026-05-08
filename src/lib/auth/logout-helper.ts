"use client"

/**
 * Universal logout helper. Use this everywhere instead of signOut() from next-auth/react.
 *
 * Behavior:
 * 1. Unregisters all service workers (kills stale SW poisoning)
 * 2. Clears all caches (browser cache storage)
 * 3. Clears localStorage and sessionStorage
 * 4. Hard navigates to /api/force-logout which clears NextAuth cookies server-side
 *    and redirects to /login
 *
 * Why not signOut()? In some session states (expired JWT, mismatched secret,
 * partial cookie corruption) signOut() silently fails. /api/force-logout
 * clears cookies unconditionally regardless of NextAuth state.
 */
export async function logoutEverything(): Promise<void> {
  // Best-effort cleanup — none of these should block the redirect

  // 1. Unregister all service workers
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    } catch {
      // ignore
    }
  }

  // 2. Clear all caches
  if (typeof caches !== "undefined") {
    try {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    } catch {
      // ignore
    }
  }

  // 3. Clear localStorage and sessionStorage
  try {
    if (typeof localStorage !== "undefined") localStorage.clear()
    if (typeof sessionStorage !== "undefined") sessionStorage.clear()
  } catch {
    // ignore
  }

  // 4. Hard redirect to force-logout endpoint
  // Using window.location.href for a true full-page navigation (not a SPA route)
  // so the browser fully tears down the React tree and any in-flight requests
  if (typeof window !== "undefined") {
    window.location.href = "/api/force-logout"
  }
}
