"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useUserRole } from "@/hooks/useUserRole"

/* ── Types ── */
type SPost = {
  id: string; locationId: string; platform: string; content: string; imageUrls: string[] | null
  status: string; scheduledAt: string | null; publishedAt: string | null; fbPostId: string | null
  igPostId: string | null; errorMessage: string | null; likes: number | null; comments: number | null
  shares: number | null; createdAt: string
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Analytics = { igProfile: any; fbPosts: any; locationId: string } | null
type Tab = "calendar" | "scheduled" | "drafts" | "published" | "analytics"
type Toast = { message: string; type: "success" | "error" } | null

/* ── Design tokens ── */
const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.07)"
const BORDER2 = "rgba(255,255,255,0.12)"
const S1 = "rgba(255,255,255,0.03)"
const S2 = "rgba(255,255,255,0.05)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#10B981"
const AMBER = "#ffb347"
const FB_BLUE = "#1877F2"
const IG_PINK = "#bc1888"
const mono: React.CSSProperties = { fontFamily: "'Fira Code', 'Courier New', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }

const cardS: React.CSSProperties = { backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "20px" }
const inputS: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER2}`, color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" as const, ...jakarta }
const labelS: React.CSSProperties = { ...mono, display: "block", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: MUTED, marginBottom: "8px" }
const pillS = (active: boolean, color?: string): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: active ? `1px solid ${color || ACC}` : `1px solid ${BORDER2}`, backgroundColor: active ? (color ? `${color}15` : ACC_DIM) : "transparent", color: active ? (color || ACC_BRIGHT) : MUTED, ...jakarta, transition: "all 0.15s",
})

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Calendar" }, { id: "scheduled", label: "Scheduled" },
  { id: "drafts", label: "Drafts" }, { id: "published", label: "Published" },
  { id: "analytics", label: "Analytics" },
]

function timeAgo(d: string) { const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.round(m / 60)}h ago`; return `${Math.round(m / 1440)}d ago` }
function fmtDt(d: string) { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }

