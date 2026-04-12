"use client"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"
import { useRouter } from "next/navigation"

type Complaint = {
  id: string; category: string; locationId: string | null; message: string
  isReviewed: boolean; reviewedAt: string | null; reviewNote: string | null; createdAt: string
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px", padding: "clamp(16px,4vw,28px)",
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
  backgroundColor: "#CDC9C0", color: "#0f1d24", fontSize: "12px", fontWeight: 700,
}

const btnSecondary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.2)",
  cursor: "pointer", backgroundColor: "transparent", color: "#CDC9C0", fontSize: "12px", fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", boxSizing: "border-box",
  backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px", color: "#FFFFFF", fontSize: "13px", outline: "none",
}

export default function ComplaintsPage() {
  const { isOwner } = useUserRole()
  const router = useRouter()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "new" | "reviewed">("all")
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [reviewNote, setReviewNote] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/complaints")
    if (res.ok) { const d = await res.json(); setComplaints(d.complaints) }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isOwner) { router.push("/dashboard"); return }
    load()
  }, [isOwner, router, load])

  const markReviewed = async (id: string) => {
    const res = await fetch("/api/complaints", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reviewNote }),
    })
    if (res.ok) {
      setSelected(null); setReviewNote("")
      load()
    }
  }

  const filtered = complaints.filter(c => {
    if (filter === "new") return !c.isReviewed
    if (filter === "reviewed") return c.isReviewed
    return true
  })

  if (loading) return (
    <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 80, background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "pulse 2s infinite" }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ padding: "clamp(16px,4vw,28px)", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ color: "#FFFFFF", fontSize: "22px", fontWeight: 700, margin: "0 0 20px" }}>Anonymous Complaints</h1>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {(["all", "new", "reviewed"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: "6px 14px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: filter === s ? "rgba(255,255,255,0.06)" : "transparent",
            color: filter === s ? "#CDC9C0" : "rgba(205,201,192,0.5)", cursor: "pointer",
            fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            {s} ({s === "all" ? complaints.length : s === "new" ? complaints.filter(c => !c.isReviewed).length : complaints.filter(c => c.isReviewed).length})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(c => (
          <div key={c.id} style={{ ...cardStyle, cursor: "pointer" }} onClick={() => { setSelected(c); setReviewNote(c.reviewNote || "") }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    backgroundColor: "rgba(205,201,192,0.1)", color: "#CDC9C0",
                  }}>{c.category}</span>
                  <span style={{
                    padding: "3px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                    textTransform: "uppercase",
                    backgroundColor: c.isReviewed ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                    color: c.isReviewed ? "#10B981" : "#F59E0B",
                  }}>{c.isReviewed ? "Reviewed" : "New"}</span>
                </div>
                <p style={{ color: "#e9e5dc", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
                  {c.message.length > 150 ? c.message.slice(0, 150) + "..." : c.message}
                </p>
              </div>
              <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "11px", whiteSpace: "nowrap" }}>
                {new Date(c.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", color: "rgba(205,201,192,0.4)" }}>No complaints found</div>
        )}
      </div>

      {/* Detail / Review modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}
          onClick={() => setSelected(null)}>
          <div style={{ ...cardStyle, maxWidth: "560px", width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{
                padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                textTransform: "uppercase", backgroundColor: "rgba(205,201,192,0.1)", color: "#CDC9C0",
              }}>{selected.category}</span>
              <span style={{ color: "rgba(205,201,192,0.4)", fontSize: "11px" }}>
                {new Date(selected.createdAt).toLocaleString()}
              </span>
            </div>

            <p style={{ color: "#e9e5dc", fontSize: "14px", lineHeight: 1.6, margin: "0 0 20px" }}>
              {selected.message}
            </p>

            {selected.isReviewed ? (
              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#10B981", textTransform: "uppercase", marginBottom: "4px" }}>Reviewed</div>
                {selected.reviewNote && <p style={{ color: "#e9e5dc", fontSize: "13px", margin: 0 }}>{selected.reviewNote}</p>}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(205,201,192,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>Review Note</label>
                <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical", marginBottom: "12px" }}
                  value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Add a note about this complaint..." />
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button style={btnSecondary} onClick={() => setSelected(null)}>Close</button>
                  <button style={btnPrimary} onClick={() => markReviewed(selected.id)}>Mark as Reviewed</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
