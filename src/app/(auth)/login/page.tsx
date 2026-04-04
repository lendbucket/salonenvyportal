"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = await signIn("credentials", { email, password, redirect: false })
    if (result?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", backgroundColor: "#0f1d24" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />

      {/* LEFT — Brand panel */}
      <div style={{
        flex: "0 0 50%",
        backgroundColor: "#0a151b",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 48px",
        position: "relative",
        overflow: "hidden",
      }} className="hidden md:flex">
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(205,201,192,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <img
          src="/images/logo-white.png"
          alt="Salon Envy"
          style={{
            width: "240px",
            height: "auto",
            objectFit: "contain",
            marginBottom: "32px",
            position: "relative",
            zIndex: 1,
          }}
        />

        <div style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "rgba(205,201,192,0.6)",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          textAlign: "center" as const,
          position: "relative",
          zIndex: 1,
          lineHeight: 1.8,
        }}>
          Empowering Your Salon<br />
          <span style={{ color: "#CDC9C0" }}>Elevating Your Team</span>
        </div>

        <div style={{
          position: "absolute",
          bottom: "32px",
          fontSize: "10px",
          fontWeight: 600,
          color: "rgba(205,201,192,0.25)",
          letterSpacing: "0.2em",
          textTransform: "uppercase" as const,
        }}>
          Management Portal
        </div>
      </div>

      {/* RIGHT — Login form */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 32px",
        backgroundColor: "#142127",
      }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <div className="md:hidden" style={{ textAlign: "center" as const, marginBottom: "32px" }}>
            <img src="/images/logo-white.png" alt="Salon Envy" style={{ height: "60px", width: "auto" }} />
          </div>

          <h2 style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}>
            Welcome back
          </h2>
          <p style={{
            fontSize: "14px",
            color: "#94A3B8",
            margin: "0 0 36px",
            fontWeight: 500,
          }}>
            Sign in to your Salon Envy® portal
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 700,
                color: "#CDC9C0",
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                marginBottom: "8px",
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
                  padding: "12px 16px",
                  backgroundColor: "#1a2a32",
                  border: "1px solid rgba(205,201,192,0.2)",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 500,
                  boxSizing: "border-box" as const,
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 700,
                color: "#CDC9C0",
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                marginBottom: "8px",
              }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  backgroundColor: "#1a2a32",
                  border: "1px solid rgba(205,201,192,0.2)",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 500,
                  boxSizing: "border-box" as const,
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: "12px 16px",
                backgroundColor: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "8px",
                color: "#FCA5A5",
                fontSize: "13px",
                fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: loading ? "rgba(205,201,192,0.5)" : "#CDC9C0",
                color: "#0f1d24",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                borderRadius: "8px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "4px",
                transition: "all 0.15s",
                boxShadow: "0 4px 16px rgba(205,201,192,0.2)",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div style={{ textAlign: "center" as const, marginTop: "8px" }}>
              <a href="#" style={{
                fontSize: "12px",
                color: "rgba(205,201,192,0.6)",
                textDecoration: "none",
                fontWeight: 600,
              }}>
                Forgot your password?
              </a>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              margin: "8px 0",
            }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(205,201,192,0.15)" }} />
              <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>or</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(205,201,192,0.15)" }} />
            </div>

            <p style={{ textAlign: "center" as const, fontSize: "12px", color: "#94A3B8", margin: "4px 0 0" }}>
              New to Salon Envy® Portal?{" "}
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
