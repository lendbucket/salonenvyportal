"use client"
import { useEffect, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"

interface Prefs {
  emailNotifications: boolean
  scheduleAlerts: boolean
  lowStockAlerts: boolean
  cancellationAlerts: boolean
  weeklyReport: boolean
  defaultPeriod: string
  defaultLocation: string
}

const DEFAULT_PREFS: Prefs = {
  emailNotifications: true,
  scheduleAlerts: true,
  lowStockAlerts: true,
  cancellationAlerts: false,
  weeklyReport: true,
  defaultPeriod: "today",
  defaultLocation: "Both",
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        border: "none",
        backgroundColor: checked ? "#7a8f96" : "rgba(255,255,255,0.1)",
        position: "relative",
        cursor: "pointer",
        transition: "background-color 0.2s",
        flexShrink: 0,
      }}
    >
      <div style={{
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        backgroundColor: checked ? "#0f1d24" : "rgba(205,201,192,0.4)",
        position: "absolute",
        top: "3px",
        left: checked ? "23px" : "3px",
        transition: "left 0.2s, background-color 0.2s",
      }} />
    </button>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#0d1117",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "10px",
  padding: "28px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)",
}

export default function PreferencesPage() {
  const { isOwner } = useUserRole()
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/preferences").then(r => r.json()).then(d => {
      if (d.preferences) setPrefs(d.preferences)
    }).catch(() => {
      try {
        const stored = localStorage.getItem("portal-preferences")
        if (stored) setPrefs(JSON.parse(stored))
      } catch { /* ignore */ }
    })
  }, [])

  function update(key: keyof Prefs, value: boolean | string) {
    setPrefs((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    localStorage.setItem("portal-preferences", JSON.stringify(prefs))
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
    } catch { /* localStorage fallback already saved */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleRows: { key: keyof Prefs; label: string; desc: string }[] = [
    { key: "emailNotifications", label: "Email Notifications", desc: "Receive portal notifications via email" },
    { key: "scheduleAlerts", label: "Schedule Alerts", desc: "Get notified about schedule changes and approvals" },
    { key: "lowStockAlerts", label: "Low Stock Alerts", desc: "Alerts when inventory falls below reorder threshold" },
    { key: "cancellationAlerts", label: "Cancellation Alerts", desc: "Notifications for appointment cancellations and no-shows" },
    { key: "weeklyReport", label: "Weekly Report", desc: "Receive a weekly performance summary every Monday" },
  ]

  const periodOptions = [
    { key: "today", label: "Today" },
    { key: "7days", label: "7 Days" },
    { key: "30days", label: "30 Days" },
    { key: "month", label: "Month" },
  ]

  const locationOptions = isOwner
    ? [{ key: "Both", label: "Both" }, { key: "Corpus Christi", label: "CC" }, { key: "San Antonio", label: "SA" }]
    : []

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "28px" }}>
      <h1 style={{
        fontSize: "32px",
        fontWeight: 800,
        color: "#FFFFFF",
        marginBottom: "28px",
        letterSpacing: "-0.02em",
      }}>
        Preferences
      </h1>

      {/* Notification Toggles */}
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
          Notifications
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {toggleRows.map((row) => (
            <div key={row.key} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", marginBottom: "3px" }}>
                  {row.label}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.45)" }}>
                  {row.desc}
                </div>
              </div>
              <Toggle
                checked={prefs[row.key] as boolean}
                onChange={(v) => update(row.key, v)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard Defaults */}
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
          Dashboard Defaults
        </h2>

        <div style={{ marginBottom: "20px" }}>
          <label style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#CDC9C0",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            display: "block",
            marginBottom: "10px",
          }}>
            Default Period
          </label>
          <div style={{
            display: "inline-flex",
            gap: "2px",
            backgroundColor: "rgba(205,201,192,0.04)",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid rgba(205,201,192,0.08)",
          }}>
            {periodOptions.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => update("defaultPeriod", key)}
                style={{
                  padding: "8px 16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: prefs.defaultPeriod === key ? "#CDC9C0" : "transparent",
                  color: prefs.defaultPeriod === key ? "#0f1d24" : "rgba(205,201,192,0.45)",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isOwner && locationOptions.length > 0 && (
          <div>
            <label style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#CDC9C0",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "10px",
            }}>
              Default Location
            </label>
            <div style={{
              display: "inline-flex",
              gap: "2px",
              backgroundColor: "rgba(205,201,192,0.04)",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid rgba(205,201,192,0.08)",
            }}>
              {locationOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => update("defaultLocation", key)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: prefs.defaultLocation === key ? "#CDC9C0" : "transparent",
                    color: prefs.defaultLocation === key ? "#0f1d24" : "rgba(205,201,192,0.45)",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button
          onClick={handleSave}
          style={{
            padding: "12px 28px",
            backgroundColor: "#CDC9C0",
            color: "#0f1d24",
            border: "none",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Save Preferences
        </button>
        {saved && (
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#10B981" }}>
            Preferences saved successfully.
          </span>
        )}
      </div>
    </div>
  )
}
