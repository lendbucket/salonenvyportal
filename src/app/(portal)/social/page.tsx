"use client"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useUserRole } from "@/hooks/useUserRole"

type SPost = {
  id: string; locationId: string; platform: string; content: string; imageUrls: string[] | null
  status: string; scheduledAt: string | null; publishedAt: string | null; fbPostId: string | null
  igPostId: string | null; errorMessage: string | null; reach: number | null; likes: number | null
  comments: number | null; shares: number | null; createdAt: string
}
type FbPost = { id: string; message: string; createdTime: string; likes: number; comments: number; shares: number }
type Analytics = {
  facebook: { fanCount: number; followersCount: number; pageName: string; recentPosts: FbPost[] } | null
  instagram: { followersCount: number; mediaCount: number; username: string } | null
}
type Tab = "calendar" | "scheduled" | "drafts" | "published" | "analytics"
type Toast = { msg: string; type: "success" | "error" } | null

const ACC = "#606E74"
const ACC_B = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BDR = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.07)"
const BORDER2 = "rgba(255,255,255,0.12)"
const S1 = "rgba(255,255,255,0.03)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#10B981"
const AMBER = "#ffb347"
const FB = "#1877F2"
const IG_C = "#bc1888"

const mono: React.CSSProperties = { fontFamily: "'Fira Code', 'Courier New', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }
const card: React.CSSProperties = { backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "20px" }
const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: "8px", backgroundColor: ACC_DIM, border: `1px solid ${BORDER}`, color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" as const, ...jakarta }

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Calendar" }, { id: "scheduled", label: "Scheduled" },
  { id: "drafts", label: "Drafts" }, { id: "published", label: "Published" },
  { id: "analytics", label: "Analytics" },
]

