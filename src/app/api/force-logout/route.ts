import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.pkce.code_verifier",
  "__Secure-next-auth.pkce.code_verifier",
  "next-auth.state",
  "__Secure-next-auth.state",
]

function clearAll(response: NextResponse) {
  for (const name of COOKIE_NAMES) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    })
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    })
  }
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")
  return response
}

export async function GET(_req: NextRequest) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Logging out...</title>
<meta http-equiv="refresh" content="2;url=/login">
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F4F5F7;color:#1a1a1a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}div{text-align:center}h1{font-size:18px;font-weight:600;margin:0 0 8px}p{font-size:14px;color:#606E74;margin:0}</style>
</head><body>
<div>
<h1>Logging out</h1>
<p>Clearing session and redirecting to login...</p>
</div>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations){
    for (let r of registrations) { r.unregister() }
  })
}
if ('caches' in window) {
  caches.keys().then(function(names){
    for (let n of names) { caches.delete(n) }
  })
}
try { localStorage.clear() } catch(e) {}
try { sessionStorage.clear() } catch(e) {}
setTimeout(function(){ window.location.href = "/login" }, 1500)
</script>
</body></html>`

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
  return clearAll(response)
}

export async function POST(req: NextRequest) {
  return GET(req)
}
