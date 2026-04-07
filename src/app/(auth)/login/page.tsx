"use client"
import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const urlError = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [magicEmail, setMagicEmail] = useState("")
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const errorMessages: Record<string, string> = {
    PendingApproval: "Your account is pending approval. Please contact your manager.",
    NotFound: "No account found with that email. Request access first.",
    OAuthAccountNotLinked: "This email is already linked to another sign-in method.",
  }

  const displayError = error || (urlError ? errorMessages[urlError] || "An error occurred during sign-in." : "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = await signIn("credentials", { email, password, redirect: false })
    if (result?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0f1d24",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <img
            src="/images/logo-white.png"
            alt="Salon Envy"
            style={{ height: "72px", width: "auto", objectFit: "contain", display: "inline-block" }}
          />
          <div style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "rgba(205,201,192,0.5)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginTop: "10px",
          }}>
            Management Portal
          </div>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: "#1a2a32",
          borderRadius: "16px",
          padding: "32px",
          border: "1px solid rgba(205,201,192,0.12)",
        }}>
          <h2 style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 6px",
            letterSpacing: "-0.02em",
          }}>
            Welcome back
          </h2>
          <p style={{
            fontSize: "13px",
            color: "#94A3B8",
            margin: "0 0 28px",
            fontWeight: 500,
          }}>
            Sign in to your Salon Envy portal
          </p>

          {displayError && (
            <div style={{
              padding: "10px 14px",
              backgroundColor: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "10px",
              color: "#FCA5A5",
              fontSize: "12px",
              fontWeight: 500,
              marginBottom: "16px",
            }}>
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 700,
                color: "#CDC9C0",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "7px",
              }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  backgroundColor: "#0f1d24",
                  border: "1px solid rgba(205,201,192,0.15)",
                  borderRadius: "10px",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: 500,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 700,
                color: "#CDC9C0",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "7px",
              }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder=""
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  backgroundColor: "#0f1d24",
                  border: "1px solid rgba(205,201,192,0.15)",
                  borderRadius: "10px",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: 500,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                backgroundColor: loading ? "rgba(205,201,192,0.5)" : "#CDC9C0",
                color: "#0f1d24",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                borderRadius: "10px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "4px",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "4px 0" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(205,201,192,0.1)" }} />
              <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>or</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(205,201,192,0.1)" }} />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "transparent",
                border: "1px solid rgba(205,201,192,0.25)",
                borderRadius: "10px",
                color: "#CBD5E1",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {/* Magic Link */}
            <div style={{ marginTop: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "8px 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(205,201,192,0.1)" }} />
                <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>or get a magic link</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(205,201,192,0.1)" }} />
              </div>

              {!magicLinkSent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="email"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    placeholder="Enter your email address"
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      backgroundColor: "#0f1d24",
                      border: "1px solid rgba(205,201,192,0.15)",
                      borderRadius: "10px",
                      color: "#FFFFFF",
                      fontSize: "16px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setMagicLoading(true)
                      await signIn("email", { email: magicEmail, redirect: false })
                      setMagicLinkSent(true)
                      setMagicLoading(false)
                    }}
                    disabled={magicLoading || !magicEmail}
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor: "transparent",
                      border: "1px solid rgba(205,201,192,0.25)",
                      borderRadius: "10px",
                      color: "#CDC9C0",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      opacity: (!magicEmail || magicLoading) ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {magicLoading ? "Sending..." : "Send Magic Link"}
                  </button>
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  padding: "16px",
                  backgroundColor: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: "10px",
                }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#10B981", marginBottom: "4px" }}>Check your email!</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8" }}>We sent a sign-in link to {magicEmail}</div>
                  <button
                    type="button"
                    onClick={() => { setMagicLinkSent(false); setMagicEmail("") }}
                    style={{ marginTop: "12px", fontSize: "11px", color: "rgba(205,201,192,0.5)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>

            <p style={{ textAlign: "center", fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>
              New to Salon Envy Portal?{" "}
              <a href="/onboarding" style={{ color: "#CDC9C0", fontWeight: 700, textDecoration: "none" }}>
                Request Access
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", backgroundColor: "#0f1d24", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#CDC9C0", fontSize: "14px" }}>Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
