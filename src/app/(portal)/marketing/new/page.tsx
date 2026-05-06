"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Send, Users, MessageSquare, Eye, Loader2, AlertTriangle, X, MapPin, Calendar, TrendingUp, DollarSign, Cake, UserPlus, Smartphone } from "lucide-react"
import { segmentCount } from "@/lib/sms/personalize"
import ClientSearchPicker from "@/components/marketing/ClientSearchPicker"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#1A1313", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "transparent", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "rgba(26,19,19,0.6)", cursor: "pointer" }
const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 13, color: "#1A1313", backgroundColor: "#FBFBFB", boxSizing: "border-box", outline: "none" }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" }

const COST_PER_SEGMENT = 0.0079
const CATEGORIES = ["PROMO", "RETENTION", "BIRTHDAY", "NEWSLETTER", "LAST_CHANCE", "WELCOME", "OTHER"]
const VARIABLES = ["{first_name}", "{last_name}", "{full_name}", "{stylist_name}", "{location_name}"]

interface PickedClient { id: string; firstName: string | null; lastName: string | null; phone: string | null; email: string | null }
interface PreviewData { count: number; estimatedCost: number; segments: number; sampleClients: PickedClient[] }

const AUDIENCE_TYPES = [
  { value: "ALL_CLIENTS", label: "All clients with marketing consent", desc: "Everyone opted in with a valid phone", icon: <Users size={16} strokeWidth={1.5} /> },
  { value: "BY_LOCATION", label: "By location", desc: "Corpus Christi, San Antonio, or both", icon: <MapPin size={16} strokeWidth={1.5} /> },
  { value: "BY_LAST_VISIT", label: "By last visit", desc: "Haven't visited in N days", icon: <Calendar size={16} strokeWidth={1.5} /> },
  { value: "BY_VISIT_COUNT", label: "By visit count", desc: "Clients with X-Y total visits", icon: <TrendingUp size={16} strokeWidth={1.5} /> },
  { value: "BY_TOTAL_SPEND", label: "By total spend", desc: "Clients who spent $X-$Y lifetime", icon: <DollarSign size={16} strokeWidth={1.5} /> },
  { value: "BY_BIRTHDAY_MONTH", label: "Birthday this month", desc: "Celebrate your clients", icon: <Cake size={16} strokeWidth={1.5} /> },
  { value: "MANUAL", label: "Manual selection", desc: "Pick clients individually", icon: <UserPlus size={16} strokeWidth={1.5} /> },
]

