"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Send, Users, Mail, Eye, Loader2, AlertTriangle, X, MapPin, Calendar, TrendingUp, DollarSign, Cake, UserPlus, CreditCard, Receipt, Clock } from "lucide-react"
import ClientSearchPicker from "@/components/marketing/ClientSearchPicker"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#1A1313", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "transparent", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "rgba(26,19,19,0.6)", cursor: "pointer" }
const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 13, color: "#1A1313", backgroundColor: "#FBFBFB", boxSizing: "border-box", outline: "none" }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" }

const TEMPLATES = [
  { key: "promo", label: "Promo", desc: "Flash sale, discount, special offer" },
  { key: "newsletter", label: "Newsletter", desc: "Monthly updates, news, tips" },
  { key: "birthday", label: "Birthday", desc: "Personalized birthday offer" },
  { key: "retention", label: "Retention", desc: "We miss you comeback offer" },
  { key: "lastchance", label: "Last Chance", desc: "Urgent final reminder" },
  { key: "welcome", label: "Welcome", desc: "New client welcome message" },
]

const FROM_OPTIONS = [
  { email: "news@marketing.salonenvyusa.com", label: "Newsletter (news@)" },
  { email: "marketing@marketing.salonenvyusa.com", label: "Marketing (marketing@)" },
]

interface PickedClient { id: string; firstName: string | null; lastName: string | null; phone: string | null; email: string | null }
interface PreviewData { count: number; sampleClients: PickedClient[] }

const AUDIENCE_TYPES = [
  { value: "ALL_CLIENTS", label: "All clients with email", desc: "Everyone with an email address", icon: <Users size={16} strokeWidth={1.5} /> },
  { value: "BY_LOCATION", label: "By location", desc: "Corpus Christi, San Antonio, or both", icon: <MapPin size={16} strokeWidth={1.5} /> },
  { value: "BY_LAST_VISIT", label: "By last visit", desc: "Haven't visited in N days", icon: <Calendar size={16} strokeWidth={1.5} /> },
  { value: "BY_VISIT_COUNT", label: "By visit count", desc: "Clients with X-Y total visits", icon: <TrendingUp size={16} strokeWidth={1.5} /> },
  { value: "BY_TOTAL_SPEND", label: "By total spend", desc: "Clients who spent $X-$Y lifetime", icon: <DollarSign size={16} strokeWidth={1.5} /> },
  { value: "BY_BIRTHDAY_MONTH", label: "Birthday this month", desc: "Celebrate your clients", icon: <Cake size={16} strokeWidth={1.5} /> },
  { value: "BY_PAYMENT_METHOD", label: "By payment method", desc: "Card only, cash only, or mixed", icon: <CreditCard size={16} strokeWidth={1.5} /> },
  { value: "BY_AVG_TICKET", label: "By average ticket", desc: "Clients with $X-$Y avg spend", icon: <Receipt size={16} strokeWidth={1.5} /> },
  { value: "MANUAL", label: "Manual selection", desc: "Pick clients individually", icon: <UserPlus size={16} strokeWidth={1.5} /> },
]

