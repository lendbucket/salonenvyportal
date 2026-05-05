"use client"
import { useState, useEffect } from "react"
import { User, Award, Landmark, RefreshCw, Loader2 } from "lucide-react"

interface ProfileData {
  fullName: string
  email: string | null
  phone: string | null
  location: { name: string }
  license: {
    number: string | null
    status: string | null
    expirationDate: string | null
    verifiedAt: string | null
    holderName: string | null
  }
  bank: {
    last4: string | null
    hasOnFile: boolean
  }
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#FBFBFB",
  border: "1px solid rgba(26,19,19,0.07)",
  borderRadius: 12,
  padding: "24px",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)",
}

function LicenseStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span style={{ ...badgeBase, backgroundColor: "rgba(26,19,19,0.06)", color: "rgba(26,19,19,0.4)" }}>Unknown</span>
  }
  const upper = status.toUpperCase()
  if (upper === "ACTIVE") return <span style={{ ...badgeBase, backgroundColor: "rgba(34,197,94,0.1)", color: "#15803d", border: "1px solid rgba(34,197,94,0.3)" }}>Active</span>
  if (upper === "EXPIRED") return <span style={{ ...badgeBase, backgroundColor: "rgba(239,68,68,0.1)", color: "#b91c1c", border: "1px solid rgba(239,68,68,0.3)" }}>Expired</span>
  if (upper === "PENDING") return <span style={{ ...badgeBase, backgroundColor: "rgba(234,179,8,0.1)", color: "#a16207", border: "1px solid rgba(234,179,8,0.3)" }}>Pending</span>
  return <span style={{ ...badgeBase, backgroundColor: "rgba(26,19,19,0.06)", color: "rgba(26,19,19,0.4)" }}>{status}</span>
}

const badgeBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20,
  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? "s" : ""} ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function SkeletonCard() {
  return (
    <div style={{ ...cardStyle, height: 140 }}>
      <div style={{ width: "35%", height: 14, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 6, marginBottom: 16 }} />
      <div style={{ width: "60%", height: 12, backgroundColor: "rgba(26,19,19,0.04)", borderRadius: 6, marginBottom: 10 }} />
      <div style={{ width: "45%", height: 12, backgroundColor: "rgba(26,19,19,0.04)", borderRadius: 6 }} />
    </div>
  )
}

export default function MyProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    fetch("/api/my-profile")
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleVerifyLicense = async () => {
    setVerifying(true)
    try {
      const res = await fetch("/api/my-profile/verify-license", { method: "POST" })
      const result = await res.json()
      if (result.license && data) {
        setData({ ...data, license: result.license })
      }
    } catch {
      // Silent fail — TDLR may be down
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ width: 140, height: 20, backgroundColor: "rgba(26,19,19,0.06)", borderRadius: 6, marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px" }}>My Profile</h1>
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
          <User size={32} strokeWidth={1.5} color="rgba(26,19,19,0.2)" style={{ margin: "0 auto 16px" }} />
          <p style={{ fontSize: 14, color: "rgba(26,19,19,0.5)", margin: 0 }}>Unable to load profile data.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px" }}>My Profile</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Card 1: Contact Info */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <User size={16} strokeWidth={1.5} color="#7a8f96" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Contact Information</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Full Name</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{data.fullName}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{data.email || "-"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Phone</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{data.phone || "-"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Location</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{data.location.name}</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "rgba(26,19,19,0.35)", margin: "16px 0 0" }}>
            Need to update? Contact your manager.
          </p>
        </div>

        {/* Card 2: TDLR License */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Award size={16} strokeWidth={1.5} color="#7a8f96" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>TDLR License</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>License Number</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: data.license.number ? "#1A1313" : "rgba(26,19,19,0.35)" }}>
                {data.license.number || "Not on file"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Status</div>
              <LicenseStatusBadge status={data.license.status} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Expiration Date</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>
                {data.license.expirationDate
                  ? new Date(data.license.expirationDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Holder Name</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{data.license.holderName || "-"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Last Verified</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{relativeTime(data.license.verifiedAt)}</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              onClick={handleVerifyLicense}
              disabled={!data.license.number || verifying}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
                backgroundColor: data.license.number ? "rgba(122,143,150,0.08)" : "rgba(26,19,19,0.04)",
                border: `1px solid ${data.license.number ? "rgba(122,143,150,0.2)" : "rgba(26,19,19,0.08)"}`,
                borderRadius: 8, color: data.license.number ? "#7a8f96" : "rgba(26,19,19,0.3)",
                fontSize: 12, fontWeight: 600, cursor: data.license.number ? "pointer" : "not-allowed",
                opacity: verifying ? 0.6 : 1,
              }}
            >
              {verifying ? <Loader2 size={14} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} strokeWidth={1.5} />}
              {verifying ? "Verifying..." : "Re-verify with TDLR"}
            </button>
          </div>
        </div>

        {/* Card 3: Direct Deposit */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Landmark size={16} strokeWidth={1.5} color="#7a8f96" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Direct Deposit</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Bank Account</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: data.bank.hasOnFile ? "#1A1313" : "rgba(26,19,19,0.35)" }}>
                {data.bank.hasOnFile ? `\u2022\u2022\u2022\u2022${data.bank.last4}` : "Not on file"}
              </span>
              {data.bank.hasOnFile && (
                <span style={{
                  display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 12,
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  backgroundColor: "rgba(34,197,94,0.1)", color: "#15803d", border: "1px solid rgba(34,197,94,0.3)",
                }}>
                  On file
                </span>
              )}
            </div>
          </div>
          <p style={{ fontSize: 11, color: "rgba(26,19,19,0.35)", margin: 0 }}>
            To update your direct deposit information, contact your manager. Bank account changes require verification.
          </p>
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