export default function NewCampaignPage() {
  const router = useRouter()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState("")
  const [category, setCategory] = useState("PROMO")
  const [channel, setChannel] = useState<"SMS" | "MMS">("SMS")
  const [audienceType, setAudienceType] = useState("ALL_CLIENTS")
  const [locationIds, setLocationIds] = useState<string[]>(["CC", "SA"])
  const [daysParam, setDaysParam] = useState(60)
  const [daysOp, setDaysOp] = useState<"GT" | "LT">("GT")
  const [minVisits, setMinVisits] = useState<number | undefined>(undefined)
  const [maxVisits, setMaxVisits] = useState<number | undefined>(undefined)
  const [minSpend, setMinSpend] = useState<number | undefined>(undefined)
  const [maxSpend, setMaxSpend] = useState<number | undefined>(undefined)
  const [birthdayMonth, setBirthdayMonth] = useState(new Date().getMonth() + 1)
  const [manualClients, setManualClients] = useState<PickedClient[]>([])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendConfirm, setSendConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [error, setError] = useState("")
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const fullBody = body + (body.toLowerCase().includes("reply stop") ? "" : " Reply STOP to opt out.")
  const segs = segmentCount(fullBody)
  const charCount = fullBody.length

  function buildFilter() {
    switch (audienceType) {
      case "BY_LOCATION": return { type: "BY_LOCATION", locationIds }
      case "BY_LAST_VISIT": return { type: "BY_LAST_VISIT", daysSinceLastVisit: daysParam, operator: daysOp }
      case "BY_VISIT_COUNT": return { type: "BY_VISIT_COUNT", minVisits, maxVisits }
      case "BY_TOTAL_SPEND": return { type: "BY_TOTAL_SPEND", minSpend, maxSpend }
      case "BY_BIRTHDAY_MONTH": return { type: "BY_BIRTHDAY_MONTH", month: birthdayMonth }
      case "MANUAL": return { type: "MANUAL", clientIds: manualClients.map(c => c.id) }
      default: return { type: "ALL_CLIENTS" }
    }
  }

  const doPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const r = await fetch("/api/marketing/audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audienceFilter: buildFilter(), channel: "SMS", body: fullBody }) })
      const d = await r.json()
      setPreview(d)
      setPreviewOpen(true)
    } catch { setError("Preview failed") }
    setPreviewLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceType, locationIds, daysParam, daysOp, minVisits, maxVisits, minSpend, maxSpend, birthdayMonth, manualClients, fullBody])

  function insertVar(v: string) {
    const ta = bodyRef.current
    if (!ta) { setBody(b => b + v); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newBody = body.slice(0, start) + v + body.slice(end)
    setBody(newBody)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + v.length, start + v.length) }, 0)
  }

  async function saveDraft() {
    setSaving(true)
    try {
      await fetch("/api/marketing/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, category, body, audienceFilter: buildFilter() }) })
      router.push("/marketing")
    } catch { setError("Save failed") }
    setSaving(false)
  }

  async function sendNow() {
    setSaving(true); setError("")
    try {
      const cr = await fetch("/api/marketing/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, category, body, audienceFilter: buildFilter() }) })
      const cd = await cr.json()
      const id = cd.campaign?.id
      if (!id) { setError("Failed to create campaign"); setSaving(false); return }
      await fetch(`/api/marketing/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send" }) })
      router.push(`/marketing/${id}`)
    } catch { setError("Send failed") }
    setSaving(false)
  }

  async function sendTest() {
    setTestLoading(true); setTestStatus(null)
    try {
      const r = await fetch("/api/marketing/test-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) })
      const d = await r.json()
      if (r.ok) setTestStatus(`Test sent to ${d.sentTo}. Check your phone.`)
      else setTestStatus(d.error || "Test failed")
    } catch { setTestStatus("Network error") }
    setTestLoading(false)
  }

  useEffect(() => { setPreview(null) }, [audienceType])

  const previewBody = (body || "Your message preview...").replace(/\{first_name\}/gi, "Sarah").replace(/\{last_name\}/gi, "Martinez").replace(/\{full_name\}/gi, "Sarah Martinez").replace(/\{stylist_name\}/gi, "Clarissa").replace(/\{location_name\}/gi, "Corpus Christi").replace(/\{last_visit\}/gi, "Apr 15")
  const recipientCount = audienceType === "MANUAL" ? manualClients.length : (preview?.count ?? 0)
  const estCost = recipientCount * segs * COST_PER_SEGMENT

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px", letterSpacing: "-0.31px" }}>New Campaign</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 20, alignItems: "start" }}>
        {/* LEFT: Audience */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Users size={16} strokeWidth={1.5} color={ACC} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Who</span>
          </div>
          <p style={{ fontSize: 11, color: "rgba(26,19,19,0.4)", margin: "0 0 14px" }}>Choose your audience</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {AUDIENCE_TYPES.map(t => {
              const selected = audienceType === t.value
              return (
                <div key={t.value}>
                  <div onClick={() => setAudienceType(t.value)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${selected ? ACC : "rgba(26,19,19,0.06)"}`, backgroundColor: selected ? `${ACC}08` : "transparent", cursor: "pointer" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected ? ACC : "rgba(26,19,19,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: ACC }} />}
                    </div>
                    <div style={{ color: selected ? ACC : "rgba(26,19,19,0.4)", flexShrink: 0 }}>{t.icon}</div>
                    <div><div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{t.label}</div><div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)" }}>{t.desc}</div></div>
                  </div>
                  {selected && t.value === "BY_LOCATION" && <div style={{ padding: "8px 12px 8px 44px" }}>{["CC", "SA"].map(l => <label key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1A1313", marginBottom: 4, cursor: "pointer" }}><input type="checkbox" checked={locationIds.includes(l)} onChange={e => setLocationIds(e.target.checked ? [...locationIds, l] : locationIds.filter(x => x !== l))} />{l === "CC" ? "Corpus Christi" : "San Antonio"}</label>)}</div>}
                  {selected && t.value === "BY_LAST_VISIT" && <div style={{ padding: "8px 12px 8px 44px", display: "flex", gap: 6, alignItems: "center" }}><select value={daysOp} onChange={e => setDaysOp(e.target.value as "GT" | "LT")} style={{ ...inp, flex: 1, padding: "6px 8px" }}><option value="GT">More than</option><option value="LT">Less than</option></select><input type="number" value={daysParam} onChange={e => setDaysParam(Number(e.target.value))} style={{ ...inp, width: 70, flex: "none", padding: "6px 8px" }} /><span style={{ fontSize: 12, color: "rgba(26,19,19,0.5)" }}>days</span></div>}
                  {selected && t.value === "BY_VISIT_COUNT" && <div style={{ padding: "8px 12px 8px 44px", display: "flex", gap: 6 }}><div><label style={{ ...lbl, marginBottom: 2 }}>Min</label><input type="number" value={minVisits ?? ""} onChange={e => setMinVisits(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, padding: "6px 8px" }} /></div><div><label style={{ ...lbl, marginBottom: 2 }}>Max</label><input type="number" value={maxVisits ?? ""} onChange={e => setMaxVisits(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, padding: "6px 8px" }} /></div></div>}
                  {selected && t.value === "BY_TOTAL_SPEND" && <div style={{ padding: "8px 12px 8px 44px", display: "flex", gap: 6 }}><div><label style={{ ...lbl, marginBottom: 2 }}>Min $</label><input type="number" value={minSpend ?? ""} onChange={e => setMinSpend(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, padding: "6px 8px" }} /></div><div><label style={{ ...lbl, marginBottom: 2 }}>Max $</label><input type="number" value={maxSpend ?? ""} onChange={e => setMaxSpend(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, padding: "6px 8px" }} /></div></div>}
                  {selected && t.value === "BY_BIRTHDAY_MONTH" && <div style={{ padding: "8px 12px 8px 44px" }}><select value={birthdayMonth} onChange={e => setBirthdayMonth(Number(e.target.value))} style={{ ...inp, padding: "6px 8px" }}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("en-US", { month: "long" })}</option>)}</select></div>}
                  {selected && t.value === "MANUAL" && <div style={{ padding: "8px 12px 8px 44px" }}><ClientSearchPicker selectedClients={manualClients} onChange={setManualClients} /></div>}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 14 }}><button onClick={doPreview} disabled={previewLoading} style={btnGhost}>{previewLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Eye size={14} />}Preview Audience</button></div>
        </div>

        {/* CENTER: Message */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><MessageSquare size={16} strokeWidth={1.5} color={ACC} /><span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Message</span></div>
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>{(["SMS", "MMS"] as const).map(ch => <button key={ch} onClick={() => setChannel(ch)} style={{ padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px solid", borderColor: channel === ch ? ACC : "rgba(26,19,19,0.08)", backgroundColor: channel === ch ? `${ACC}11` : "transparent", color: channel === ch ? ACC : "rgba(26,19,19,0.5)", cursor: "pointer" }}>{ch}</button>)}<button disabled style={{ padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px solid rgba(26,19,19,0.06)", backgroundColor: "transparent", color: "rgba(26,19,19,0.25)", cursor: "not-allowed" }} title="Coming next">Email</button></div>
          <label style={lbl}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, marginBottom: 12 }}>{CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase().replace("_", " ")}</option>)}</select>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>{VARIABLES.map(v => <button key={v} onClick={() => insertVar(v)} style={{ padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 500, backgroundColor: "rgba(122,143,150,0.08)", border: "1px solid rgba(26,19,19,0.06)", color: ACC, cursor: "pointer" }}>{v}</button>)}</div>
          <div style={{ fontSize: 10, color: "rgba(26,19,19,0.35)", marginBottom: 6 }}>Click to insert at cursor</div>
          <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} placeholder="Hi {first_name}! We miss you at Salon Envy..." style={{ ...inp, minHeight: 140, resize: "vertical", fontSize: 14, lineHeight: 1.6 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 11, fontFamily: "monospace" }}><span style={{ color: segs >= 2 ? "#dc2626" : "rgba(26,19,19,0.4)" }}>{charCount} chars · {segs} segment{segs > 1 ? "s" : ""} · ${(segs * COST_PER_SEGMENT).toFixed(4)}/recipient</span></div>
          <div style={{ fontSize: 10, color: "rgba(26,19,19,0.35)", marginTop: 2 }}>Final &ldquo;Reply STOP to opt out.&rdquo; appended automatically — included in count</div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(26,19,19,0.06)" }}><button onClick={sendTest} disabled={!body || testLoading} style={{ ...btnGhost, opacity: !body || testLoading ? 0.5 : 1 }}>{testLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Smartphone size={14} />}Send Test to My Phone</button>{testStatus && <div style={{ marginTop: 6, fontSize: 11, color: testStatus.includes("sent") ? "#15803d" : "#dc2626" }}>{testStatus}</div>}</div>
        </div>

        {/* RIGHT: Preview */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Eye size={16} strokeWidth={1.5} color={ACC} /><span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Preview</span></div>
          <div style={{ backgroundColor: "#1A1313", borderRadius: 20, padding: "24px 10px 16px", marginBottom: 14 }}>
            <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Salon Envy</div>
            <div style={{ backgroundColor: "#e5e7eb", borderRadius: 14, padding: "8px 10px", marginLeft: 4, marginRight: 24, maxWidth: "85%" }}>
              <div style={{ fontSize: 12, color: "#1A1313", lineHeight: 1.5, wordBreak: "break-word" }}>{previewBody}{!body.toLowerCase().includes("reply stop") && <span style={{ color: "rgba(26,19,19,0.4)" }}> Reply STOP to opt out.</span>}</div>
            </div>
          </div>
          <div style={{ padding: 12, backgroundColor: "rgba(122,143,150,0.06)", borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Cost Estimate</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "rgba(26,19,19,0.55)" }}>
              <div>Recipients: <strong style={{ color: "#1A1313" }}>{recipientCount.toLocaleString()}</strong></div>
              <div>Segments: <strong style={{ color: "#1A1313" }}>{segs}</strong></div>
              <div>Per recipient: <strong style={{ color: "#1A1313" }}>${(segs * COST_PER_SEGMENT).toFixed(4)}</strong></div>
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(26,19,19,0.08)", fontSize: 18, fontWeight: 700, color: "#1A1313" }}>${estCost.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: "rgba(26,19,19,0.35)" }}>estimated total</div>
          </div>
        </div>
      </div>

      {error && <div style={{ marginTop: 16, padding: "8px 14px", backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 8, color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={12} />{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(26,19,19,0.06)" }}>
        <button onClick={() => router.push("/marketing")} style={btnGhost}>Cancel</button>
        <button onClick={saveDraft} disabled={saving || !body} style={{ ...btnGhost, opacity: saving || !body ? 0.5 : 1 }}>Save Draft</button>
        <button onClick={() => { if (!preview && audienceType !== "MANUAL") doPreview().then(() => setSendConfirm(true)); else setSendConfirm(true) }} disabled={!body || (audienceType === "MANUAL" && manualClients.length === 0)} style={{ ...btnPrimary, opacity: !body ? 0.5 : 1 }}><Send size={14} /> Send Now</button>
      </div>

      {sendConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSendConfirm(false)}>
          <div style={{ ...cardStyle, maxWidth: 480, width: "90%", padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1313", margin: "0 0 4px" }}>Confirm send</h2>
            <p style={{ fontSize: 12, color: "rgba(26,19,19,0.5)", margin: "0 0 16px" }}>Review before sending</p>
            <div style={{ padding: 12, backgroundColor: "rgba(122,143,150,0.06)", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1313", marginBottom: 4 }}>{recipientCount.toLocaleString()} recipients</div>
              {(preview?.sampleClients || manualClients).slice(0, 5).map((c, i) => <div key={i} style={{ fontSize: 11, color: "rgba(26,19,19,0.55)" }}>{c.firstName} {c.lastName?.[0]}. ({c.phone ? `***-***-${c.phone.slice(-4)}` : ""})</div>)}
              {recipientCount > 5 && <div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)", marginTop: 2 }}>+{recipientCount - 5} more</div>}
            </div>
            <div style={{ padding: 12, backgroundColor: "rgba(122,143,150,0.06)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>Estimated cost: <strong>${estCost.toFixed(2)}</strong><div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)", marginTop: 2 }}>{recipientCount.toLocaleString()} x {segs} segment{segs > 1 ? "s" : ""} x ${COST_PER_SEGMENT}</div></div>
            <div style={{ padding: 12, backgroundColor: "rgba(26,19,19,0.03)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "#1A1313", lineHeight: 1.5 }}>{previewBody}{!body.toLowerCase().includes("reply stop") && <span style={{ color: "rgba(26,19,19,0.4)" }}> Reply STOP to opt out.</span>}</div>
            {recipientCount > 100 && <div style={{ marginBottom: 16 }}><label style={lbl}>Type SEND to confirm</label><input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="SEND" style={inp} autoFocus /></div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setSendConfirm(false)} style={btnGhost}>Cancel</button>
              <button onClick={() => { setSendConfirm(false); sendNow() }} disabled={saving || (recipientCount > 100 && confirmText !== "SEND")} style={{ ...btnPrimary, opacity: saving || (recipientCount > 100 && confirmText !== "SEND") ? 0.5 : 1 }}><Send size={14} /> Confirm and Send</button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && preview && (<>
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 80 }} onClick={() => setPreviewOpen(false)} />
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 360, maxWidth: "90vw", backgroundColor: "#FBFBFB", zIndex: 90, boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", padding: 24, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><span style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>Audience Preview</span><button onClick={() => setPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(26,19,19,0.4)" }}><X size={18} /></button></div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#1A1313", marginBottom: 4 }}>{preview.count.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "rgba(26,19,19,0.4)", marginBottom: 16 }}>eligible recipients</div>
          <div style={{ fontSize: 13, color: "rgba(26,19,19,0.55)", marginBottom: 16 }}>Est. cost: <strong style={{ color: "#1A1313" }}>${(preview.count * segs * COST_PER_SEGMENT).toFixed(2)}</strong></div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Sample</div>
          {preview.sampleClients.map((c, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(26,19,19,0.04)" }}><div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: `${ACC}20`, color: ACC, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{((c.firstName?.[0] || "") + (c.lastName?.[0] || "")).toUpperCase()}</div><div><div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{c.firstName} {c.lastName}</div><div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)" }}>{c.phone}</div></div></div>)}
        </div>
      </>)}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