export default function NewEmailCampaignPage() {
  const router = useRouter()
  // Audience state
  const [audienceType, setAudienceType] = useState("ALL_CLIENTS")
  const [locationIds, setLocationIds] = useState<string[]>(["CC", "SA"])
  const [daysParam, setDaysParam] = useState(60)
  const [daysOp, setDaysOp] = useState<"GT" | "LT">("GT")
  const [minVisits, setMinVisits] = useState<number | undefined>(undefined)
  const [maxVisits, setMaxVisits] = useState<number | undefined>(undefined)
  const [minSpend, setMinSpend] = useState<number | undefined>(undefined)
  const [maxSpend, setMaxSpend] = useState<number | undefined>(undefined)
  const [birthdayMonth, setBirthdayMonth] = useState(new Date().getMonth() + 1)
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["CARD_ONLY", "CASH_ONLY", "MIXED"])
  const [minAvgTicket, setMinAvgTicket] = useState<number | undefined>(undefined)
  const [maxAvgTicket, setMaxAvgTicket] = useState<number | undefined>(undefined)
  const [manualClients, setManualClients] = useState<PickedClient[]>([])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Template + compose state
  const [templateKey, setTemplateKey] = useState("promo")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [fromEmail, setFromEmail] = useState(FROM_OPTIONS[0].email)
  const [fromName, setFromName] = useState("Salon Envy")
  const [replyTo, setReplyTo] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [ctaText, setCtaText] = useState("Book Now")
  const [ctaUrl, setCtaUrl] = useState("https://salonenvyusa.com/book")
  const [offerCode, setOfferCode] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [scheduledFor, setScheduledFor] = useState("")

  // UI state
  const [saving, setSaving] = useState(false)
  const [sendConfirm, setSendConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [error, setError] = useState("")
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function buildFilter() {
    switch (audienceType) {
      case "BY_LOCATION": return { type: "BY_LOCATION", locationIds }
      case "BY_LAST_VISIT": return { type: "BY_LAST_VISIT", daysSinceLastVisit: daysParam, operator: daysOp }
      case "BY_VISIT_COUNT": return { type: "BY_VISIT_COUNT", minVisits, maxVisits }
      case "BY_TOTAL_SPEND": return { type: "BY_TOTAL_SPEND", minSpend, maxSpend }
      case "BY_BIRTHDAY_MONTH": return { type: "BY_BIRTHDAY_MONTH", month: birthdayMonth }
      case "BY_PAYMENT_METHOD": return { type: "BY_PAYMENT_METHOD", methods: paymentMethods }
      case "BY_AVG_TICKET": return { type: "BY_AVG_TICKET", minAvg: minAvgTicket, maxAvg: maxAvgTicket }
      case "MANUAL": return { type: "MANUAL", clientIds: manualClients.map(c => c.id) }
      default: return { type: "ALL_CLIENTS" }
    }
  }

  const doPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const r = await fetch("/api/marketing/audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audienceFilter: buildFilter(), channel: "EMAIL", body: "" }) })
      const d = await r.json()
      setPreview(d)
      setPreviewOpen(true)
    } catch { setError("Preview failed") }
    setPreviewLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceType, locationIds, daysParam, daysOp, minVisits, maxVisits, minSpend, maxSpend, birthdayMonth, paymentMethods, minAvgTicket, maxAvgTicket, manualClients])

  // Live preview rendering via a temporary campaign preview endpoint
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!bodyText && !subject) return
      try {
        const r = await fetch("/api/marketing/email/live-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateKey, firstName: "Sarah", bodyText, imageUrl, ctaText, ctaUrl, offerCode, expiresAt, logoUrl, preheader }) })
        if (r.ok) {
          const html = await r.text()
          setPreviewHtml(html)
        }
      } catch {
        // Preview is best-effort
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [templateKey, bodyText, imageUrl, ctaText, ctaUrl, offerCode, expiresAt, logoUrl, preheader, subject])

  async function saveDraft() {
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/marketing/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: subject || "Untitled", subject, preheader, fromName, fromEmail, replyTo: replyTo || undefined, templateKey, templateData: { bodyText, imageUrl, ctaText, ctaUrl, offerCode, expiresAt, logoUrl }, audienceFilter: buildFilter(), scheduledFor: scheduledFor || undefined }) })
      if (r.ok) router.push("/marketing/email")
      else { const d = await r.json(); setError(d.error || "Save failed") }
    } catch { setError("Save failed") }
    setSaving(false)
  }

  async function sendNow() {
    setSaving(true); setError("")
    try {
      const cr = await fetch("/api/marketing/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: subject || "Untitled", subject, preheader, fromName, fromEmail, replyTo: replyTo || undefined, templateKey, templateData: { bodyText, imageUrl, ctaText, ctaUrl, offerCode, expiresAt, logoUrl }, audienceFilter: buildFilter() }) })
      const cd = await cr.json()
      const id = cd.campaign?.id
      if (!id) { setError("Failed to create campaign"); setSaving(false); return }
      await fetch(`/api/marketing/email/${id}/send`, { method: "POST" })
      router.push(`/marketing/email/${id}`)
    } catch { setError("Send failed") }
    setSaving(false)
  }

  async function sendTest() {
    if (!subject) { setTestStatus("Subject line required"); return }
    setTestLoading(true); setTestStatus(null)
    try {
      // Create a temp draft, send test, then we can check detail
      const cr = await fetch("/api/marketing/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `[TEST] ${subject}`, subject, preheader, fromName, fromEmail, replyTo: replyTo || undefined, templateKey, templateData: { bodyText, imageUrl, ctaText, ctaUrl, offerCode, expiresAt, logoUrl }, audienceFilter: { type: "ALL_CLIENTS" } }) })
      const cd = await cr.json()
      const id = cd.campaign?.id
      if (!id) { setTestStatus("Failed"); setTestLoading(false); return }
      const r = await fetch(`/api/marketing/email/${id}/test`, { method: "POST" })
      const d = await r.json()
      if (r.ok) setTestStatus(`Test sent to ${d.sentTo}. Check your inbox.`)
      else setTestStatus(d.error || "Test failed")
    } catch { setTestStatus("Network error") }
    setTestLoading(false)
  }

  useEffect(() => { setPreview(null) }, [audienceType])

  const recipientCount = audienceType === "MANUAL" ? manualClients.length : (preview?.count ?? 0)

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: "1700px", margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px", letterSpacing: "-0.31px" }}>New Email Campaign</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 20, alignItems: "start" }}>
        {/* LEFT: Audience */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Users size={16} strokeWidth={1.5} color={ACC} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Audience</span>
          </div>
          <p style={{ fontSize: 11, color: "rgba(26,19,19,0.4)", margin: "0 0 14px" }}>Choose who receives this email</p>
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
                  {selected && t.value === "BY_PAYMENT_METHOD" && <div style={{ padding: "8px 12px 8px 44px" }}>{["CARD_ONLY", "CASH_ONLY", "MIXED"].map(m => <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1A1313", marginBottom: 4, cursor: "pointer" }}><input type="checkbox" checked={paymentMethods.includes(m)} onChange={e => setPaymentMethods(e.target.checked ? [...paymentMethods, m] : paymentMethods.filter(x => x !== m))} />{m === "CARD_ONLY" ? "Card only" : m === "CASH_ONLY" ? "Cash only" : "Mixed (card + cash)"}</label>)}</div>}
                  {selected && t.value === "BY_AVG_TICKET" && <div style={{ padding: "8px 12px 8px 44px", display: "flex", gap: 6 }}><div><label style={{ ...lbl, marginBottom: 2 }}>Min $</label><input type="number" value={minAvgTicket ?? ""} onChange={e => setMinAvgTicket(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, padding: "6px 8px" }} /></div><div><label style={{ ...lbl, marginBottom: 2 }}>Max $</label><input type="number" value={maxAvgTicket ?? ""} onChange={e => setMaxAvgTicket(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, padding: "6px 8px" }} /></div></div>}
                  {selected && t.value === "MANUAL" && <div style={{ padding: "8px 12px 8px 44px" }}><ClientSearchPicker selectedClients={manualClients} onChange={setManualClients} /></div>}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 14 }}><button onClick={doPreview} disabled={previewLoading} style={btnGhost}>{previewLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Eye size={14} />}Preview Audience</button></div>
        </div>

        {/* CENTER: Compose */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Template picker */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Mail size={16} strokeWidth={1.5} color={ACC} /><span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Template</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {TEMPLATES.map(t => (
                <div key={t.key} onClick={() => setTemplateKey(t.key)} style={{ padding: "10px 8px", borderRadius: 8, border: `1px solid ${templateKey === t.key ? ACC : "rgba(26,19,19,0.06)"}`, backgroundColor: templateKey === t.key ? `${ACC}08` : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: templateKey === t.key ? ACC : "#1A1313" }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(26,19,19,0.4)", marginTop: 2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Email details */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Mail size={16} strokeWidth={1.5} color={ACC} /><span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Compose</span></div>

            <label style={lbl}>Subject line</label>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your subject line..." style={inp} maxLength={150} />
              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: subject.length > 60 ? "#dc2626" : "rgba(26,19,19,0.3)" }}>{subject.length}/60</span>
            </div>

            <label style={lbl}>Preheader (preview text)</label>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input value={preheader} onChange={e => setPreheader(e.target.value)} placeholder="Brief preview text shown in inbox..." style={inp} maxLength={150} />
              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: preheader.length > 110 ? "#dc2626" : preheader.length >= 80 ? "#15803d" : "rgba(26,19,19,0.3)" }}>{preheader.length}/110</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>From name</label>
                <input value={fromName} onChange={e => setFromName(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>From email</label>
                <select value={fromEmail} onChange={e => setFromEmail(e.target.value)} style={inp}>
                  {FROM_OPTIONS.map(o => <option key={o.email} value={o.email}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <label style={lbl}>Reply-to (optional)</label>
            <input value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="reply@salonenvyusa.com" style={{ ...inp, marginBottom: 16 }} />

            <hr style={{ border: "none", borderTop: "1px solid rgba(26,19,19,0.06)", margin: "0 0 16px" }} />

            <label style={lbl}>Body text</label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder="Write your email content..." style={{ ...inp, minHeight: 100, resize: "vertical", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>CTA button text</label>
                <input value={ctaText} onChange={e => setCtaText(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>CTA button URL</label>
                <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Offer code (optional)</label>
                <input value={offerCode} onChange={e => setOfferCode(e.target.value)} placeholder="SPRING20" style={inp} />
              </div>
              <div>
                <label style={lbl}>Expires (optional)</label>
                <input value={expiresAt} onChange={e => setExpiresAt(e.target.value)} placeholder="May 31, 2026" style={inp} />
              </div>
            </div>

            <label style={lbl}>Image URL (optional)</label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." style={{ ...inp, marginBottom: 12 }} />

            <label style={lbl}>Logo URL (optional, defaults to Salon Envy logo)</label>
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://salonenvyusa.com/images/logo-white.png" style={{ ...inp, marginBottom: 12 }} />

            <hr style={{ border: "none", borderTop: "1px solid rgba(26,19,19,0.06)", margin: "0 0 16px" }} />

            <label style={lbl}>Schedule for (optional)</label>
            <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} style={{ ...inp, marginBottom: 12 }} />

            <div style={{ paddingTop: 12, borderTop: "1px solid rgba(26,19,19,0.06)" }}>
              <button onClick={sendTest} disabled={!subject || testLoading} style={{ ...btnGhost, opacity: !subject || testLoading ? 0.5 : 1 }}>
                {testLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Mail size={14} />}Send Test to Me
              </button>
              {testStatus && <div style={{ marginTop: 6, fontSize: 11, color: testStatus.includes("sent") ? "#15803d" : "#dc2626" }}>{testStatus}</div>}
            </div>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Eye size={16} strokeWidth={1.5} color={ACC} /><span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>Preview</span></div>
          <div style={{ backgroundColor: "#f4f4f4", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
            {previewHtml ? (
              <iframe ref={iframeRef} srcDoc={previewHtml} style={{ width: "100%", height: 400, border: "none" }} title="Email preview" />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "rgba(26,19,19,0.3)", fontSize: 12 }}>
                Fill in template fields to see a live preview
              </div>
            )}
          </div>
          <div style={{ padding: 12, backgroundColor: "rgba(122,143,150,0.06)", borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Campaign Summary</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "rgba(26,19,19,0.55)" }}>
              <div>Recipients: <strong style={{ color: "#1A1313" }}>{recipientCount.toLocaleString()}</strong></div>
              <div>Template: <strong style={{ color: "#1A1313" }}>{templateKey}</strong></div>
              <div>From: <strong style={{ color: "#1A1313" }}>{fromName} &lt;{fromEmail}&gt;</strong></div>
              {scheduledFor && <div>Scheduled: <strong style={{ color: "#1A1313" }}>{new Date(scheduledFor).toLocaleString()}</strong></div>}
            </div>
          </div>
        </div>
      </div>

      {error && <div style={{ marginTop: 16, padding: "8px 14px", backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 8, color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={12} />{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(26,19,19,0.06)" }}>
        <button onClick={() => router.push("/marketing/email")} style={btnGhost}>Cancel</button>
        <button onClick={saveDraft} disabled={saving || !subject} style={{ ...btnGhost, opacity: saving || !subject ? 0.5 : 1 }}>Save Draft</button>
        {scheduledFor ? (
          <button onClick={() => { if (!preview && audienceType !== "MANUAL") doPreview().then(() => setSendConfirm(true)); else setSendConfirm(true) }} disabled={!subject} style={{ ...btnPrimary, backgroundColor: "#1d4ed8", opacity: !subject ? 0.5 : 1 }}>
            <Clock size={14} /> Schedule
          </button>
        ) : (
          <button onClick={() => { if (!preview && audienceType !== "MANUAL") doPreview().then(() => setSendConfirm(true)); else setSendConfirm(true) }} disabled={!subject || (audienceType === "MANUAL" && manualClients.length === 0)} style={{ ...btnPrimary, opacity: !subject ? 0.5 : 1 }}>
            <Send size={14} /> Send Now
          </button>
        )}
      </div>

      {/* Confirm modal */}
      {sendConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSendConfirm(false)}>
          <div style={{ ...cardStyle, maxWidth: 480, width: "90%", padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1313", margin: "0 0 4px" }}>{scheduledFor ? "Confirm schedule" : "Confirm send"}</h2>
            <p style={{ fontSize: 12, color: "rgba(26,19,19,0.5)", margin: "0 0 16px" }}>Review before {scheduledFor ? "scheduling" : "sending"}</p>
            <div style={{ padding: 12, backgroundColor: "rgba(122,143,150,0.06)", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1313", marginBottom: 4 }}>{recipientCount.toLocaleString()} recipients</div>
              {(preview?.sampleClients || manualClients).slice(0, 5).map((c, i) => <div key={i} style={{ fontSize: 11, color: "rgba(26,19,19,0.55)" }}>{c.firstName} {c.lastName?.[0]}. ({c.email || "no email"})</div>)}
              {recipientCount > 5 && <div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)", marginTop: 2 }}>+{recipientCount - 5} more</div>}
            </div>
            <div style={{ padding: 12, backgroundColor: "rgba(26,19,19,0.03)", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>{subject}</div>
              <div style={{ fontSize: 11, color: "rgba(26,19,19,0.5)" }}>From: {fromName} &lt;{fromEmail}&gt;</div>
              <div style={{ fontSize: 11, color: "rgba(26,19,19,0.5)" }}>Template: {templateKey}</div>
              {scheduledFor && <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 4 }}>Scheduled for: {new Date(scheduledFor).toLocaleString()}</div>}
            </div>
            {recipientCount > 1000 && (
              <div style={{ padding: 10, backgroundColor: "rgba(234,179,8,0.08)", borderRadius: 8, marginBottom: 12, fontSize: 11, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={14} /> Large audience. Consider warming your domain first if this is a new sending domain.
              </div>
            )}
            {recipientCount > 100 && <div style={{ marginBottom: 16 }}><label style={lbl}>Type SEND to confirm</label><input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="SEND" style={inp} autoFocus /></div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setSendConfirm(false)} style={btnGhost}>Cancel</button>
              <button onClick={() => { setSendConfirm(false); sendNow() }} disabled={saving || (recipientCount > 100 && confirmText !== "SEND")} style={{ ...btnPrimary, opacity: saving || (recipientCount > 100 && confirmText !== "SEND") ? 0.5 : 1 }}><Send size={14} /> {scheduledFor ? "Confirm Schedule" : "Confirm and Send"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Audience slide-out */}
      {previewOpen && preview && (<>
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 80 }} onClick={() => setPreviewOpen(false)} />
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 360, maxWidth: "90vw", backgroundColor: "#FBFBFB", zIndex: 90, boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", padding: 24, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><span style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>Email Audience Preview</span><button onClick={() => setPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(26,19,19,0.4)" }}><X size={18} /></button></div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#1A1313", marginBottom: 4 }}>{preview.count.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "rgba(26,19,19,0.4)", marginBottom: 16 }}>eligible email recipients</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Sample</div>
          {preview.sampleClients.map((c, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(26,19,19,0.04)" }}><div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: `${ACC}20`, color: ACC, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{((c.firstName?.[0] || "") + (c.lastName?.[0] || "")).toUpperCase()}</div><div><div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}>{c.firstName} {c.lastName}</div><div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)" }}>{c.email}</div></div></div>)}
        </div>
      </>)}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
