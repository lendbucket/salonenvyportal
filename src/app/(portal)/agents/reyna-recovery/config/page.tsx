"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save, Loader2 } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "20px", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04)" }
const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid rgba(26,19,19,0.1)", borderRadius: 8, fontSize: 13, color: "#1A1313", backgroundColor: "#FBFBFB", boxSizing: "border-box" }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" }

const VIP_TIERS = ["AT_RISK", "LAPSED", "DEAD"]
const VALUE_TIERS = ["BIG_SPENDER", "VALUABLE", "AVERAGE"]

export default function ReynaConfigPage() {
  const [dailyDraftCap, setDailyDraftCap] = useState(30)
  const [proposedSendHour, setProposedSendHour] = useState(9)
  const [proposedSendMinute, setProposedSendMinute] = useState(30)
  const [antiSpamDays, setAntiSpamDays] = useState(30)
  const [targetTiers, setTargetTiers] = useState<string[]>(VIP_TIERS)
  const [targetValueTiers, setTargetValueTiers] = useState<string[]>(VALUE_TIERS)
  const [offerBigSpender, setOfferBigSpender] = useState("20% off any service this week")
  const [offerValuable, setOfferValuable] = useState("15% off your next service")
  const [offerAverage, setOfferAverage] = useState("10% off your next visit")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/agents/reyna-recovery").then(r => r.json()).then(d => {
      if (d.agent?.config) {
        const c = d.agent.config as Record<string, unknown>
        if (c.dailyDraftCap) setDailyDraftCap(c.dailyDraftCap as number)
        if (c.proposedSendHour) setProposedSendHour(c.proposedSendHour as number)
        if (c.proposedSendMinute) setProposedSendMinute(c.proposedSendMinute as number)
        if (c.antiSpamDays) setAntiSpamDays(c.antiSpamDays as number)
        if (c.targetTiers) setTargetTiers(c.targetTiers as string[])
        if (c.targetValueTiers) setTargetValueTiers(c.targetValueTiers as string[])
        const offers = c.offerByValueTier as Record<string, string> | undefined
        if (offers?.BIG_SPENDER) setOfferBigSpender(offers.BIG_SPENDER)
        if (offers?.VALUABLE) setOfferValuable(offers.VALUABLE)
        if (offers?.AVERAGE) setOfferAverage(offers.AVERAGE)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true); setSaved(false)
    await fetch("/api/agents/reyna-recovery/config", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyDraftCap, proposedSendHour, proposedSendMinute, antiSpamDays,
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

  if (loading) return <div style={{ padding: "48px 32px", color: "rgba(26,19,19,0.3)" }}>Loading...</div>

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 720, margin: "0 auto" }}>
      <Link href="/agents/reyna-recovery" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1313", margin: "0 0 24px" }}>Reyna Recovery Configuration</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: "0 0 14px" }}>Limits</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div><label style={lbl}>Daily draft cap</label><input type="number" value={dailyDraftCap} onChange={e => setDailyDraftCap(Number(e.target.value))} style={inp} /></div>
            <div><label style={lbl}>Send hour (24h)</label><input type="number" value={proposedSendHour} onChange={e => setProposedSendHour(Number(e.target.value))} min={0} max={23} style={inp} /></div>
            <div><label style={lbl}>Send minute</label><input type="number" value={proposedSendMinute} onChange={e => setProposedSendMinute(Number(e.target.value))} min={0} max={59} style={inp} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={lbl}>Anti-spam exclusion (days)</label><input type="number" value={antiSpamDays} onChange={e => setAntiSpamDays(Number(e.target.value))} style={{ ...inp, maxWidth: 120 }} /></div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: "0 0 14px" }}>Targeting</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={lbl}>VIP tiers to target</label>
              {VIP_TIERS.map(t => <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1A1313", marginBottom: 4, cursor: "pointer" }}><input type="checkbox" checked={targetTiers.includes(t)} onChange={() => toggleTier(targetTiers, t, setTargetTiers)} />{t}</label>)}
            </div>
            <div>
              <label style={lbl}>Value tiers to target</label>
              {VALUE_TIERS.map(t => <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1A1313", marginBottom: 4, cursor: "pointer" }}><input type="checkbox" checked={targetValueTiers.includes(t)} onChange={() => toggleTier(targetValueTiers, t, setTargetValueTiers)} />{t}</label>)}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", margin: "0 0 14px" }}>Offers by Value Tier</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><label style={lbl}>Big Spender offer</label><input value={offerBigSpender} onChange={e => setOfferBigSpender(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Valuable offer</label><input value={offerValuable} onChange={e => setOfferValuable(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Average offer</label><input value={offerAverage} onChange={e => setOfferAverage(e.target.value)} style={inp} /></div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {saved && <span style={{ fontSize: 12, color: "#15803d", alignSelf: "center" }}>Saved</span>}
          <button onClick={save} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", backgroundColor: "#1A1313", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />} Save Configuration
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
