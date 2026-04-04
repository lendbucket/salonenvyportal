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
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    if (result?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "400px", padding: "2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#C9A84C", letterSpacing: "0.05em" }}>
            Salon Envy®
          </h1>
          <p style={{ color: "#888", marginTop: "0.5rem" }}>Management Portal</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", color: "#888", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: "0.75rem", backgroundColor: "#161616", border: "1px solid #2a2a2a", borderRadius: "0.5rem", color: "#f5f5f5", fontSize: "1rem", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", color: "#888", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: "0.75rem", backgroundColor: "#161616", border: "1px solid #2a2a2a", borderRadius: "0.5rem", color: "#f5f5f5", fontSize: "1rem", boxSizing: "border-box" }}
            />
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "0.875rem" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "0.75rem", backgroundColor: "#C9A84C", color: "#0d0d0d", fontWeight: "bold", borderRadius: "0.5rem", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "1rem", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}
