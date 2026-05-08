import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Emergency Login</title>
<style>body{font-family:-apple-system,sans-serif;background:#F4F5F7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}form{background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);width:320px}h1{font-size:18px;margin:0 0 24px}label{display:block;margin-bottom:6px;font-size:13px;color:#606E74}input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:16px;box-sizing:border-box;font-size:14px}button{width:100%;padding:12px;background:#7a8f96;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:14px}.note{margin-top:16px;font-size:12px;color:#606E74;text-align:center}</style>
</head><body>
<form action="/api/auth/callback/credentials" method="POST">
<h1>Emergency Login</h1>
<input type="hidden" name="csrfToken" id="csrfToken" value="" />
<input type="hidden" name="callbackUrl" value="/dashboard" />
<input type="hidden" name="json" value="true" />
<label for="email">Email</label>
<input type="email" name="email" id="email" required autocomplete="email" />
<label for="password">Password</label>
<input type="password" name="password" id="password" required autocomplete="current-password" />
<button type="submit">Sign In</button>
<div class="note">No JS required. No service worker. Direct NextAuth credential auth.</div>
</form>
<script>
fetch("/api/auth/csrf").then(r => r.json()).then(d => {
  document.getElementById("csrfToken").value = d.csrfToken;
}).catch(() => {});
</script>
</body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
