"use client"
import { useEffect, useState, useCallback } from "react"

interface SyncStatus {
  type: string
  status: string
  totalProcessed: number
  pagesProcessed: number
  startedAt: string | null
  lastTickAt: string | null
  completedAt: string | null
  errorMessage: string | null
}

interface AllStatus {
  clients: SyncStatus | null
  orders: SyncStatus | null
  appointments: SyncStatus | null
  payments: SyncStatus | null
  metrics: { lastRun: string | null; processed: number } | null
}

const SYNC_TYPES = [
  { key: "clients", label: "Clients", desc: "Square customer profiles", endpoint: "/api/clients/sync" },
  { key: "orders", label: "Orders", desc: "Square orders + line items", endpoint: "/api/orders/sync" },
  { key: "payments", label: "Payments", desc: "Square payments — card, cash, external", endpoint: "/api/payments/sync" },
  { key: "appointments", label: "Appointments", desc: "Square bookings", endpoint: "/api/appointments/sync" },
  { key: "metrics", label: "Client Metrics", desc: "Computed aggregates", endpoint: "/api/cron/compute-metrics" },
] as const

function formatTime(iso: string | null): string {
  if (!iso) return "Never"
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function statusColor(status: string): string {
  if (status === "completed") return "#10b981"
  if (status === "running") return "#3b82f6"
  if (status === "failed") return "#ef4444"
  return "#6b7280"
}

export default function DataSyncPage() {
  const [allStatus, setAllStatus] = useState<AllStatus | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [polling, setPolling] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/all-status")
      if (res.ok) {
        const data = await res.json()
        setAllStatus(data)
        const anyRunning = ["clients", "orders", "payments", "appointments"].some(
          k => data[k]?.status === "running"
        )
        setPolling(anyRunning)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!polling) return
    const id = setInterval(fetchStatus, 3000)
    return () => clearInterval(id)
  }, [polling, fetchStatus])

  async function triggerSync(type: string, endpoint: string) {
    setLoading(l => ({ ...l, [type]: true }))
    try {
      if (type === "metrics") {
        await fetch(endpoint, { headers: { authorization: `Bearer ${window.location.origin}` } })
      } else {
        await fetch(endpoint, { method: "POST" })
      }
      setPolling(true)
      setTimeout(fetchStatus, 500)
    } catch { /* ignore */ }
    setLoading(l => ({ ...l, [type]: false }))
  }

  function getStatusForType(key: string): { status: string; processed: number; lastCompleted: string | null; error: string | null } {
    if (!allStatus) return { status: "none", processed: 0, lastCompleted: null, error: null }
    if (key === "metrics") {
      return { status: "idle", processed: allStatus.metrics?.processed || 0, lastCompleted: allStatus.metrics?.lastRun || null, error: null }
    }
    const s = allStatus[key as keyof AllStatus] as SyncStatus | null
    if (!s) return { status: "none", processed: 0, lastCompleted: null, error: null }
    return { status: s.status, processed: s.totalProcessed, lastCompleted: s.completedAt, error: s.errorMessage }
  }

  return (
    <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1313", letterSpacing: "-0.5px", marginBottom: 4 }}>
        Data Sync
      </h1>
      <p style={{ fontSize: 13, color: "rgba(26,19,19,0.5)", marginBottom: 24 }}>
        Manage Square data synchronization and metric recomputation
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
        {SYNC_TYPES.map(({ key, label, desc, endpoint }) => {
          const { status, processed, lastCompleted, error } = getStatusForType(key)
          const isRunning = status === "running"
          const isBusy = loading[key] || isRunning

          return (
            <div key={key} style={{
              background: "#FBFBFB",
              border: "1px solid rgba(26,19,19,0.08)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", margin: 0 }}>{label}</h3>
                  <p style={{ fontSize: 12, color: "rgba(26,19,19,0.45)", margin: "2px 0 0" }}>{desc}</p>
                </div>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  color: statusColor(status),
                  background: `${statusColor(status)}15`,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(status) }} />
                  {status === "none" ? "idle" : status}
                </span>
              </div>

              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(26,19,19,0.55)" }}>
                <span>Processed: <strong style={{ color: "#1A1313" }}>{processed.toLocaleString()}</strong></span>
                <span>Last completed: <strong style={{ color: "#1A1313" }}>{formatTime(lastCompleted)}</strong></span>
              </div>

              {error && (
                <div style={{ fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.06)", padding: "6px 10px", borderRadius: 6, wordBreak: "break-word" }}>
                  {error}
                </div>
              )}

              {isRunning && (
                <div style={{ height: 4, borderRadius: 2, background: "rgba(59,130,246,0.15)", overflow: "hidden" }}>
                  <div style={{ width: "60%", height: "100%", background: "#3b82f6", borderRadius: 2, animation: "pulse 1.5s infinite" }} />
                </div>
              )}

              <button
                onClick={() => triggerSync(key, endpoint)}
                disabled={isBusy}
                style={{
                  marginTop: "auto",
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(122,143,150,0.3)",
                  background: isBusy ? "rgba(122,143,150,0.08)" : "rgba(122,143,150,0.12)",
                  color: isBusy ? "rgba(122,143,150,0.5)" : "#7a8f96",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isBusy ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {isBusy ? "Syncing..." : "Sync now"}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