export default function SocialPage() {
  const { isOwner, isManager, isStylist } = useUserRole()

  /* ── State ── */
  const [activeTab, setActiveTab] = useState<Tab>("calendar")
  const [activeLocation, setActiveLocation] = useState("BOTH")
  const [activePlatform, setActivePlatform] = useState("all")
  const [posts, setPosts] = useState<SPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [showComposer, setShowComposer] = useState(false)
  const [editingPost, setEditingPost] = useState<SPost | null>(null)
  const [composerDate, setComposerDate] = useState("")
  const [analytics, setAnalytics] = useState<Analytics>(null)
  const [analyticsLoc, setAnalyticsLoc] = useState("CC")
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  // Composer state
  const [cLoc, setCLoc] = useState("BOTH")
  const [cPlat, setCPlat] = useState("both")
  const [cContent, setCContent] = useState("")
  const [cImages, setCImages] = useState<string[]>([])
  const [schedMode, setSchedMode] = useState<"now" | "later" | "draft">("draft")
  const [cDate, setCDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function showToastMsg(message: string, type: "success" | "error" = "success") {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000)
  }

  /* ── Data loading ── */
  const loadPosts = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (activeLocation !== "BOTH") p.set("locationId", activeLocation)
    if (activePlatform !== "all") p.set("platform", activePlatform)
    if (activeTab === "scheduled") p.set("status", "scheduled")
    else if (activeTab === "drafts") p.set("status", "draft")
    else if (activeTab === "published") p.set("status", "published")
    else if (activeTab === "calendar") { p.set("month", String(currentMonth)); p.set("year", String(currentYear)) }
    try { const r = await fetch(`/api/social/posts?${p}`); const d = await r.json(); setPosts(d.posts || []) } catch { /* */ }
    setLoading(false)
  }, [activeTab, activeLocation, activePlatform, currentMonth, currentYear])

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true)
    try { const r = await fetch(`/api/social/analytics?locationId=${analyticsLoc}`); setAnalytics(await r.json()) } catch { /* */ }
    setLoadingAnalytics(false)
  }, [analyticsLoc])

  useEffect(() => { loadPosts() }, [loadPosts])
  useEffect(() => { if (activeTab === "analytics") loadAnalytics() }, [activeTab, loadAnalytics])

  /* ── Composer actions ── */
  function openComposer(post?: SPost, date?: string) {
    if (post) {
      setEditingPost(post); setCLoc(post.locationId); setCPlat(post.platform); setCContent(post.content)
      setCImages(Array.isArray(post.imageUrls) ? post.imageUrls : [])
      setSchedMode(post.status === "scheduled" ? "later" : post.status === "draft" ? "draft" : "now")
      setCDate(post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : "")
    } else {
      setEditingPost(null); setCLoc("BOTH"); setCPlat("both"); setCContent(""); setCImages([])
      setSchedMode("draft"); setCDate(date || "")
      if (date) setSchedMode("later")
    }
    setShowComposer(true)
  }

  async function handleSubmit() {
    if (!cContent.trim()) return
    setSaving(true)
    const status = schedMode === "now" ? "published" : schedMode === "later" ? "scheduled" : "draft"
    const body = { locationId: cLoc, platform: cPlat, content: cContent, imageUrls: cImages, status, scheduledAt: schedMode === "later" && cDate ? cDate : null }
    try {
      const url = editingPost ? `/api/social/posts/${editingPost.id}` : "/api/social/posts"
      const method = editingPost ? "PATCH" : "POST"
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (r.ok) { setShowComposer(false); setEditingPost(null); setComposerDate(""); loadPosts(); showToastMsg(status === "published" ? "Posted successfully" : status === "scheduled" ? "Post scheduled" : "Draft saved") }
      else { const d = await r.json(); showToastMsg(d.error || "Failed to save", "error") }
    } catch { showToastMsg("Network error", "error") }
    setSaving(false)
  }

  async function deletePost(id: string) {
    await fetch(`/api/social/posts/${id}`, { method: "DELETE" })
    loadPosts(); showToastMsg("Post deleted")
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => { if (reader.result) setCImages(prev => [...prev, reader.result as string]) }
      reader.readAsDataURL(file)
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  /* ── Calendar helpers ── */
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const calCells = Array.from({ length: 42 }, (_, i) => { const d = i - firstDay + 1; return d >= 1 && d <= daysInMonth ? d : null })
  const today = new Date()
  const isToday = (d: number) => d === today.getDate() && currentMonth - 1 === today.getMonth() && currentYear === today.getFullYear()
  const postsOnDay = (d: number) => posts.filter(p => { const pd = new Date(p.scheduledAt || p.publishedAt || p.createdAt); return pd.getDate() === d && pd.getMonth() === currentMonth - 1 && pd.getFullYear() === currentYear })

  /* ── Analytics helpers ── */
  const fbPosts = analytics?.fbPosts?.data || []
  const igProfile = analytics?.igProfile || null

  const Skel = ({ h = "34px" }: { h?: string }) => <div style={{ height: h, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "6px", animation: "pulse 1.5s ease-in-out infinite" }} />

  if (isStylist) return <div style={{ padding: "40px", textAlign: "center", color: MUTED }}><div style={{ fontSize: "16px", fontWeight: 700 }}>Owner / Manager Access Only</div></div>

  return (
    <div style={{ ...jakarta, backgroundColor: "#06080d", minHeight: "100%", color: "#fff", padding: "24px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`@media(max-width:767px){.sg4{grid-template-columns:1fr 1fr !important}.sg2c{grid-template-columns:1fr !important}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 500, color: "#fff", margin: 0 }}>Social Media</h1>
          <button onClick={() => openComposer()} style={{ padding: "8px 18px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", ...jakarta }}>Create Post</button>
        </div>

        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
          {["BOTH", "CC", "SA"].map(l => <button key={l} onClick={() => setActiveLocation(l)} style={{ ...mono, padding: "5px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: activeLocation === l ? `1px solid ${ACC_BRIGHT}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: activeLocation === l ? ACC_DIM : "transparent", color: activeLocation === l ? ACC_BRIGHT : MUTED, cursor: "pointer" }}>{l === "BOTH" ? "Both" : l}</button>)}
          <div style={{ width: "1px", height: "20px", background: BORDER2, margin: "0 4px" }} />
          {["all", "facebook", "instagram"].map(p => <button key={p} onClick={() => setActivePlatform(p)} style={{ ...mono, padding: "5px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: activePlatform === p ? `1px solid ${ACC_BRIGHT}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: activePlatform === p ? ACC_DIM : "transparent", color: activePlatform === p ? ACC_BRIGHT : MUTED, cursor: "pointer" }}>{p === "all" ? "All" : p === "facebook" ? "FB" : "IG"}</button>)}
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "20px", overflowX: "auto", borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: activeTab === t.id ? ACC_BRIGHT : MUTED, backgroundColor: activeTab === t.id ? ACC_DIM : "transparent", border: "none", borderBottom: activeTab === t.id ? `2px solid ${ACC}` : "2px solid transparent", borderRadius: activeTab === t.id ? "6px 6px 0 0" : "0", cursor: "pointer", whiteSpace: "nowrap", ...mono }}>{t.label}</button>)}
        </div>

        {/* ═══ CALENDAR TAB ═══ */}
        {activeTab === "calendar" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <button onClick={() => { if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1) } else setCurrentMonth(m => m - 1) }} style={{ background: "none", border: `1px solid ${BORDER2}`, borderRadius: "6px", padding: "5px 8px", color: ACC_BRIGHT, cursor: "pointer" }}><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_left</span></button>
              <span style={{ fontSize: "16px", fontWeight: 700 }}>{new Date(currentYear, currentMonth - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => { setCurrentMonth(today.getMonth() + 1); setCurrentYear(today.getFullYear()) }} style={{ ...mono, padding: "5px 10px", fontSize: "9px", border: `1px solid ${BORDER2}`, borderRadius: "5px", background: "none", color: ACC_BRIGHT, cursor: "pointer", textTransform: "uppercase" }}>Today</button>
                <button onClick={() => { if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1) } else setCurrentMonth(m => m + 1) }} style={{ background: "none", border: `1px solid ${BORDER2}`, borderRadius: "6px", padding: "5px 8px", color: ACC_BRIGHT, cursor: "pointer" }}><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_right</span></button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", background: BORDER }}>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, padding: "8px", background: "#06080d", textAlign: "center" }}>{d}</div>)}
              {calCells.map((d, i) => (
                <div key={i} onClick={() => d && openComposer(undefined, `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}T10:00`)} style={{ minHeight: "90px", background: d ? (isToday(d) ? ACC_DIM : S1) : "#06080d", padding: "6px", cursor: d ? "pointer" : "default", position: "relative", border: d && isToday(d) ? `1px solid ${ACC_BORDER}` : "none", transition: "background 0.15s" }}>
                  {d && <>
                    <div style={{ ...mono, fontSize: "11px", color: isToday(d) ? ACC_BRIGHT : MUTED, fontWeight: isToday(d) ? 500 : 400 }}>{d}</div>
                    {postsOnDay(d).slice(0, 3).map(p => (
                      <div key={p.id} onClick={e => { e.stopPropagation(); openComposer(p) }} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", background: p.platform === "facebook" ? "rgba(24,119,242,0.15)" : p.platform === "instagram" ? "rgba(188,24,136,0.15)" : ACC_DIM, color: p.platform === "facebook" ? FB_BLUE : p.platform === "instagram" ? IG_PINK : ACC_BRIGHT, border: `1px solid ${p.platform === "facebook" ? "rgba(24,119,242,0.25)" : p.platform === "instagram" ? "rgba(188,24,136,0.25)" : ACC_BORDER}` }}>{p.content.slice(0, 18)}</div>
                    ))}
                    {postsOnDay(d).length > 3 && <div style={{ ...mono, fontSize: "8px", color: MUTED, marginTop: "2px" }}>+{postsOnDay(d).length - 3}</div>}
                  </>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ LIST TABS (Scheduled / Drafts / Published) ═══ */}
        {(activeTab === "scheduled" || activeTab === "drafts" || activeTab === "published") && (
          <div>
            {loading ? [1,2,3].map(i => <div key={i} style={{ ...cardS, marginBottom: "8px" }}><Skel h="60px" /></div>) : posts.length === 0 ? (
              <div style={{ ...cardS, textAlign: "center", padding: "48px", color: MUTED }}>No {activeTab} posts</div>
            ) : posts.map(p => (
              <div key={p.id} style={{ ...cardS, marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: p.platform === "facebook" ? FB_BLUE : p.platform === "instagram" ? `linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, ${IG_PINK})` : `linear-gradient(135deg, ${FB_BLUE}, ${IG_PINK})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "12px", color: "#fff", fontWeight: 700 }}>{p.platform === "facebook" ? "f" : p.platform === "instagram" ? "ig" : "+"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span style={{ ...mono, fontSize: "9px", padding: "2px 7px", borderRadius: "4px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BORDER}`, color: ACC_BRIGHT, textTransform: "uppercase" }}>{p.locationId}</span>
                    <span style={{ ...mono, fontSize: "11px", color: MUTED }}>{p.scheduledAt ? fmtDt(p.scheduledAt) : p.publishedAt ? fmtDt(p.publishedAt) : timeAgo(p.createdAt)}</span>
                    {p.status === "failed" && <span style={{ ...mono, fontSize: "9px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(255,107,107,0.1)", color: "#ff6b6b" }}>FAILED</span>}
                  </div>
                  <div style={{ fontSize: "13px", color: MID, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.content}</div>
                  {activeTab === "published" && (p.likes != null || p.comments != null) && <div style={{ ...mono, fontSize: "10px", color: MUTED, marginTop: "4px" }}>{p.likes || 0} likes · {p.comments || 0} comments · {p.shares || 0} shares</div>}
                </div>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button onClick={() => openComposer(p)} style={{ padding: "5px 10px", border: `1px solid ${BORDER2}`, borderRadius: "6px", background: "none", color: ACC_BRIGHT, fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>{activeTab === "published" ? "Repost" : "Edit"}</button>
                  <button onClick={() => deletePost(p.id)} style={{ padding: "5px 10px", border: "1px solid rgba(255,107,107,0.2)", borderRadius: "6px", background: "none", color: "#ff6b6b", fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {activeTab === "analytics" && (
          <div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
              {["CC", "SA"].map(l => <button key={l} onClick={() => setAnalyticsLoc(l)} style={{ ...mono, padding: "5px 12px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: analyticsLoc === l ? `1px solid ${ACC_BRIGHT}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: analyticsLoc === l ? ACC_DIM : "transparent", color: analyticsLoc === l ? ACC_BRIGHT : MUTED, cursor: "pointer" }}>{l}</button>)}
            </div>

            {/* KPIs */}
            <div className="sg4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "IG Followers", val: loadingAnalytics ? null : igProfile ? String(igProfile.followers_count || 0) : "\u2014", border: IG_PINK },
                { label: "IG Posts", val: loadingAnalytics ? null : igProfile ? String(igProfile.media_count || 0) : "\u2014", border: IG_PINK },
                { label: "FB Posts (Recent)", val: loadingAnalytics ? null : String(fbPosts.length), border: FB_BLUE },
                { label: "DB Posts This Mo.", val: loading ? null : String(posts.filter(p => p.status === "published").length), border: GREEN },
              ].map(k => (
                <div key={k.label} style={{ ...cardS, borderLeft: `3px solid ${k.border}`, borderRadius: "0 14px 14px 0" }}>
                  <div style={labelS}>{k.label}</div>
                  {k.val === null ? <Skel /> : <div style={{ ...mono, fontSize: "28px", fontWeight: 600, color: "#fff" }}>{k.val}</div>}
                </div>
              ))}
            </div>

            {/* IG Profile */}
            {igProfile && (
              <div style={{ ...cardS, borderLeft: `3px solid ${IG_PINK}`, borderRadius: "0 14px 14px 0", marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>@{igProfile.username || "salonenvyusa"}</div>
                <div style={{ ...mono, fontSize: "12px", color: MUTED }}>{igProfile.followers_count?.toLocaleString() || 0} followers · {igProfile.media_count || 0} posts</div>
              </div>
            )}

            {/* Recent FB posts performance */}
            <div style={{ ...cardS, marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Recent Posts</div>
              {fbPosts.length === 0 ? <div style={{ color: MUTED, fontSize: "13px", textAlign: "center", padding: "20px" }}>No post data</div> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Platform","Preview","Date","Likes","Comments","Shares"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: h === "Preview" ? "left" : "right", fontSize: "9px", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: `1px solid ${BORDER}`, ...mono }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {fbPosts.map((p: any, i: number) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}><span style={{ ...mono, fontSize: "9px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(24,119,242,0.15)", color: FB_BLUE }}>FB</span></td>
                          <td style={{ padding: "8px 10px", fontSize: "12px", color: MID, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.message || "").slice(0, 50) || "(no text)"}</td>
                          <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "11px", color: MUTED }}>{p.created_time ? new Date(p.created_time).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</td>
                          <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "12px", color: ACC_BRIGHT }}>{p.likes?.summary?.total_count || 0}</td>
                          <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "12px", color: ACC_BRIGHT }}>{p.comments?.summary?.total_count || 0}</td>
                          <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "12px", color: ACC_BRIGHT }}>{p.shares?.count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ POST COMPOSER OVERLAY ═══ */}
      {showComposer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px", overflowY: "auto" }}>
          <div style={{ background: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "680px", marginTop: "20px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 500, margin: 0 }}>{editingPost ? "Edit Post" : "Create Post"}</h2>
              <button onClick={() => { setShowComposer(false); setEditingPost(null) }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: "20px" }}>&times;</button>
            </div>

            {/* Platform */}
            <div style={{ marginBottom: "16px" }}>
              <div style={labelS}>Platform</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setCPlat("facebook")} style={pillS(cPlat === "facebook", FB_BLUE)}>Facebook</button>
                <button onClick={() => setCPlat("instagram")} style={pillS(cPlat === "instagram", IG_PINK)}>Instagram</button>
                <button onClick={() => setCPlat("both")} style={pillS(cPlat === "both")}>Both</button>
              </div>
            </div>

            {/* Location */}
            <div style={{ marginBottom: "16px" }}>
              <div style={labelS}>Location</div>
              <div style={{ display: "flex", gap: "8px" }}>
                {["CC", "SA", "BOTH"].map(l => <button key={l} onClick={() => setCLoc(l)} style={pillS(cLoc === l)}>{l === "BOTH" ? "Both" : l}</button>)}
              </div>
            </div>

            {/* Caption */}
            <div style={{ marginBottom: "16px" }}>
              <div style={labelS}>Caption</div>
              <textarea value={cContent} onChange={e => setCContent(e.target.value)} placeholder="Write your caption..." style={{ ...inputS, minHeight: "120px", resize: "vertical" as const }} />
              <div style={{ textAlign: "right", ...mono, fontSize: "10px", color: cContent.length > 2000 ? "#ff6b6b" : MUTED, marginTop: "4px" }}>{cContent.length.toLocaleString()} / 2,200</div>
            </div>

            {/* Media */}
            <div style={{ marginBottom: "16px" }}>
              <div style={labelS}>Media</div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple style={{ display: "none" }} onChange={handleFile} />
              <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${BORDER2}`, borderRadius: "10px", padding: "24px", textAlign: "center", cursor: "pointer", background: S1, transition: "all 0.2s" }}>
                <div style={{ fontSize: "13px", color: MUTED }}>Drag images here or click to upload</div>
                <div style={{ ...mono, fontSize: "10px", color: MUTED, marginTop: "4px" }}>JPEG, PNG, WebP — up to 10 images</div>
              </div>
              {cImages.length > 0 && (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                  {cImages.map((img, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={img} alt="" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px", border: `1px solid ${BORDER2}` }} />
                      <button onClick={() => setCImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: "-4px", right: "-4px", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#ff6b6b", border: "none", color: "#fff", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Canva */}
              <div style={{ marginTop: "12px" }}>
                <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, marginBottom: "8px" }}>Design with Canva</div>
                <button onClick={() => window.open("https://www.canva.com/create/social-media-graphics/", "_blank")} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px", background: "#00C4CC", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#fff", border: "none", ...jakarta }}>Create with Canva</button>
                <div style={{ fontSize: "11px", color: MUTED, marginTop: "6px" }}>Design a post in Canva, download it, then upload the image above</div>
              </div>
            </div>

            {/* Schedule */}
            <div style={{ marginBottom: "20px" }}>
              <div style={labelS}>When to post</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {([["now", "Post Now"], ["later", "Schedule"], ["draft", "Save as Draft"]] as const).map(([m, l]) => <button key={m} onClick={() => setSchedMode(m)} style={pillS(schedMode === m)}>{l}</button>)}
              </div>
              {schedMode === "later" && <input type="datetime-local" value={cDate} onChange={e => setCDate(e.target.value)} style={{ ...inputS, marginTop: "10px" }} />}
            </div>

            {/* Preview toggle */}
            <div style={{ marginBottom: "16px" }}>
              <button onClick={() => setShowPreview(!showPreview)} style={{ background: "none", border: "none", color: ACC_BRIGHT, fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", ...jakarta }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", transform: showPreview ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>expand_more</span>
                Preview
              </button>
              {showPreview && (
                <div style={{ marginTop: "10px", background: S2, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: ACC_DIM, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "10px", fontWeight: 700, color: ACC_BRIGHT }}>SE</span></div>
                    <div><div style={{ fontSize: "12px", fontWeight: 700 }}>Salon Envy</div><div style={{ ...mono, fontSize: "9px", color: MUTED }}>Just now</div></div>
                  </div>
                  <div style={{ fontSize: "14px", color: cContent ? "#fff" : MUTED, lineHeight: 1.5, minHeight: "30px", marginBottom: "8px" }}>{cContent || "Your post text will appear here..."}</div>
                  {cImages.length > 0 && <img src={cImages[0]} alt="" style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "6px" }} />}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => { setShowComposer(false); setEditingPost(null) }} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "10px", color: MID, fontSize: "13px", cursor: "pointer", ...jakarta }}>Cancel</button>
              {schedMode !== "now" && <button onClick={() => { setSchedMode("draft"); handleSubmit() }} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "10px", color: MID, fontSize: "13px", cursor: "pointer", ...jakarta }}>Save Draft</button>}
              <button onClick={handleSubmit} disabled={saving || !cContent.trim()} style={{ flex: 2, padding: "12px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "10px", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer", ...jakarta, opacity: (!cContent.trim() || saving) ? 0.5 : 1 }}>
                {saving ? "Saving..." : schedMode === "now" ? "Post Now" : schedMode === "later" ? "Schedule Post" : "Save Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: "100px", right: "20px", background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(255,107,107,0.15)", border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(255,107,107,0.3)"}`, borderRadius: "10px", padding: "12px 20px", color: "#fff", fontSize: "13px", fontWeight: 500, zIndex: 999, backdropFilter: "blur(8px)", ...jakarta }}>{toast.message}</div>
      )}

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