function timeAgo(d: string) {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.round(m / 60)}h ago`; return `${Math.round(m / 1440)}d ago`
}

function fmtDt(d: string) { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }

export default function SocialPage() {
  const { isOwner, isManager, isStylist } = useUserRole()
  const [tab, setTab] = useState<Tab>("calendar")
  const [locFilter, setLocFilter] = useState("all")
  const [platFilter, setPlatFilter] = useState("all")
  const [posts, setPosts] = useState<SPost[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loadP, setLoadP] = useState(true)
  const [loadA, setLoadA] = useState(true)
  const [calMonth, setCalMonth] = useState(() => new Date())
  const [toast, setToast] = useState<Toast>(null)

  // Composer
  const [showComp, setShowComp] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [cLoc, setCLoc] = useState("BOTH")
  const [cPlat, setCPlat] = useState("both")
  const [cContent, setCContent] = useState("")
  const [cImages, setCImages] = useState<string[]>([])
  const [cSchedMode, setCSchedMode] = useState<"now" | "schedule" | "draft">("now")
  const [cDate, setCDate] = useState("")
  const [cSaving, setCSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: "success" | "error") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const fetchPosts = useCallback(async () => {
    setLoadP(true)
    const p = new URLSearchParams()
    if (locFilter !== "all") p.set("locationId", locFilter)
    if (platFilter !== "all") p.set("platform", platFilter)
    if (tab === "calendar") { p.set("month", String(calMonth.getMonth() + 1)); p.set("year", String(calMonth.getFullYear())) }
    else if (tab !== "analytics") p.set("status", tab === "scheduled" ? "scheduled" : tab === "drafts" ? "draft" : "published")
    try { const r = await fetch(`/api/social/posts?${p}`); const d = await r.json(); setPosts(d.posts || []) } catch { /* */ }
    setLoadP(false)
  }, [locFilter, platFilter, tab, calMonth])

  const fetchAnalytics = useCallback(async () => {
    setLoadA(true)
    const loc = locFilter === "all" ? "CC" : locFilter
    try { const r = await fetch(`/api/social/analytics?locationId=${loc}`); setAnalytics(await r.json()) } catch { /* */ }
    setLoadA(false)
  }, [locFilter])

  useEffect(() => { fetchPosts() }, [fetchPosts])
  useEffect(() => { if (tab === "analytics") fetchAnalytics() }, [tab, fetchAnalytics])

  const openComposer = (post?: SPost, date?: string) => {
    if (post) {
      setEditId(post.id); setCLoc(post.locationId); setCPlat(post.platform); setCContent(post.content)
      setCImages(Array.isArray(post.imageUrls) ? post.imageUrls : [])
      setCSchedMode(post.status === "scheduled" ? "schedule" : post.status === "draft" ? "draft" : "now")
      setCDate(post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : "")
    } else {
      setEditId(null); setCLoc("BOTH"); setCPlat("both"); setCContent(""); setCImages([])
      setCSchedMode("now"); setCDate(date || "")
    }
    setShowComp(true)
  }

  const savePost = async () => {
    if (!cContent.trim()) return
    setCSaving(true)
    const status = cSchedMode === "now" ? "published" : cSchedMode === "schedule" ? "scheduled" : "draft"
    const body = { locationId: cLoc, platform: cPlat, content: cContent, imageUrls: cImages, status, scheduledAt: cSchedMode === "schedule" && cDate ? cDate : null }
    try {
      const url = editId ? `/api/social/posts/${editId}` : "/api/social/posts"
      const method = editId ? "PATCH" : "POST"
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (r.ok) { showToast(status === "published" ? "Published!" : status === "scheduled" ? "Scheduled!" : "Draft saved!", "success"); setShowComp(false); fetchPosts() }
      else { const d = await r.json(); showToast(d.error || "Failed", "error") }
    } catch { showToast("Network error", "error") }
    setCSaving(false)
  }

  const deletePost = async (id: string) => {
    await fetch(`/api/social/posts/${id}`, { method: "DELETE" })
    fetchPosts(); showToast("Post deleted", "success")
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (reader.result) setCImages(prev => [...prev, reader.result as string]) }
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ""
  }

  // Calendar helpers
  const cY = calMonth.getFullYear(), cM = calMonth.getMonth()
  const firstDay = new Date(cY, cM, 1).getDay()
  const daysInMonth = new Date(cY, cM + 1, 0).getDate()
  const calDays = Array.from({ length: 42 }, (_, i) => { const d = i - firstDay + 1; return d >= 1 && d <= daysInMonth ? d : null })
  const now = new Date()
  const isToday = (d: number) => d === now.getDate() && cM === now.getMonth() && cY === now.getFullYear()
  const postsOn = (d: number) => posts.filter(p => { const pd = new Date(p.scheduledAt || p.publishedAt || p.createdAt); return pd.getDate() === d && pd.getMonth() === cM && pd.getFullYear() === cY })

  const fbF = analytics?.facebook?.fanCount || 0
  const igF = analytics?.instagram?.followersCount || 0
  const recentFb = analytics?.facebook?.recentPosts || []
  const monthPostCount = posts.filter(p => p.status === "published").length
  const Skel = ({ h = "34px" }: { h?: string }) => <div style={{ height: h, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "6px", animation: "pulse 1.5s ease-in-out infinite" }} />

  if (isStylist) return <div style={{ padding: "40px", textAlign: "center", color: MUTED }}><div style={{ fontSize: "16px", fontWeight: 700 }}>Owner / Manager Access Only</div></div>

  return (
    <div style={{ ...jakarta, backgroundColor: "#06080d", minHeight: "100%", color: "#fff", padding: "24px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`@media(max-width:767px){.sg4{grid-template-columns:1fr 1fr !important}.sg2{grid-template-columns:1fr !important}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 500, color: "#fff", margin: 0 }}>Social Media Hub</h1>
            <div style={{ display: "flex", gap: "3px" }}>
              {["all", "CC", "SA", "BOTH"].map(l => (
                <button key={l} onClick={() => setLocFilter(l)} style={{ ...mono, padding: "4px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: locFilter === l ? `1px solid ${ACC_B}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: locFilter === l ? ACC_DIM : "transparent", color: locFilter === l ? ACC_B : MUTED, cursor: "pointer" }}>{l === "all" ? "All" : l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "3px" }}>
              {["all", "facebook", "instagram"].map(p => (
                <button key={p} onClick={() => setPlatFilter(p)} style={{ ...mono, padding: "4px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: platFilter === p ? `1px solid ${ACC_B}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: platFilter === p ? ACC_DIM : "transparent", color: platFilter === p ? ACC_B : MUTED, cursor: "pointer" }}>{p === "all" ? "All" : p === "facebook" ? "FB" : "IG"}</button>
              ))}
            </div>
            <button onClick={() => openComposer()} style={{ padding: "7px 16px", background: `linear-gradient(135deg, ${ACC_B}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta }}>Create Post</button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "20px", overflowX: "auto", borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: tab === t.id ? ACC_B : MUTED, backgroundColor: tab === t.id ? ACC_DIM : "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${ACC}` : "2px solid transparent", borderRadius: tab === t.id ? "6px 6px 0 0" : "0", cursor: "pointer", whiteSpace: "nowrap", ...mono }}>{t.label}</button>
          ))}
        </div>

        {/* ═══ CALENDAR TAB ═══ */}
        {tab === "calendar" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <button onClick={() => setCalMonth(new Date(cY, cM - 1))} style={{ background: "none", border: `1px solid ${BORDER2}`, borderRadius: "6px", padding: "5px 8px", color: ACC_B, cursor: "pointer" }}><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_left</span></button>
              <span style={{ fontSize: "16px", fontWeight: 700 }}>{calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setCalMonth(new Date())} style={{ ...mono, padding: "5px 10px", fontSize: "9px", border: `1px solid ${BORDER2}`, borderRadius: "5px", background: "none", color: ACC_B, cursor: "pointer", textTransform: "uppercase" }}>Today</button>
                <button onClick={() => setCalMonth(new Date(cY, cM + 1))} style={{ background: "none", border: `1px solid ${BORDER2}`, borderRadius: "6px", padding: "5px 8px", color: ACC_B, cursor: "pointer" }}><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_right</span></button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} style={{ textAlign: "center", fontSize: "10px", color: MUTED, padding: "6px 0", textTransform: "uppercase", ...mono }}>{d}</div>)}
              {calDays.map((d, i) => (
                <div key={i} onClick={() => d && openComposer(undefined, `${cY}-${String(cM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T10:00`)} style={{ minHeight: "80px", background: d ? (isToday(d) ? ACC_DIM : S1) : "transparent", border: `0.5px solid ${d && isToday(d) ? ACC_BDR : BORDER}`, borderRadius: "4px", padding: "4px", cursor: d ? "pointer" : "default", transition: "background 0.15s" }}>
                  {d && <>
                    <div style={{ ...mono, fontSize: "11px", color: isToday(d) ? "#fff" : ACC, textAlign: "right", marginBottom: "3px" }}>{d}</div>
                    {postsOn(d).slice(0, 3).map(p => (
                      <div key={p.id} onClick={e => { e.stopPropagation(); openComposer(p) }} style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", backgroundColor: p.platform === "facebook" ? "rgba(24,119,242,0.2)" : p.platform === "instagram" ? "rgba(188,24,136,0.2)" : "rgba(96,110,116,0.15)", color: p.platform === "facebook" ? FB : p.platform === "instagram" ? IG_C : ACC_B, borderLeft: p.status === "scheduled" ? `2px dashed ${AMBER}` : "none" }}>{p.content.slice(0, 20)}</div>
                    ))}
                    {postsOn(d).length > 3 && <div style={{ ...mono, fontSize: "8px", color: MUTED }}>+{postsOn(d).length - 3}</div>}
                  </>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ LIST TABS (Scheduled / Drafts / Published) ═══ */}
        {(tab === "scheduled" || tab === "drafts" || tab === "published") && (
          <div>
            {loadP ? [1,2,3].map(i => <div key={i} style={{ ...card, marginBottom: "8px" }}><Skel h="60px" /></div>) : posts.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: "48px", color: MUTED }}>No {tab} posts</div>
            ) : posts.map(p => (
              <div key={p.id} style={{ ...card, marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
                {/* Platform circle */}
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: p.platform === "facebook" ? FB : p.platform === "instagram" ? "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" : `linear-gradient(135deg, ${FB}, ${IG_C})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "14px", color: "#fff", fontWeight: 700 }}>{p.platform === "facebook" ? "f" : p.platform === "instagram" ? "ig" : "+"}</span>
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span style={{ ...mono, fontSize: "9px", padding: "2px 7px", borderRadius: "4px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BDR}`, color: ACC_B, textTransform: "uppercase" }}>{p.locationId}</span>
                    {p.scheduledAt && <span style={{ ...mono, fontSize: "11px", color: MUTED }}>{fmtDt(p.scheduledAt)}</span>}
                    {p.publishedAt && <span style={{ ...mono, fontSize: "11px", color: MUTED }}>{fmtDt(p.publishedAt)}</span>}
                    {p.status === "failed" && <span style={{ ...mono, fontSize: "9px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(255,107,107,0.1)", color: "#ff6b6b" }}>FAILED</span>}
                  </div>
                  <div style={{ fontSize: "13px", color: MID, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.content}</div>
                  {tab === "published" && (p.likes != null || p.comments != null) && (
                    <div style={{ ...mono, fontSize: "11px", color: MUTED, marginTop: "4px" }}>{p.likes || 0} likes · {p.comments || 0} comments · {p.shares || 0} shares</div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button onClick={() => openComposer(p)} style={{ padding: "5px 10px", border: `1px solid ${BORDER2}`, borderRadius: "6px", background: "none", color: ACC_B, fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>{tab === "published" ? "Repost" : "Edit"}</button>
                  {tab !== "published" && <button onClick={() => { /* quick publish */ savePost }} style={{ padding: "5px 10px", border: `1px solid ${ACC_BDR}`, borderRadius: "6px", background: "none", color: GREEN, fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>Post Now</button>}
                  <button onClick={() => deletePost(p.id)} style={{ padding: "5px 10px", border: `1px solid rgba(255,107,107,0.2)`, borderRadius: "6px", background: "none", color: "#ff6b6b", fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {tab === "analytics" && (
          <div>
            <div className="sg4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
              {[
                { label: "FB Followers", val: loadA ? null : fbF.toLocaleString(), border: FB },
                { label: "IG Followers", val: loadA ? null : igF.toLocaleString(), border: IG_C },
                { label: "Published This Month", val: loadP ? null : String(monthPostCount), border: ACC_B },
                { label: "Avg Engagement", val: loadA ? null : recentFb.length > 0 ? `${((recentFb.reduce((s, p) => s + p.likes + p.comments + p.shares, 0) / Math.max(recentFb.length, 1) / Math.max(fbF, 1) * 100)).toFixed(1)}%` : "\u2014", border: GREEN },
              ].map(k => (
                <div key={k.label} style={{ ...card, borderLeft: `3px solid ${k.border}`, borderRadius: "0 14px 14px 0" }}>
                  <div style={{ ...mono, fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: "8px" }}>{k.label}</div>
                  {k.val === null ? <Skel /> : <div style={{ ...mono, fontSize: "28px", fontWeight: 600, color: "#fff" }}>{k.val}</div>}
                </div>
              ))}
            </div>

            {/* Recent posts performance */}
            <div style={{ ...card, marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Recent Posts Performance</div>
              {recentFb.length === 0 ? <div style={{ color: MUTED, fontSize: "13px", textAlign: "center", padding: "20px" }}>No post data available</div> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Post", "Date", "Likes", "Comments", "Shares"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Post" ? "left" : "right", fontSize: "9px", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: `1px solid ${BORDER}`, ...mono }}>{h}</th>
                    ))}</tr></thead>
                    <tbody>{recentFb.sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares)).map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: "8px 10px", fontSize: "12px", color: MID, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.message || "(no text)"}</td>
                        <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "11px", color: MUTED }}>{new Date(p.createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                        <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "12px", color: ACC_B }}>{p.likes}</td>
                        <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "12px", color: ACC_B }}>{p.comments}</td>
                        <td style={{ ...mono, padding: "8px 10px", textAlign: "right", fontSize: "12px", color: ACC_B }}>{p.shares}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top post */}
            {recentFb.length > 0 && (() => {
              const top = [...recentFb].sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))[0]
              return (
                <div style={{ ...card, borderLeft: `3px solid ${GREEN}`, borderRadius: "0 14px 14px 0" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: GREEN, marginBottom: "8px" }}>Top Performing Post</div>
                  <div style={{ fontSize: "13px", color: MID, lineHeight: 1.5, marginBottom: "8px" }}>{top.message || "(no text)"}</div>
                  <div style={{ ...mono, fontSize: "11px", color: MUTED }}>{top.likes} likes · {top.comments} comments · {top.shares} shares</div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ═══ COMPOSER MODAL ═══ */}
      {showComp && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ backgroundColor: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "16px", width: "100%", maxWidth: "600px", maxHeight: "85vh", overflow: "auto", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>{editId ? "Edit Post" : "Create Post"}</h2>
              <button onClick={() => setShowComp(false)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: "20px" }}>&times;</button>
            </div>

            {/* Platform + Location */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
              {["facebook", "instagram", "both"].map(p => (
                <button key={p} onClick={() => setCPlat(p)} style={{ padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textTransform: "capitalize", border: cPlat === p ? `1px solid ${ACC}` : `1px solid ${BORDER2}`, backgroundColor: cPlat === p ? ACC_DIM : "transparent", color: cPlat === p ? "#fff" : MUTED, cursor: "pointer", ...jakarta }}>{p}</button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                {["CC", "SA", "BOTH"].map(l => (
                  <button key={l} onClick={() => setCLoc(l)} style={{ ...mono, padding: "5px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: cLoc === l ? `1px solid ${ACC_B}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: cLoc === l ? ACC_DIM : "transparent", color: cLoc === l ? ACC_B : MUTED, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Content */}
            <textarea value={cContent} onChange={e => setCContent(e.target.value)} placeholder="Write your caption..." style={{ ...inp, minHeight: "120px", resize: "vertical" as const, marginBottom: "4px" }} />
            <div style={{ ...mono, fontSize: "11px", color: cContent.length > 2100 ? "#ff6b6b" : cContent.length > 1800 ? AMBER : MUTED, textAlign: "right", marginBottom: "14px" }}>{cContent.length} / 2200</div>

            {/* Media */}
            <div style={{ marginBottom: "14px" }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
              <div onClick={() => fileRef.current?.click()} style={{ border: `1px dashed ${BORDER2}`, borderRadius: "10px", padding: "16px", textAlign: "center", cursor: "pointer", color: MUTED, fontSize: "12px" }}>
                Click to add images
              </div>
              {cImages.length > 0 && (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                  {cImages.map((img, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={img} alt="" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "6px", border: `1px solid ${BORDER2}` }} />
                      <button onClick={() => setCImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: "-4px", right: "-4px", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#ff6b6b", border: "none", color: "#fff", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: "10px" }}>
                <button onClick={() => window.open("https://www.canva.com/create/social-media-graphics/", "_blank")} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "#00C4CC", borderRadius: "7px", border: "none", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", ...jakarta }}>Create with Canva</button>
                <div style={{ fontSize: "10px", color: MUTED, marginTop: "4px" }}>Design in Canva, then upload the image above</div>
              </div>
            </div>

            {/* Schedule mode */}
            <div style={{ display: "flex", gap: "6px", marginBottom: cSchedMode === "schedule" ? "8px" : "18px" }}>
              {(["now", "schedule", "draft"] as const).map(m => (
                <button key={m} onClick={() => setCSchedMode(m)} style={{ flex: 1, padding: "8px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, border: cSchedMode === m ? `1px solid ${ACC}` : `1px solid ${BORDER2}`, backgroundColor: cSchedMode === m ? ACC_DIM : "transparent", color: cSchedMode === m ? "#fff" : MUTED, cursor: "pointer", ...jakarta }}>{m === "now" ? "Post Now" : m === "schedule" ? "Schedule" : "Save Draft"}</button>
              ))}
            </div>
            {cSchedMode === "schedule" && <input type="datetime-local" value={cDate} onChange={e => setCDate(e.target.value)} style={{ ...inp, marginBottom: "18px" }} />}

            {/* Submit */}
            <button onClick={savePost} disabled={cSaving || !cContent.trim()} style={{ width: "100%", padding: "12px", background: `linear-gradient(135deg, ${ACC_B}, ${ACC})`, border: "none", borderRadius: "10px", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: (!cContent.trim() || cSaving) ? 0.5 : 1 }}>
              {cSaving ? "Saving..." : cSchedMode === "now" ? "Publish Now" : cSchedMode === "schedule" ? "Schedule Post" : "Save Draft"}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "100px", right: "20px", background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(255,107,107,0.15)", border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(255,107,107,0.3)"}`, borderRadius: "10px", padding: "12px 18px", color: "#fff", fontSize: "13px", zIndex: 999, ...jakarta }}>{toast.msg}</div>
      )}

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
