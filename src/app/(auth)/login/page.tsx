"use client"
import { Suspense, useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Lock, Check, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react"

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const urlError = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [magicEmail, setMagicEmail] = useState("")
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

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
    <div style={{ position: "fixed", inset: 0, display: "flex", overflow: "hidden" }}>
      {/* LEFT PANEL — brand (hidden on mobile) */}
      {!isMobile && (
        <div style={{
          width: "40%", minWidth: 360, background: "linear-gradient(160deg, #0d1117 0%, #1a2332 100%)",
          display: "flex", flexDirection: "column" as const, justifyContent: "space-between", padding: 48,
        }}>
          <img
            src="/images/logo-white.png" alt="Salon Envy"
            style={{ maxHeight: 40, width: "auto", objectFit: "contain" as const, display: "block",
              filter: "brightness(0) saturate(100%) invert(60%) sepia(15%) saturate(600%) hue-rotate(155deg) brightness(90%)" }}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, justifyContent: "center", gap: 32 }}>
            <h1 style={{ fontFamily: "Inter", fontSize: 32, fontWeight: 700, color: "#FBFBFB", letterSpacing: "-0.31px", lineHeight: 1.2, margin: 0 }}>
              Manage your salon.<br />Grow your business.
            </h1>
            <p style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.5)", letterSpacing: "-0.31px", lineHeight: 1.6, maxWidth: 360, margin: 0 }}>
              The complete management platform for Salon Envy. Appointments, staff, payroll, and AI insights in one place.
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {["Real-time revenue and performance tracking", "AI-powered insights with Reyna", "Staff management and payroll automation"].map(text => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(122,143,150,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={12} color="#7a8f96" />
                  </div>
                  <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: "-0.31px", margin: 0 }}>
            &copy; 2026 Salon Envy USA LLC &middot; Powered by RunMySalon
          </p>
        </div>
      )}

      {/* RIGHT PANEL — form */}
      <div style={{
        flex: 1, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? 24 : 48, minHeight: "100vh", overflowY: "auto" as const,
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Mobile logo */}
          {isMobile && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
              <img src="/images/logo-white.png" alt="Salon Envy" style={{
                maxHeight: 36, filter: "brightness(0) saturate(100%) invert(60%) sepia(15%) saturate(600%) hue-rotate(155deg) brightness(90%)",
              }} />
            </div>
          )}

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: "Inter", fontSize: 28, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.31px", margin: 0 }}>Welcome back</h2>
            <p style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 400, color: "rgba(26,19,19,0.5)", letterSpacing: "-0.31px", marginTop: 6 }}>Sign in to your Salon Envy portal</p>
          </div>

          {/* Error */}
          {displayError && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, marginBottom: 16, fontFamily: "Inter", fontSize: 13, color: "#b91c1c" }}>
              <AlertCircle size={15} color="#b91c1c" />{displayError}
            </div>
          )}

          {/* Form card */}
          <div style={{
            background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.08)", borderRadius: 16, padding: 32,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.05)",
          }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
              {/* Email */}
              <div>
                <label style={{ display: "block", fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: "rgba(26,19,19,0.7)", marginBottom: 6 }}>Email address</label>
                <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@salonenvyusa.com"
                  style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 8, background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.12)", color: "#1A1313", fontFamily: "Inter", fontSize: 14, outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s ease" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(122,143,150,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122,143,150,0.1)" }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(26,19,19,0.12)"; e.currentTarget.style.boxShadow = "none" }}
                />
              </div>
              {/* Password */}
              <div>
                <label style={{ display: "block", fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: "rgba(26,19,19,0.7)", marginBottom: 6 }}>Password</label>
                <div style={{ position: "relative" as const }}>
                  <input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                    style={{ width: "100%", height: 44, padding: "0 44px 0 14px", borderRadius: 8, background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.12)", color: "#1A1313", fontFamily: "Inter", fontSize: 14, outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s ease" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(122,143,150,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122,143,150,0.1)" }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(26,19,19,0.12)"; e.currentTarget.style.boxShadow = "none" }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute" as const, right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(26,19,19,0.35)", padding: 4, display: "flex" }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {/* Submit */}
              <button type="submit" disabled={loading} style={{
                width: "100%", height: 48, borderRadius: 10, background: "#7a8f96", border: "1px solid #7a8f96",
                color: "#FBFBFB", fontFamily: "Inter", fontSize: 15, fontWeight: 600, letterSpacing: "-0.31px",
                cursor: loading ? "wait" : "pointer", transition: "all 0.15s ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 1px 3px rgba(122,143,150,0.3), 0 2px 6px rgba(122,143,150,0.2)",
                opacity: loading ? 0.7 : 1,
              }}>
                {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing in...</> : "Sign in"}
              </button>
            </form>
          </div>

          {/* Security note */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, fontFamily: "Inter", fontSize: 12, color: "rgba(26,19,19,0.35)" }}>
            <Lock size={13} color="rgba(26,19,19,0.3)" />Secured with 256-bit SSL encryption
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } input::placeholder { color: rgba(26,19,19,0.3); }`}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", backgroundColor: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#CDC9C0", fontSize: "14px" }}>Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
