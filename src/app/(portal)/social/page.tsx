"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useUserRole } from "@/hooks/useUserRole"

type SPost = { id: string; locationId: string; platform: string; content: string; imageUrls: string[] | null; status: string; scheduledAt: string | null; publishedAt: string | null; fbPostId: string | null; igPostId: string | null; errorMessage: string | null; likes: number | null; comments: number | null; shares: number | null; createdAt: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Analytics = Record<string, any> | null
type Tab = "calendar" | "scheduled" | "drafts" | "published" | "analytics" | "design"
type Toast = { message: string; type: "success" | "error" } | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvaDesign = { id: string; title: string; thumbnail?: { url: string }; created_at?: number; urls?: { edit_url?: string } }

const ACC = "#606E74", ACC_B = "#7a8f96", ACC_DIM = "rgba(96,110,116,0.08)", ACC_BDR = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.06)", BORDER2 = "rgba(255,255,255,0.08)", S1 = "rgba(255,255,255,0.03)", S2 = "rgba(255,255,255,0.05)"
const CARD_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)"
const MUTED = "rgba(255,255,255,0.3)", MID = "rgba(255,255,255,0.6)", GREEN = "#10B981", AMBER = "#ffb347"
const FB = "#1877F2", IG = "#bc1888", CANVA = "#00C4CC"
const mono: React.CSSProperties = { fontFamily: "'Fira Code', 'Courier New', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }
const cs: React.CSSProperties = { backgroundColor: S1, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "20px", boxShadow: CARD_SHADOW }
const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER2}`, color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" as const, ...jakarta }
const lblS: React.CSSProperties = { ...mono, display: "block", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: MUTED, marginBottom: "8px" }

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Calendar" }, { id: "scheduled", label: "Scheduled" }, { id: "drafts", label: "Drafts" },
  { id: "published", label: "Published" }, { id: "analytics", label: "Analytics" }, { id: "design", label: "Canva" },
]
const HASHTAGS = ["#salonlife", "#hairgoals", "#hairstylist", "#corpuschristi", "#salonenvyusa", "#behindthechair", "#haircolor", "#balayage", "#haircare", "#beautysalon"]

function timeAgo(d: string) { const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "just now"; if (m < 60) return `${m}m`; if (m < 1440) return `${Math.round(m / 60)}h`; return `${Math.round(m / 1440)}d` }
function fmtDt(d: string) { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }
function pill(active: boolean, color?: string): React.CSSProperties { return { padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: active ? `1px solid ${color || ACC}` : `1px solid ${BORDER2}`, backgroundColor: active ? (color ? `${color}15` : ACC_DIM) : "transparent", color: active ? (color || ACC_B) : MUTED, ...jakarta, transition: "all 0.15s" } }

export default function SocialPage() {
  const { isOwner, isStylist } = useUserRole()
  const [tab, setTab] = useState<Tab>("calendar")
  const [locF, setLocF] = useState("BOTH")
  const [platF, setPlatF] = useState("all")
  const [posts, setPosts] = useState<SPost[]>([])
  const [loading, setLoading] = useState(true)
  const [cMo, setCMo] = useState(new Date().getMonth() + 1)
  const [cYr, setCYr] = useState(new Date().getFullYear())
  const [analytics, setAnalytics] = useState<Analytics>(null)
  const [anaLoc, setAnaLoc] = useState("CC")
  const [anaLoad, setAnaLoad] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  // Canva
  const [canvaOk, setCanvaOk] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [canvaUser, setCanvaUser] = useState<any>(null)
  const [canvaDesigns, setCanvaDesigns] = useState<CanvaDesign[]>([])
  const [canvaLoad, setCanvaLoad] = useState(false)
  const [canvaCont, setCanvaCont] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  // Composer
  const [showComp, setShowComp] = useState(false)
  const [editPost, setEditPost] = useState<SPost | null>(null)
  const [cLoc, setCLoc] = useState("BOTH")
  const [cPlats, setCPlats] = useState<string[]>(["facebook", "instagram"])
  const [cContent, setCContent] = useState("")
  const [cImages, setCImages] = useState<string[]>([])
  const [sMode, setSMode] = useState<"now" | "later" | "draft">("draft")
  const [cDate, setCDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [prevMode, setPrevMode] = useState<"instagram" | "facebook">("instagram")
  const fileRef = useRef<HTMLInputElement>(null)

  const showT = (m: string, t: "success" | "error" = "success") => { setToast({ message: m, type: t }); setTimeout(() => setToast(null), 3500) }

  // Social connections state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [connections, setConnections] = useState<any[]>([])
  const loadConnections = useCallback(async () => {
    try {
      const r = await fetch("/api/social/connections")
      const d = await r.json()
      setConnections(d.connections || [])
    } catch { /**/ }
  }, [])
  useEffect(() => { loadConnections() }, [loadConnections])
  const fbConn = connections.find(c => c.platform === "facebook" && c.isActive)
  const igConn = connections.find(c => c.platform === "instagram" && c.isActive)
  const hasConnections = connections.some(c => c.isActive)

  const disconnectAccount = async (id: string) => {
    await fetch(`/api/social/connections?id=${id}`, { method: "DELETE" })
    loadConnections()
    showT("Account disconnected")
  }

  // URL params on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get("tab")) setTab(p.get("tab") as Tab)
    if (p.get("canva") === "connected") showT("Connected to Canva")
    if (p.get("connected") === "true") { showT(`Connected ${p.get("pages") || ""} page(s) successfully`); loadConnections() }
    if (p.get("error")) {
      const err = p.get("error")
      showT(err === "denied" ? "Connection cancelled" : `Connection error: ${err}`, "error")
    }
  }, [loadConnections])

  // Data
  const loadPosts = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (locF !== "BOTH") p.set("locationId", locF)
    if (platF !== "all") p.set("platform", platF)
    if (tab === "scheduled") p.set("status", "scheduled"); else if (tab === "drafts") p.set("status", "draft"); else if (tab === "published") p.set("status", "published")
    if (tab === "calendar") { p.set("month", String(cMo)); p.set("year", String(cYr)) }
    try { const r = await fetch(`/api/social/posts?${p}`); const d = await r.json(); setPosts(d.posts || []) } catch { /**/ }
    setLoading(false)
  }, [tab, locF, platF, cMo, cYr])
  const loadAna = useCallback(async () => { setAnaLoad(true); try { const r = await fetch(`/api/social/analytics?locationId=${anaLoc}`); setAnalytics(await r.json()) } catch { /**/ }; setAnaLoad(false) }, [anaLoc])
  const checkCanva = async () => { try { const r = await fetch("/api/social/canva?action=status"); const d = await r.json(); setCanvaOk(d.connected); if (d.connected) setCanvaUser(d.user) } catch { /**/ } }
  const loadDesigns = async (pt?: string) => { setCanvaLoad(true); try { const r = await fetch(`/api/social/canva?action=designs${pt ? `&page_token=${pt}` : ""}`); const d = await r.json(); if (d.needsAuth) setCanvaOk(false); else { setCanvaDesigns(prev => pt ? [...prev, ...(d.designs || [])] : d.designs || []); setCanvaCont(d.continuation || null) } } catch { /**/ }; setCanvaLoad(false) }
  const exportDesign = async (did: string): Promise<string | null> => { setExporting(did); try { const r = await fetch(`/api/social/canva?action=export&design_id=${did}`); const d = await r.json(); return d.url || null } catch { return null } finally { setExporting(null) } }

  useEffect(() => { loadPosts() }, [loadPosts])
  useEffect(() => { if (tab === "analytics") loadAna() }, [tab, loadAna])
  useEffect(() => { checkCanva() }, [])
  useEffect(() => { if (tab === "design" && canvaOk) loadDesigns() }, [tab, canvaOk])

  // Composer
  function openComp(post?: SPost, date?: string, img?: string) {
    if (post) { setEditPost(post); setCLoc(post.locationId); setCPlats(post.platform === "both" ? ["facebook", "instagram"] : [post.platform]); setCContent(post.content); setCImages(Array.isArray(post.imageUrls) ? post.imageUrls : []); setSMode(post.scheduledAt ? "later" : "draft"); setCDate(post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : "") }
    else { setEditPost(null); setCLoc("BOTH"); setCPlats(["facebook", "instagram"]); setCContent(""); setCImages(img ? [img] : []); setSMode(date ? "later" : "draft"); setCDate(date || "") }
    setShowComp(true)
  }
  async function submitPost() {
    if (!cContent.trim()) return; setSaving(true)
    const status = sMode === "now" ? "published" : sMode === "later" ? "scheduled" : "draft"
    const platform = cPlats.length === 2 ? "both" : cPlats[0] || "both"
    const body = { locationId: cLoc, platform, content: cContent, imageUrls: cImages, status, scheduledAt: sMode === "later" && cDate ? cDate : null }
    try {
      const url = editPost ? `/api/social/posts/${editPost.id}` : "/api/social/posts"
      const r = await fetch(url, { method: editPost ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (r.ok) { setShowComp(false); setEditPost(null); loadPosts(); showT(status === "published" ? "Posted!" : status === "scheduled" ? "Scheduled" : "Draft saved") }
      else { const d = await r.json(); showT(d.error || "Failed", "error") }
    } catch { showT("Network error", "error") }; setSaving(false)
  }
  async function delPost(id: string) { await fetch(`/api/social/posts/${id}`, { method: "DELETE" }); loadPosts(); showT("Deleted") }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) { Array.from(e.target.files || []).forEach(f => { const r = new FileReader(); r.onload = () => { if (r.result) setCImages(p => [...p, r.result as string]) }; r.readAsDataURL(f) }); if (fileRef.current) fileRef.current.value = "" }

  // Calendar
  const fd = new Date(cYr, cMo - 1, 1).getDay(), dim = new Date(cYr, cMo, 0).getDate()
  const cells = Array.from({ length: 42 }, (_, i) => { const d = i - fd + 1; return d >= 1 && d <= dim ? d : null })
  const td = new Date(); const isToday = (d: number) => d === td.getDate() && cMo - 1 === td.getMonth() && cYr === td.getFullYear()
  const onDay = (d: number) => posts.filter(p => { const x = new Date(p.scheduledAt || p.publishedAt || p.createdAt); return x.getDate() === d && x.getMonth() === cMo - 1 && x.getFullYear() === cYr })
  const fbP = analytics?.fbPosts?.data || []; const igP = analytics?.igProfile || null
  const Sk = ({ h = "34px" }: { h?: string }) => <div style={{ height: h, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "6px", animation: "pulse 1.5s ease-in-out infinite" }} />

  if (isStylist) return <div style={{ padding: "40px", textAlign: "center", color: MUTED }}><div style={{ fontSize: "16px", fontWeight: 700 }}>Owner / Manager Access Only</div></div>

  return (
    <div style={{ ...jakarta, backgroundColor: "#06080d", minHeight: "100%", color: "#fff", padding: "24px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`@media(max-width:767px){.sg4{grid-template-columns:1fr 1fr !important}.sg2c{grid-template-columns:1fr !important}.comp-grid{grid-template-columns:1fr !important}.comp-prev{display:none !important}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 500, margin: 0 }}>Social Media</h1>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            {["BOTH", "CC", "SA"].map(l => <button key={l} onClick={() => setLocF(l)} style={{ ...mono, padding: "4px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: locF === l ? `1px solid ${ACC_B}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: locF === l ? ACC_DIM : "transparent", color: locF === l ? ACC_B : MUTED, cursor: "pointer" }}>{l === "BOTH" ? "Both" : l}</button>)}
            <div style={{ width: "1px", height: "18px", background: BORDER2, margin: "0 2px" }} />
            {["all", "facebook", "instagram"].map(p => <button key={p} onClick={() => setPlatF(p)} style={{ ...mono, padding: "4px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: platF === p ? `1px solid ${ACC_B}` : `1px solid ${BORDER2}`, borderRadius: "5px", backgroundColor: platF === p ? ACC_DIM : "transparent", color: platF === p ? ACC_B : MUTED, cursor: "pointer" }}>{p === "all" ? "All" : p === "facebook" ? "FB" : "IG"}</button>)}
            <button onClick={() => openComp()} style={{ padding: "7px 16px", background: `linear-gradient(135deg, ${ACC_B}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta }}>Create Post</button>
          </div>
        </div>
        {/* Connected Accounts */}
        {hasConnections ? (
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...mono, fontSize: "9px", color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: "4px" }}>Connected:</span>
            {connections.filter(c => c.isActive).map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BDR}`, borderRadius: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: GREEN }} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: ACC_B, ...jakarta }}>{c.platform === "facebook" ? "FB" : "IG"}: {c.pageName || c.platformUserName}</span>
                {c.followerCount != null && <span style={{ ...mono, fontSize: "10px", color: MUTED }}>{c.followerCount.toLocaleString()}</span>}
                {isOwner && <button onClick={() => disconnectAccount(c.id)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: "12px", padding: "0 0 0 4px", lineHeight: 1 }}>&times;</button>}
              </div>
            ))}
            {isOwner && <button onClick={() => window.location.href = "/api/social/oauth/facebook"} style={{ ...mono, fontSize: "10px", padding: "5px 10px", border: `1px dashed ${BORDER2}`, borderRadius: "8px", background: "none", color: MUTED, cursor: "pointer" }}>+ Add</button>}
          </div>
        ) : (
          <div style={{ background: `linear-gradient(135deg, rgba(24,119,242,0.08) 0%, rgba(131,58,180,0.08) 100%)`, border: `1px solid rgba(255,255,255,0.08)`, borderRadius: "16px", padding: "40px 24px", textAlign: "center", marginBottom: "20px" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", marginBottom: "8px", ...jakarta }}>Connect Your Social Accounts</div>
            <div style={{ fontSize: "13px", color: ACC_B, marginBottom: "24px", maxWidth: "420px", margin: "0 auto 24px", lineHeight: 1.6, ...jakarta }}>
              Connect your Facebook and Instagram accounts to manage posts, view analytics, and engage with clients from one place.
            </div>
            {isOwner ? (
              <>
                <button onClick={() => window.location.href = "/api/social/oauth/facebook"} style={{ background: FB, color: "#ffffff", border: "none", borderRadius: "10px", padding: "14px 28px", fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "10px", ...jakarta }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  Connect Facebook + Instagram
                </button>
                <div style={{ fontSize: "11px", color: MUTED, marginTop: "12px", ...jakarta }}>Log in with Facebook to connect. No tokens or developer access required.</div>
              </>
            ) : (
              <div style={{ fontSize: "13px", color: MID, ...jakarta }}>Ask the salon owner to connect social accounts.</div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "20px", overflowX: "auto", borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: tab === t.id ? ACC_B : MUTED, backgroundColor: tab === t.id ? ACC_DIM : "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${ACC}` : "2px solid transparent", borderRadius: tab === t.id ? "6px 6px 0 0" : "0", cursor: "pointer", whiteSpace: "nowrap", ...mono }}>{t.label}</button>)}
        </div>

        {/* ═══ CALENDAR ═══ */}
        {tab === "calendar" && (<div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <button onClick={() => { if (cMo === 1) { setCMo(12); setCYr(y => y - 1) } else setCMo(m => m - 1) }} style={{ background: "none", border: `1px solid ${BORDER2}`, borderRadius: "6px", padding: "5px 8px", color: ACC_B, cursor: "pointer" }}><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_left</span></button>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ fontSize: "16px", fontWeight: 700 }}>{new Date(cYr, cMo - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span><button onClick={() => { setCMo(td.getMonth() + 1); setCYr(td.getFullYear()) }} style={{ ...mono, padding: "4px 10px", fontSize: "9px", border: `1px solid ${BORDER2}`, borderRadius: "5px", background: "none", color: ACC_B, cursor: "pointer", textTransform: "uppercase" }}>Today</button></div>
            <button onClick={() => { if (cMo === 12) { setCMo(1); setCYr(y => y + 1) } else setCMo(m => m + 1) }} style={{ background: "none", border: `1px solid ${BORDER2}`, borderRadius: "6px", padding: "5px 8px", color: ACC_B, cursor: "pointer" }}><span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_right</span></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", background: BORDER }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, padding: "8px", background: "#06080d", textAlign: "center" }}>{d}</div>)}
            {cells.map((d, i) => (<div key={i} onClick={() => d && openComp(undefined, `${cYr}-${String(cMo).padStart(2, "0")}-${String(d).padStart(2, "0")}T10:00`)} style={{ minHeight: "90px", background: d ? isToday(d) ? ACC_DIM : S1 : "#06080d", padding: "6px", cursor: d ? "pointer" : "default", border: d && isToday(d) ? `1px solid ${ACC_BDR}` : "none" }}>
              {d && <><div style={{ ...mono, fontSize: "11px", color: isToday(d) ? ACC_B : MUTED, fontWeight: isToday(d) ? 500 : 400 }}>{d}</div>
                {onDay(d).slice(0, 3).map(p => <div key={p.id} onClick={e => { e.stopPropagation(); openComp(p) }} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", background: p.platform === "facebook" ? "rgba(24,119,242,0.15)" : p.platform === "instagram" ? "rgba(188,24,136,0.15)" : ACC_DIM, color: p.platform === "facebook" ? FB : p.platform === "instagram" ? IG : ACC_B, border: `1px solid ${p.platform === "facebook" ? "rgba(24,119,242,0.25)" : p.platform === "instagram" ? "rgba(188,24,136,0.25)" : ACC_BDR}` }}>{p.content.slice(0, 18)}</div>)}
                {onDay(d).length > 3 && <div style={{ ...mono, fontSize: "8px", color: MUTED, marginTop: "2px" }}>+{onDay(d).length - 3}</div>}</>}
            </div>))}
          </div>
        </div>)}

        {/* ═══ LIST TABS ═══ */}
        {(tab === "scheduled" || tab === "drafts" || tab === "published") && (<div>
          {loading ? [1,2,3].map(i => <div key={i} style={{ ...cs, marginBottom: "8px" }}><Sk h="60px" /></div>) : posts.length === 0 ? <div style={{ ...cs, textAlign: "center", padding: "48px", color: MUTED }}>No {tab} posts</div> : posts.map(p => (
            <div key={p.id} style={{ ...cs, marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap", borderLeft: `3px solid ${p.platform === "facebook" ? FB : p.platform === "instagram" ? IG : ACC_B}`, borderRadius: "0 14px 14px 0" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: p.platform === "facebook" ? FB : p.platform === "instagram" ? `linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, ${IG})` : `linear-gradient(135deg, ${FB}, ${IG})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "14px", color: "#fff", fontWeight: 700 }}>{p.platform === "facebook" ? "f" : p.platform === "instagram" ? "ig" : "+"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                  <span style={{ ...mono, fontSize: "9px", padding: "2px 7px", borderRadius: "4px", backgroundColor: ACC_DIM, border: `1px solid ${ACC_BDR}`, color: ACC_B, textTransform: "uppercase" }}>{p.locationId}</span>
                  <span style={{ ...mono, fontSize: "11px", color: MUTED }}>{p.scheduledAt ? fmtDt(p.scheduledAt) : p.publishedAt ? fmtDt(p.publishedAt) : timeAgo(p.createdAt)}</span>
                  {p.status === "failed" && <span style={{ ...mono, fontSize: "9px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(255,107,107,0.1)", color: "#ff6b6b" }}>FAILED</span>}
                </div>
                <div style={{ fontSize: "13px", color: MID, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.content}</div>
                {tab === "published" && (p.likes != null || p.comments != null) && <div style={{ ...mono, fontSize: "10px", color: MUTED, marginTop: "4px" }}>{p.likes || 0} likes · {p.comments || 0} comments · {p.shares || 0} shares</div>}
              </div>
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                <button onClick={() => openComp(p)} style={{ padding: "5px 10px", border: `1px solid ${BORDER2}`, borderRadius: "6px", background: "none", color: ACC_B, fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>{tab === "published" ? "Repost" : "Edit"}</button>
                <button onClick={() => delPost(p.id)} style={{ padding: "5px 10px", border: "1px solid rgba(255,107,107,0.2)", borderRadius: "6px", background: "none", color: "#ff6b6b", fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>Del</button>
              </div>
            </div>))}
        </div>)}

        {/* ═══ ANALYTICS ═══ */}
        {tab === "analytics" && (<div>
          {/* Location selector */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>{[{ id: "CC", label: "Corpus Christi" }, { id: "SA", label: "San Antonio" }].map(l => <button key={l.id} onClick={() => setAnaLoc(l.id)} style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 600, border: anaLoc === l.id ? `1px solid ${ACC_B}` : `1px solid ${BORDER2}`, borderRadius: "8px", backgroundColor: anaLoc === l.id ? ACC_DIM : "transparent", color: anaLoc === l.id ? ACC_B : MUTED, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", ...jakarta }}><div style={{ width: "6px", height: "6px", borderRadius: "50%", background: anaLoc === l.id ? GREEN : MUTED }} />{l.label}</button>)}</div>

          {/* Error/debug panel — only show for critical failures */}
          {(() => {
            const allErrs = (analytics?.errors || []) as { source: string; message: string; code?: number }[]
            const critical = allErrs.filter(e => e.source === "fb_page" || e.source === "ig_profile" || e.source === "fb_posts" || e.source === "ig_media")
            const minor = allErrs.filter(e => e.source === "ig_insights" || e.source === "fb_insights")
            if (!anaLoad && critical.length > 0) return (
              <div style={{ background: !analytics?.fbPage && !analytics?.igProfile ? "rgba(255,107,107,0.05)" : "rgba(255,179,71,0.05)", border: `1px solid ${!analytics?.fbPage && !analytics?.igProfile ? "rgba(255,107,107,0.2)" : "rgba(255,179,71,0.2)"}`, borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: !analytics?.fbPage && !analytics?.igProfile ? "#ff6b6b" : AMBER, marginBottom: "8px" }}>
                  {!analytics?.fbPage && !analytics?.igProfile ? "Analytics unavailable" : "Some data failed to load"}
                </div>
                {critical.map((err, i) => (
                  <div key={i} style={{ ...mono, fontSize: "11px", color: MUTED, marginBottom: "4px" }}>{err.source}: {err.message}{err.code ? ` [${err.code}]` : ""}</div>
                ))}
                {!analytics?.fbPage && !analytics?.igProfile && (
                  <div style={{ fontSize: "11px", color: MID, marginTop: "8px" }}>This usually means the page access token needs to be refreshed or the Meta app needs additional permissions.</div>
                )}
                {minor.length > 0 && (
                  <details style={{ marginTop: "8px" }}><summary style={{ ...mono, fontSize: "10px", color: MUTED, cursor: "pointer" }}>Details ({minor.length} minor)</summary>
                    {minor.map((err, i) => <div key={i} style={{ ...mono, fontSize: "10px", color: MUTED, marginTop: "4px" }}>{err.source}: {err.message}{err.code ? ` [${err.code}]` : ""}</div>)}
                  </details>
                )}
              </div>
            )
            return null
          })()}

          {/* KPI cards */}
          <div className="sg4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Facebook Followers", val: anaLoad ? null : analytics?.fbPage?.fan_count?.toLocaleString() || "\u2014", sub: analytics?.fbPage?.name, border: FB },
              { label: "Instagram Followers", val: anaLoad ? null : analytics?.igProfile?.followers_count?.toLocaleString() || "\u2014", sub: analytics?.igProfile?.username ? `@${analytics.igProfile.username}` : "", border: IG },
              { label: "Total Posts", val: anaLoad ? null : analytics?.igProfile?.media_count?.toLocaleString() || "\u2014", sub: "All time", border: ACC_B },
              { label: "Avg Engagement", val: anaLoad ? null : (() => { const fp = analytics?.fbPosts || []; if (fp.length === 0) return "\u2014"; const total = fp.reduce((s: number, p: { likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; shares?: { count?: number } }) => s + (p.likes?.summary?.total_count || 0) + (p.comments?.summary?.total_count || 0) + (p.shares?.count || 0), 0); return String(Math.round(total / fp.length)) })(), sub: "Per Facebook post", border: GREEN },
            ].map(k => (
              <div key={k.label} style={{ ...cs, borderLeft: `3px solid ${k.border}`, borderRadius: "0 14px 14px 0" }}>
                <div style={lblS}>{k.label}</div>
                {k.val === null ? <Sk /> : <div style={{ ...mono, fontSize: "28px", fontWeight: 500 }}>{k.val}</div>}
                {k.sub && <div style={{ fontSize: "11px", color: MID, marginTop: "4px" }}>{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* Two column: FB posts table + IG grid */}
          <div className="sg2c" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px", marginBottom: "16px" }}>
            {/* FB posts table */}
            <div style={cs}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Recent Facebook Posts</div>
              {(analytics?.fbPosts || []).length === 0 ? <div style={{ color: MUTED, textAlign: "center", padding: "20px", fontSize: "12px" }}>No posts</div> : (
                <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Post","Date","Likes","Comments","Shares"].map(h => <th key={h} style={{ padding: "8px", textAlign: h === "Post" ? "left" : "right", fontSize: "9px", fontWeight: 700, color: MUTED, textTransform: "uppercase", borderBottom: `1px solid ${BORDER}`, ...mono }}>{h}</th>)}</tr></thead><tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(analytics?.fbPosts || []).map((p: any, i: number) => <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}><td style={{ padding: "10px 8px", fontSize: "12px", color: MID, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.message || "").slice(0, 60) || "(no caption)"}</td><td style={{ ...mono, padding: "8px", textAlign: "right", fontSize: "11px", color: MUTED }}>{p.created_time ? new Date(p.created_time).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</td><td style={{ ...mono, padding: "8px", textAlign: "right", fontSize: "12px", color: ACC_B }}>{p.likes?.summary?.total_count || 0}</td><td style={{ ...mono, padding: "8px", textAlign: "right", fontSize: "12px", color: ACC_B }}>{p.comments?.summary?.total_count || 0}</td><td style={{ ...mono, padding: "8px", textAlign: "right", fontSize: "12px", color: ACC_B }}>{p.shares?.count || 0}</td></tr>)}
                </tbody></table></div>
              )}
            </div>
            {/* IG media grid */}
            <div style={cs}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Recent Instagram Posts</div>
              {(analytics?.igMedia || []).length === 0 ? <div style={{ color: MUTED, textAlign: "center", padding: "20px", fontSize: "12px" }}>No media</div> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(analytics?.igMedia || []).map((m: any) => (
                    <div key={m.id} style={{ position: "relative", aspectRatio: "1", overflow: "hidden", borderRadius: "6px", background: S2 }}>
                      {(m.media_url || m.thumbnail_url) ? <img src={m.media_url || m.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: MUTED, fontSize: "10px" }}>TEXT</div>}
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", opacity: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.2s" }} onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
                        <span style={{ ...mono, fontSize: "11px", color: "#fff" }}>{m.like_count || 0} likes · {m.comments_count || 0} comments</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>)}

        {/* ═══ CANVA DESIGN TAB ═══ */}
        {tab === "design" && (<div>
          {!canvaOk ? (
            isOwner ? (
              <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: "480px", margin: "0 auto" }}>
                <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: CANVA, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "32px", fontWeight: 700, color: "#fff" }}>C</div>
                <div style={{ fontSize: "24px", fontWeight: 500, marginBottom: "10px" }}>Connect Your Canva Account</div>
                <p style={{ fontSize: "14px", color: MID, lineHeight: 1.7, marginBottom: "24px" }}>Connect once and your entire team will have access to your designs for posting to Facebook and Instagram.</p>
                <button onClick={() => { window.location.href = "/api/social/canva?action=auth" }} style={{ padding: "12px 28px", background: CANVA, border: "none", borderRadius: "9px", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer", ...jakarta }}>Connect Canva Account</button>
                <p style={{ fontSize: "11px", color: MUTED, marginTop: "12px" }}>You will be redirected to Canva to authorize read access to your designs.</p>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", maxWidth: "440px", margin: "0 auto" }}>
                <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: CANVA, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "32px", fontWeight: 700, color: "#fff", opacity: 0.5 }}>C</div>
                <div style={{ fontSize: "18px", fontWeight: 500, marginBottom: "10px" }}>Canva not connected</div>
                <p style={{ fontSize: "14px", color: MID, lineHeight: 1.7 }}>The salon owner hasn&apos;t connected a Canva account yet. Once connected, designs will appear here for the whole team.</p>
              </div>
            )
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px", fontWeight: 500 }}>Salon Envy Designs</span>
                  <span style={{ fontSize: "10px", color: CANVA }}>Powered by Canva</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {isOwner && canvaUser?.profile?.display_name && <span style={{ ...mono, fontSize: "10px", color: MUTED }}>Connected as {canvaUser.profile.display_name}</span>}
                  <button onClick={() => window.open("https://www.canva.com/design/new", "_blank")} style={{ padding: "7px 14px", border: `1px solid ${CANVA}40`, borderRadius: "7px", background: "none", color: CANVA, fontSize: "12px", fontWeight: 600, cursor: "pointer", ...jakarta }}>New Design</button>
                  {isOwner && <button onClick={async () => { await fetch("/api/social/canva?action=disconnect"); setCanvaOk(false); setCanvaDesigns([]) }} style={{ padding: "7px 14px", border: `1px solid ${BORDER2}`, borderRadius: "7px", background: "none", color: MUTED, fontSize: "12px", cursor: "pointer", ...jakarta }}>Disconnect</button>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                {canvaLoad && canvaDesigns.length === 0 ? Array.from({ length: 6 }, (_, i) => <div key={i} style={{ ...cs, height: "260px", animation: "pulse 1.5s ease-in-out infinite" }} />) : canvaDesigns.map(d => (
                  <div key={d.id} style={{ ...cs, overflow: "hidden", padding: 0, cursor: "pointer", transition: "all 0.2s" }}>
                    <div style={{ width: "100%", aspectRatio: "1", background: S2, overflow: "hidden" }}>
                      {d.thumbnail?.url ? <img src={d.thumbnail.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: MUTED, fontSize: "12px" }}>No preview</div>}
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "4px" }}>{d.title || "Untitled"}</div>
                      <div style={{ ...mono, fontSize: "10px", color: MUTED, marginBottom: "8px" }}>{d.created_at ? new Date(d.created_at * 1000).toLocaleDateString() : ""}</div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {d.urls?.edit_url && <button onClick={() => window.open(d.urls!.edit_url, "_blank")} style={{ flex: 1, padding: "5px", border: `1px solid ${BORDER2}`, borderRadius: "5px", background: "none", color: ACC_B, fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono }}>Edit</button>}
                        <button onClick={async () => { const url = await exportDesign(d.id); if (url) { openComp(undefined, undefined, url); showT("Design exported — compose your post") } else showT("Export failed", "error") }} disabled={exporting === d.id} style={{ flex: 1, padding: "5px", border: `1px solid ${CANVA}40`, borderRadius: "5px", background: "none", color: CANVA, fontSize: "10px", fontWeight: 700, cursor: "pointer", ...mono, opacity: exporting === d.id ? 0.5 : 1 }}>{exporting === d.id ? "..." : "Use"}</button>
                      </div>
                    </div>
                  </div>))}
              </div>
              {canvaCont && <div style={{ textAlign: "center", marginTop: "16px" }}><button onClick={() => loadDesigns(canvaCont)} disabled={canvaLoad} style={{ padding: "8px 20px", border: `1px solid ${BORDER2}`, borderRadius: "7px", background: "none", color: ACC_B, fontSize: "12px", cursor: "pointer", ...jakarta }}>{canvaLoad ? "Loading..." : "Load more"}</button></div>}
            </div>
          )}
        </div>)}
      </div>

      {/* ═══ COMPOSER ═══ */}
      {showComp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="comp-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", width: "100%", maxWidth: "960px", maxHeight: "90vh", background: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "16px", overflow: "hidden" }}>
            {/* LEFT: Editor */}
            <div style={{ padding: "28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 500, margin: 0 }}>{editPost ? "Edit Post" : "New Post"}</h2>
                <button onClick={() => { setShowComp(false); setEditPost(null) }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: "20px" }}>&times;</button>
              </div>
              {/* Platform */}
              <div><div style={lblS}>Platform</div><div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setCPlats(p => p.includes("facebook") ? p.filter(x => x !== "facebook") : [...p, "facebook"])} style={pill(cPlats.includes("facebook"), FB)}>Facebook</button>
                <button onClick={() => setCPlats(p => p.includes("instagram") ? p.filter(x => x !== "instagram") : [...p, "instagram"])} style={pill(cPlats.includes("instagram"), IG)}>Instagram</button>
              </div></div>
              {/* Location */}
              <div><div style={lblS}>Post to</div><div style={{ display: "flex", gap: "8px" }}>
                {["CC", "SA", "BOTH"].map(l => <button key={l} onClick={() => setCLoc(l)} style={pill(cLoc === l)}>{l === "CC" ? "Corpus Christi" : l === "SA" ? "San Antonio" : "Both Locations"}</button>)}
              </div></div>
              {/* Media */}
              <div><div style={lblS}>Photos</div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFile} />
                {cImages.length === 0 ? (
                  <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${BORDER2}`, borderRadius: "12px", padding: "40px 20px", textAlign: "center", cursor: "pointer", background: S1 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={ACC_B} strokeWidth="1.5" style={{ margin: "0 auto 10px", display: "block" }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                    <div style={{ fontSize: "14px", color: MID, fontWeight: 500 }}>Add photos</div>
                    <div style={{ fontSize: "12px", color: MUTED, marginTop: "4px" }}>or drag and drop here</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                    {cImages.map((img, i) => <div key={i} style={{ position: "relative", flexShrink: 0 }}><img src={img} alt="" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px", border: `1px solid ${BORDER2}` }} /><button onClick={() => setCImages(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: "-4px", right: "-4px", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>{i === 0 && <div style={{ position: "absolute", bottom: "4px", left: "4px", ...mono, fontSize: "8px", padding: "1px 4px", borderRadius: "3px", background: "rgba(0,0,0,0.6)", color: "#fff" }}>Cover</div>}</div>)}
                    <div onClick={() => fileRef.current?.click()} style={{ width: "80px", height: "80px", flexShrink: 0, border: `2px dashed ${BORDER2}`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "24px", color: MUTED }}>+</div>
                  </div>
                )}
              </div>
              {/* Caption */}
              <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={lblS}>Caption</span><span style={{ ...mono, fontSize: "11px", color: cContent.length > 2000 ? "#ff6b6b" : cContent.length > 1800 ? AMBER : MUTED }}>{cContent.length.toLocaleString()} / 2,200</span></div>
                <textarea value={cContent} onChange={e => setCContent(e.target.value)} placeholder="Write a caption..." style={{ ...inp, minHeight: "120px", resize: "vertical" as const, fontSize: "15px", lineHeight: "1.6", borderRadius: "10px" }} />
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "8px" }}>{HASHTAGS.slice(0, 6).map(h => <button key={h} onClick={() => setCContent(c => c + " " + h)} style={{ ...mono, fontSize: "10px", padding: "3px 8px", borderRadius: "9999px", backgroundColor: ACC_DIM, border: `1px solid ${BORDER}`, color: ACC_B, cursor: "pointer" }}>{h}</button>)}</div>
              </div>
              {/* Schedule */}
              <div><div style={lblS}>When</div><div style={{ display: "flex", gap: "6px" }}>
                {([["now", "Post Now"], ["later", "Schedule"], ["draft", "Save Draft"]] as const).map(([m, l]) => <button key={m} onClick={() => setSMode(m)} style={pill(sMode === m)}>{l}</button>)}
              </div>{sMode === "later" && <input type="datetime-local" value={cDate} onChange={e => setCDate(e.target.value)} style={{ ...inp, marginTop: "10px" }} />}</div>
              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "auto", paddingTop: "16px", borderTop: `1px solid ${BORDER}` }}>
                <button onClick={() => { setShowComp(false); setEditPost(null) }} style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "9px", color: MID, fontSize: "13px", cursor: "pointer", ...jakarta }}>Cancel</button>
                <button onClick={submitPost} disabled={saving || !cContent.trim()} style={{ padding: "10px 24px", background: `linear-gradient(135deg, ${ACC_B}, ${ACC})`, border: "none", borderRadius: "9px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", ...jakarta, opacity: (!cContent.trim() || saving) ? 0.5 : 1 }}>{saving ? "Saving..." : sMode === "now" ? "Post Now" : sMode === "later" ? "Schedule" : "Save Draft"}</button>
              </div>
            </div>
            {/* RIGHT: Phone preview */}
            <div className="comp-prev" style={{ borderLeft: `1px solid ${BORDER}`, background: "rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px", overflowY: "auto" }}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
                <button onClick={() => setPrevMode("instagram")} style={pill(prevMode === "instagram", IG)}>Instagram</button>
                <button onClick={() => setPrevMode("facebook")} style={pill(prevMode === "facebook", FB)}>Facebook</button>
              </div>
              <div style={{ width: "280px", background: "#000", borderRadius: "36px", border: "8px solid #1a1a1a", overflow: "hidden", boxShadow: "0 0 0 2px #333, 0 20px 60px rgba(0,0,0,0.5)" }}>
                {/* Status bar */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 20px 4px", fontSize: "11px", color: "#fff", fontWeight: 600 }}><span>9:41</span><span style={{ display: "flex", gap: "4px" }}><span style={{ fontSize: "9px" }}>5G</span></span></div>
                {/* App header */}
                <div style={{ padding: "8px 14px", borderBottom: `1px solid rgba(255,255,255,0.1)` }}><span style={{ fontSize: "16px", fontWeight: 700 }}>{prevMode === "instagram" ? "Instagram" : "Facebook"}</span></div>
                {/* Post */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: ACC_DIM, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "10px", fontWeight: 700, color: ACC_B }}>SE</span></div>
                    <div><div style={{ fontSize: "12px", fontWeight: 600 }}>{cLoc === "SA" ? "salonenvysa" : "salonenvyusa"}</div><div style={{ ...mono, fontSize: "9px", color: MUTED }}>{cLoc === "CC" ? "Corpus Christi, TX" : cLoc === "SA" ? "San Antonio, TX" : "Texas"}</div></div>
                  </div>
                  {cImages.length > 0 ? <img src={cImages[0]} alt="" style={{ width: "100%", aspectRatio: prevMode === "instagram" ? "1" : "1.91", objectFit: "cover" }} /> : <div style={{ width: "100%", aspectRatio: prevMode === "instagram" ? "1" : "1.91", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg></div>}
                  {prevMode === "instagram" && <div style={{ display: "flex", gap: "14px", padding: "10px 12px" }}>{["favorite_border", "chat_bubble_outline", "send"].map(ic => <span key={ic} className="material-symbols-outlined" style={{ fontSize: "22px", color: "#fff" }}>{ic}</span>)}</div>}
                  <div style={{ padding: prevMode === "instagram" ? "0 12px 12px" : "8px 12px 12px" }}>
                    {prevMode === "facebook" && <div style={{ display: "flex", gap: "12px", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "8px" }}>{["Like", "Comment", "Share"].map(a => <span key={a} style={{ fontSize: "11px", color: "#B0B3B8" }}>{a}</span>)}</div>}
                    <div style={{ fontSize: "12px", color: cContent ? "#E4E6EB" : MUTED, lineHeight: 1.5, maxHeight: "80px", overflow: "hidden" }}>
                      {prevMode === "instagram" && <span style={{ fontWeight: 600, marginRight: "4px" }}>{cLoc === "SA" ? "salonenvysa" : "salonenvyusa"}</span>}
                      {cContent || "Your caption here..."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div style={{ position: "fixed", bottom: "100px", right: "20px", background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(255,107,107,0.15)", border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(255,107,107,0.3)"}`, borderRadius: "10px", padding: "12px 20px", color: "#fff", fontSize: "13px", fontWeight: 500, zIndex: 999, backdropFilter: "blur(8px)", ...jakarta }}>{toast.message}</div>}

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
