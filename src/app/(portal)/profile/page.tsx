"use client"
import { useSession } from "next-auth/react"
import { useState } from "react"

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: "#CDC9C0",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  marginBottom: "6px",
  display: "block",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  backgroundColor: "rgba(205,201,192,0.06)",
  border: "1px solid rgba(205,201,192,0.15)",
  borderRadius: "8px",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 500,
  outline: "none",
}

const disabledInputStyle: React.CSSProperties = {
  ...inputStyle,
  color: "rgba(205,201,192,0.4)",
  cursor: "not-allowed",
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#0d1117",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "10px",
  padding: "28px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)",
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const user = session?.user as any

  const [name, setName] = useState(user?.name || "")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState("")

  const initials = (user?.name || "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const roleBadge = user?.role || "STYLIST"
  const locationName = (user as any)?.locationName || null

  async function handleSaveProfile() {
    setSaving(true)
    setProfileMsg("")
    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })
      if (res.ok) {
        setProfileMsg("Profile updated successfully.")
      } else {
        const data = await res.json()
        setProfileMsg(data.error || "Failed to update profile.")
      }
    } catch {
      setProfileMsg("Network error.")
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    setPwSaving(true)
    setPwMsg("")
    if (newPassword !== confirmPassword) {
      setPwMsg("Passwords do not match.")
      setPwSaving(false)
      return
    }
    if (newPassword.length < 6) {
      setPwMsg("New password must be at least 6 characters.")
      setPwSaving(false)
      return
    }
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        setPwMsg("Password changed successfully.")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        const data = await res.json()
        setPwMsg(data.error || "Failed to change password.")
      }
    } catch {
      setPwMsg("Network error.")
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "28px" }}>
      <h1 style={{
        fontSize: "32px",
        fontWeight: 800,
        color: "#FFFFFF",
        marginBottom: "28px",
        letterSpacing: "-0.02em",
      }}>
        My Profile
      </h1>

      {/* Avatar + Identity */}
      <div style={{ ...cardStyle, marginBottom: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          backgroundColor: "rgba(205,201,192,0.12)",
          border: "2px solid rgba(205,201,192,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "22px",
          fontWeight: 800,
          color: "#CDC9C0",
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>
            {user?.name || "User"}
          </div>
          <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>
            {user?.email || ""}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={{
              fontSize: "9px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: "4px",
              backgroundColor: roleBadge === "OWNER" ? "rgba(234,179,8,0.15)" : roleBadge === "MANAGER" ? "rgba(99,102,241,0.15)" : "rgba(205,201,192,0.08)",
              color: roleBadge === "OWNER" ? "#EAB308" : roleBadge === "MANAGER" ? "#818CF8" : "#CDC9C0",
              border: `1px solid ${roleBadge === "OWNER" ? "rgba(234,179,8,0.3)" : roleBadge === "MANAGER" ? "rgba(99,102,241,0.3)" : "rgba(205,201,192,0.15)"}`,
            }}>
              {roleBadge}
            </span>
            {locationName && (
              <span style={{
                fontSize: "9px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "4px 10px",
                borderRadius: "4px",
                backgroundColor: "rgba(16,185,129,0.12)",
                color: "#10B981",
                border: "1px solid rgba(16,185,129,0.3)",
              }}>
                {locationName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Personal Info Form */}
      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <h2 style={{
          fontSize: "10px",
          fontWeight: 800,
          color: "#CDC9C0",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: "20px",
          marginTop: 0,
        }}>
          Personal Information
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="Your name"
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              style={disabledInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        {profileMsg && (
          <div style={{
            marginTop: "14px",
            fontSize: "12px",
            fontWeight: 600,
            color: profileMsg.includes("success") ? "#10B981" : "#EF4444",
          }}>
            {profileMsg}
          </div>
        )}

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          style={{
            marginTop: "20px",
            padding: "12px 28px",
            backgroundColor: "#CDC9C0",
            color: "#0f1d24",
            border: "none",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Change Password */}
      <div style={cardStyle}>
        <h2 style={{
          fontSize: "10px",
          fontWeight: 800,
          color: "#CDC9C0",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: "20px",
          marginTop: 0,
        }}>
          Change Password
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {pwMsg && (
          <div style={{
            marginTop: "14px",
            fontSize: "12px",
            fontWeight: 600,
            color: pwMsg.includes("success") ? "#10B981" : "#EF4444",
          }}>
            {pwMsg}
          </div>
        )}

        <button
          onClick={handleChangePassword}
          disabled={pwSaving}
          style={{
            marginTop: "20px",
            padding: "12px 28px",
            backgroundColor: "transparent",
            color: "#CDC9C0",
            border: "1px solid rgba(205,201,192,0.25)",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: pwSaving ? "not-allowed" : "pointer",
            opacity: pwSaving ? 0.6 : 1,
          }}
        >
          {pwSaving ? "Updating..." : "Change Password"}
        </button>
      </div>
    </div>
  )
}
