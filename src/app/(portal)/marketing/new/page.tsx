"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Send, Users, MessageSquare, Eye, Loader2, AlertTriangle } from "lucide-react"
import { segmentCount } from "@/lib/sms/personalize"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: ACC, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "transparent", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "rgba(26,19,19,0.6)", cursor: "pointer" }
const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 13, color: "#1A1313", backgroundColor: "#FBFBFB", boxSizing: "border-box" }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" }

const AUDIENCE_TYPES = [
  { value: "ALL_CLIENTS", label: "All Clients" },
  { value: "BY_LOCATION", label: "By Location" },
  { value: "BY_LAST_VISIT", label: "By Last Visit" },
  { value: "BY_VISIT_COUNT", label: "By Visit Count" },
  { value: "BY_TOTAL_SPEND", label: "By Total Spend" },
  { value: "BY_BIRTHDAY_MONTH", label: "Birthday Month" },
  { value: "MANUAL", label: "Manual Selection" },
]
const CATEGORIES = ["PROMO", "RETENTION", "BIRTHDAY", "NEWSLETTER", "LAST_CHANCE", "WELCOME", "OTHER"]
const VARIABLES = ["{first_name}", "{last_name}", "{stylist_name}", "{location_name}", "{last_visit}"]

export default function NewCampaignPage() {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [category, setCategory] = useState("PROMO")
  const [audienceType, setAudienceType] = useState("ALL_CLIENTS")
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [daysParam, setDaysParam] = useState(60)
  const [daysOp, setDaysOp] = useState<"GT" | "LT">("GT")
  const [minVisits, setMinVisits] = useState<number | undefined>(undefined)
  const [maxVisits, setMaxVisits] = useState<number | undefined>(undefined)
  const [minSpend, setMinSpend] = useState<number | undefined>(undefined)
  const [maxSpend, setMaxSpend] = useState<number | undefined>(undefined)
  const [birthdayMonth, setBirthdayMonth] = useState(new Date().getMonth() + 1)
  const [preview, setPreview] = useState<{ count: number; estimatedCost: number; segments: number; sampleClients: { firstName: string | null; lastName: string | null }[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendConfirm, setSendConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const segments = segmentCount(body + " Reply STOP to opt out.")

  function buildFilter() {
    switch (audienceType) {
      case "BY_LOCATION": return { type: "BY_LOCATION", locationIds }
      case "BY_LAST_VISIT": return { type: "BY_LAST_VISIT", daysSinceLastVisit: daysParam, operator: daysOp }
      case "BY_VISIT_COUNT": return { type: "BY_VISIT_COUNT", minVisits, maxVisits }
      case "BY_TOTAL_SPEND": return { type: "BY_TOTAL_SPEND", minSpend, maxSpend }
      case "BY_BIRTHDAY_MONTH": return { type: "BY_BIRTHDAY_MONTH", month: birthdayMonth }
      default: return { type: "ALL_CLIENTS" }
    }
  }

  async function previewAudience() {
    setPreviewLoading(true)
    try {
      const r = await fetch("/api/marketing/audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audienceFilter: buildFilter(), channel: "SMS", body }) })
      const d = await r.json()
      setPreview(d)
    } catch { setError("Preview failed") }
    setPreviewLoading(false)
  }

  async function saveDraft() {
    setSaving(true)
    try {
      const r = await fetch("/api/marketing/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "SMS", category, body, audienceFilter: buildFilter() }) })
      const d = await r.json()
      setCampaignId(d.campaign?.id)
      router.push("/marketing")
    } catch { setError("Save failed") }
    setSaving(false)
  }

  async function sendNow() {
    setSaving(true); setError("")
    try {
      let id = campaignId
      if (!id) {
        const r = await fetch("/api/marketing/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "SMS", category, body, audienceFilter: buildFilter() }) })
        const d = await r.json()
        id = d.campaign?.id
      }
      if (!id) { setError("Failed to create campaign"); setSaving(false); return }
      await fetch(`/api/marketing/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send" }) })
      router.push(`/marketing/${id}`)
    } catch { setError("Send failed") }
    setSaving(false)
  }

  const insertVar = (v: string) => setBody(b => b + v)

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px" }}>New SMS Campaign</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 20, alignItems: "start" }}>
        {/* LEFT: Audience */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Users size={16} strokeWidth={1.5} color={ACC} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Audience</span>
          </div>
          <label style={lbl}>Audience Type</label>
          <select value={audienceType} onChange={e => setAudienceType(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
            {AUDIENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {audienceType === "BY_LOCATION" && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Locations</label>
              {["CC", "SA"].map(l => (
                <label key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1A1313", marginBottom: 4 }}>
                  <input type="checkbox" checked={locationIds.includes(l)} onChange={e => setLocationIds(e.target.checked ? [...locationIds, l] : locationIds.filter(x => x !== l))} />
                  {l === "CC" ? "Corpus Christi" : "San Antonio"}
                </label>
              ))}
            </div>
          )}
          {audienceType === "BY_LAST_VISIT" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select value={daysOp} onChange={e => setDaysOp(e.target.value as "GT" | "LT")} style={{ ...inp, flex: 1 }}>
                <option value="GT">More than</option><option value="LT">Less than</option>
              </select>
              <input type="number" value={daysParam} onChange={e => setDaysParam(Number(e.target.value))} style={{ ...inp, flex: 1 }} />
              <span style={{ fontSize: 13, color: "rgba(26,19,19,0.5)", alignSelf: "center" }}>days</span>
            </div>
          )}
          {audienceType === "BY_VISIT_COUNT" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Min</label><input type="number" value={minVisits ?? ""} onChange={e => setMinVisits(e.target.value ? Number(e.target.value) : undefined)} style={inp} /></div>
              <div style={{ flex: 1 }}><label style={lbl}>Max</label><input type="number" value={maxVisits ?? ""} onChange={e => setMaxVisits(e.target.value ? Number(e.target.value) : undefined)} style={inp} /></div>
            </div>
          )}
          {audienceType === "BY_TOTAL_SPEND" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Min $</label><input type="number" value={minSpend ?? ""} onChange={e => setMinSpend(e.target.value ? Number(e.target.value) : undefined)} style={inp} /></div>
              <div style={{ flex: 1 }}><label style={lbl}>Max $</label><input type="number" value={maxSpend ?? ""} onChange={e => setMaxSpend(e.target.value ? Number(e.target.value) : undefined)} style={inp} /></div>
            </div>
          )}
          {audienceType === "BY_BIRTHDAY_MONTH" && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Month</label>
              <select value={birthdayMonth} onChange={e => setBirthdayMonth(Number(e.target.value))} style={inp}>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("en-US", { month: "long" })}</option>)}
              </select>
            </div>
          )}

          <button onClick={previewAudience} disabled={previewLoading} style={btnGhost}>
            {previewLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Eye size={14} />}
            Preview Audience
          </button>
          {preview && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: "rgba(122,143,150,0.06)", borderRadius: 8, fontSize: 12, color: "#1A1313" }}>
              <strong>{preview.count.toLocaleString()}</strong> recipients
              {preview.sampleClients.length > 0 && (
                <div style={{ marginTop: 6, color: "rgba(26,19,19,0.5)", fontSize: 11 }}>
                  {preview.sampleClients.map((c, i) => <div key={i}>{c.firstName} {c.lastName}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER: Message */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MessageSquare size={16} strokeWidth={1.5} color={ACC} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Message</span>
          </div>
          <label style={lbl}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase().replace("_", " ")}</option>)}
          </select>
          <label style={lbl}>Body</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Hi {first_name}! We miss you at Salon Envy..." style={{ ...inp, minHeight: 140, resize: "vertical", marginBottom: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(26,19,19,0.4)", marginBottom: 8 }}>
            <span>{body.length} chars &middot; {segments} segment{segments > 1 ? "s" : ""}</span>
            <span style={{ color: body.length > 1500 ? "#dc2626" : "inherit" }}>{body.length > 1500 ? "Too long" : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
            {VARIABLES.map(v => <button key={v} onClick={() => insertVar(v)} style={{ padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 500, backgroundColor: "rgba(122,143,150,0.08)", border: "1px solid rgba(26,19,19,0.06)", color: ACC, cursor: "pointer" }}>{v}</button>)}
          </div>
          <div style={{ padding: 10, backgroundColor: "rgba(26,19,19,0.03)", borderRadius: 6, fontSize: 11, color: "rgba(26,19,19,0.4)" }}>
            Auto-appended: <em>Reply STOP to opt out.</em>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Eye size={16} strokeWidth={1.5} color={ACC} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Preview</span>
          </div>
          <div style={{ backgroundColor: "#e5e7eb", borderRadius: 16, padding: 12, marginBottom: 12 }}>
            <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#1A1313", lineHeight: 1.5, wordBreak: "break-word" }}>
              {(body || "Your message preview...").replace(/\{first_name\}/gi, "Sarah").replace(/\{last_name\}/gi, "M.").replace(/\{stylist_name\}/gi, "Clarissa").replace(/\{location_name\}/gi, "Corpus Christi").replace(/\{last_visit\}/gi, "Apr 15")}
              {!body.toLowerCase().includes("reply stop") && <span style={{ color: "rgba(26,19,19,0.4)" }}> Reply STOP to opt out.</span>}
            </div>
          </div>
          {preview && (
            <div style={{ fontSize: 11, color: "rgba(26,19,19,0.5)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div>Recipients: <strong style={{ color: "#1A1313" }}>{preview.count.toLocaleString()}</strong></div>
              <div>Segments: <strong style={{ color: "#1A1313" }}>{preview.segments}</strong></div>
              <div>Est. cost: <strong style={{ color: "#1A1313" }}>${preview.estimatedCost.toFixed(2)}</strong></div>
            </div>
          )}
        </div>
      </div>

      {error && <div style={{ marginTop: 16, padding: "8px 14px", backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 8, color: "#dc2626", fontSize: 12 }}><AlertTriangle size={12} style={{ marginRight: 6 }} />{error}</div>}

      {/* Action bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(26,19,19,0.06)" }}>
        <button onClick={() => router.push("/marketing")} style={btnGhost}>Cancel</button>
        <button onClick={saveDraft} disabled={saving || !body} style={{ ...btnGhost, opacity: saving || !body ? 0.5 : 1 }}>Save Draft</button>
        <button onClick={() => { if (!preview) previewAudience().then(() => setSendConfirm(true)); else setSendConfirm(true) }} disabled={!body} style={{ ...btnPrimary, opacity: !body ? 0.5 : 1 }}>
          <Send size={14} /> Send Now
        </button>
      </div>

      {/* Send confirmation modal */}
      {sendConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSendConfirm(false)}>
          <div style={{ ...cardStyle, maxWidth: 420, width: "90%", padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1313", margin: "0 0 12px" }}>Confirm Send</h2>
            <p style={{ fontSize: 13, color: "rgba(26,19,19,0.6)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Send to <strong>{(preview?.count || 0).toLocaleString()}</strong> recipients at estimated cost <strong>${(preview?.estimatedCost || 0).toFixed(2)}</strong>?
            </p>
            {(preview?.count || 0) > 100 && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Type SEND to confirm</label>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="SEND" style={inp} />
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setSendConfirm(false)} style={btnGhost}>Cancel</button>
              <button onClick={() => { setSendConfirm(false); sendNow() }} disabled={saving || ((preview?.count || 0) > 100 && confirmText !== "SEND")} style={{ ...btnPrimary, opacity: saving || ((preview?.count || 0) > 100 && confirmText !== "SEND") ? 0.5 : 1 }}>
                <Send size={14} /> Confirm and Send
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
