"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save, Loader2, ChevronDown } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }
const inp: React.CSSProperties = { padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313", backgroundColor: "#fff", boxSizing: "border-box" as const, outline: "none" }

const VIP_TIER_OPTIONS = [
  { key: "AT_RISK", label: "At Risk", desc: "30-60 days since last visit" },
  { key: "LAPSED", label: "Lapsed", desc: "60-90 days since last visit" },
  { key: "DEAD", label: "Dead", desc: "90-180 days since last visit" },
  { key: "ACTIVE", label: "Active", desc: "Last 30 days" },
  { key: "VIP", label: "VIP", desc: "Top spenders + recent" },
  { key: "NEVER", label: "Never", desc: "No payment history" },
]

const VALUE_TIER_OPTIONS = [
  { key: "BIG_SPENDER", label: "Big Spender", desc: "Top 10% by lifetime spend" },
  { key: "VALUABLE", label: "Valuable", desc: "Top 25%" },
  { key: "AVERAGE", label: "Average", desc: "Middle" },
  { key: "LOW_VALUE", label: "Low Value", desc: "Bottom 25%" },
  { key: "NONE", label: "None", desc: "No spend recorded" },
]

// Generate 12h AM/PM time options in 30-minute increments
const TIME_OPTIONS: { label: string; hour: number; minute: number }[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const ampm = h < 12 ? "AM" : "PM"
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    TIME_OPTIONS.push({ label: `${h12}:${m.toString().padStart(2, "0")} ${ampm}`, hour: h, minute: m })
  }
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} style={{ width: 18, height: 18, borderRadius: 4, border: checked ? "none" : "1.5px solid #d1d5db", backgroundColor: checked ? ACC : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
      {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
  )
}

function smsPreview(offer: string) {
  const msg = `Sarah, it's been a while. Maria has openings next week. ${offer}. Book at salonenvyusa.com/book`
  const full = msg + " Reply STOP to opt out."
  const segments = full.length <= 160 ? 1 : Math.ceil(full.length / 153)
  return { text: full, chars: full.length, segments }
}

export default function ReynaConfigPage() {
  const [dailyDraftCap, setDailyDraftCap] = useState(30)
  const [sendTimeIdx, setSendTimeIdx] = useState(19) // 9:30 AM default
  const [antiSpamDays, setAntiSpamDays] = useState(30)
  const [targetTiers, setTargetTiers] = useState<string[]>(["AT_RISK", "LAPSED", "DEAD"])
  const [targetValueTiers, setTargetValueTiers] = useState<string[]>(["BIG_SPENDER", "VALUABLE", "AVERAGE"])
  const [offerBigSpender, setOfferBigSpender] = useState("20% off any service this week")
  const [offerValuable, setOfferValuable] = useState("15% off your next service")
  const [offerAverage, setOfferAverage] = useState("10% off your next visit")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tierCounts, setTierCounts] = useState<{ vip: Record<string, number>; value: Record<string, number> }>({ vip: {}, value: {} })
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/agents/reyna-recovery").then(r => r.json()),
      fetch("/api/agents/reyna-recovery/tier-counts").then(r => r.json()),
    ]).then(([agentData, counts]) => {
      if (agentData.agent?.config) {
        const c = agentData.agent.config as Record<string, unknown>
        if (c.dailyDraftCap) setDailyDraftCap(c.dailyDraftCap as number)
        if (c.proposedSendHour !== undefined && c.proposedSendMinute !== undefined) {
          const idx = TIME_OPTIONS.findIndex(t => t.hour === (c.proposedSendHour as number) && t.minute === (c.proposedSendMinute as number))
          if (idx >= 0) setSendTimeIdx(idx)
        }
        if (c.antiSpamDays) setAntiSpamDays(c.antiSpamDays as number)
        if (c.targetTiers) setTargetTiers(c.targetTiers as string[])
        if (c.targetValueTiers) setTargetValueTiers(c.targetValueTiers as string[])
        const offers = c.offerByValueTier as Record<string, string> | undefined
        if (offers?.BIG_SPENDER) setOfferBigSpender(offers.BIG_SPENDER)
        if (offers?.VALUABLE) setOfferValuable(offers.VALUABLE)
        if (offers?.AVERAGE) setOfferAverage(offers.AVERAGE)
      }
      setTierCounts(counts)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true); setSaved(false)
    const time = TIME_OPTIONS[sendTimeIdx]
    await fetch("/api/agents/reyna-recovery/config", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyDraftCap, proposedSendHour: time.hour, proposedSendMinute: time.minute, antiSpamDays,
        targetTiers, targetValueTiers,
        offerByValueTier: { BIG_SPENDER: offerBigSpender, VALUABLE: offerValuable, AVERAGE: offerAverage },
      }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggleTier(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter(t => t !== val) : [...arr, val])
  }

  // Estimate total targeted
  const targetedVipCount = targetTiers.reduce((s, t) => s + (tierCounts.vip[t] || 0), 0)
  const comboCount = targetTiers.length * targetValueTiers.length

  if (loading) return <div style={{ padding: "48px 32px", color: "#9ca3af" }}>Loading...</div>

  return (
    <div style={{ padding: "48px 32px 80px 32px", maxWidth: 720, margin: "0 auto" }}>
      {/* Sticky save bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#F4F5F7", paddingBottom: 16, paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/agents/reyna-recovery" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
            <ArrowLeft size={14} /> Back to Reyna Recovery
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saved && <span style={{ fontSize: 13, color: "#059669", fontWeight: 500 }}>Saved</span>}
            <button onClick={save} disabled={saving} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: ACC, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.5 : 1 }}>
              {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={16} />} Save Changes
            </button>
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px", letterSpacing: "-0.31px" }}>Reyna Recovery Settings</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 28px" }}>Configure how the agent identifies and contacts lapsed clients.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Section 1: Daily Activity */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 4px" }}>Daily Activity</h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>Control how many drafts the agent creates each day and when messages are scheduled to send.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", display: "block", marginBottom: 6 }}>Maximum drafts per day</label>
              <input type="number" value={dailyDraftCap} onChange={e => setDailyDraftCap(Number(e.target.value))} style={{ ...inp, width: 80 }} min={1} max={100} />
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "6px 0 0" }}>Recommended 20-50. Higher numbers risk Twilio reputation.</p>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", display: "block", marginBottom: 6 }}>Scheduled send time</label>
              <select value={sendTimeIdx} onChange={e => setSendTimeIdx(Number(e.target.value))} style={{ ...inp, width: 160, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }}>
                {TIME_OPTIONS.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
              </select>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "6px 0 0" }}>Messages will be sent at this time the day after approval.</p>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", display: "block", marginBottom: 6 }}>Skip clients contacted in last</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={antiSpamDays} onChange={e => setAntiSpamDays(Number(e.target.value))} style={{ ...inp, width: 80 }} min={7} max={90} />
                <span style={{ fontSize: 14, color: "#525866" }}>days</span>
              </div>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "6px 0 0" }}>Prevents over-messaging. Clients who got an agent SMS within this window are excluded from new drafts.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Who to Target */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 4px" }}>Who to Target</h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>Combine recency (how long since visit) with value (how much they spent) to focus on the highest-impact recovery opportunities.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", margin: "0 0 12px" }}>Visit Recency</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {VIP_TIER_OPTIONS.map(t => (
                  <label key={t.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <Checkbox checked={targetTiers.includes(t.key)} onChange={() => toggleTier(targetTiers, t.key, setTargetTiers)} />
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1313" }}>{t.label}</span>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}> ({t.desc})</span>
                      {tierCounts.vip[t.key] !== undefined && <span style={{ fontSize: 12, color: "#9ca3af" }}> -- {tierCounts.vip[t.key].toLocaleString()} clients</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", margin: "0 0 12px" }}>Spending Value</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {VALUE_TIER_OPTIONS.map(t => (
                  <label key={t.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <Checkbox checked={targetValueTiers.includes(t.key)} onChange={() => toggleTier(targetValueTiers, t.key, setTargetValueTiers)} />
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1313" }}>{t.label}</span>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}> ({t.desc})</span>
                      {tierCounts.value[t.key] !== undefined && <span style={{ fontSize: 12, color: "#9ca3af" }}> -- {tierCounts.value[t.key].toLocaleString()} clients</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: "#9ca3af", margin: "20px 0 0", borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
            Currently targeting ~{targetedVipCount.toLocaleString()} clients across {comboCount} tier combinations.
          </p>
        </div>

        {/* Section 3: Offers by Spending Tier */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 4px" }}>Offers by Spending Tier</h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>Different offers for different value tiers. Big spenders get bigger discounts because they bring more revenue back.</p>

          {[
            { label: "Big Spender", value: offerBigSpender, setter: setOfferBigSpender },
            { label: "Valuable", value: offerValuable, setter: setOfferValuable },
            { label: "Average", value: offerAverage, setter: setOfferAverage },
          ].map(row => {
            const preview = smsPreview(row.value)
            return (
              <div key={row.label} style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", display: "block", marginBottom: 6 }}>{row.label}</label>
                <input value={row.value} onChange={e => row.setter(e.target.value)} style={{ ...inp, width: "100%", marginBottom: 8 }} />
                <div style={{ backgroundColor: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>SMS Preview</div>
                  <p style={{ fontSize: 13, color: "#525866", lineHeight: 1.5, margin: "0 0 6px" }}>{preview.text}</p>
                  <div style={{ fontSize: 12, color: preview.chars > 160 ? "#dc2626" : "#9ca3af" }}>
                    {preview.chars} characters, {preview.segments} SMS segment{preview.segments > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Advanced Settings — collapsed */}
        <div style={{ ...cardStyle, padding: 0 }}>
          <button onClick={() => setAdvancedOpen(!advancedOpen)} style={{ width: "100%", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "#525866", fontSize: 14, fontWeight: 500 }}>
            Advanced Settings
            <ChevronDown size={16} style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          {advancedOpen && (
            <div style={{ padding: "0 24px 24px", borderTop: "1px solid #f3f4f6" }}>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "16px 0" }}>These settings are for advanced use only. Most users do not need to change them.</p>
              <div style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8 }}>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Custom anti-spam windows, priority weight overrides, AI system prompt customization, and manual phone blocklists will be available in a future update.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
