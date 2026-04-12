"use client"
import { useState, useEffect, useCallback } from "react"
import { useUserRole } from "@/hooks/useUserRole"
import { getCurrentPayPeriod, getPreviousPayPeriod, formatPeriodLabel, getPayDay, TEAM_MEMBERS } from "@/lib/payrollUtils"

const ACC = "#606E74", ACC_B = "#7a8f96", ACC_DIM = "rgba(96,110,116,0.08)", ACC_BDR = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.06)", BORDER2 = "rgba(255,255,255,0.08)", S1 = "rgba(255,255,255,0.03)", S2 = "rgba(255,255,255,0.05)"
const CARD_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.02), inset 1px 0 0 rgba(255,255,255,0.01), 0 0 0 1px rgba(0,0,0,0.25)"
const MUTED = "rgba(255,255,255,0.3)", MID = "rgba(255,255,255,0.6)", GREEN = "#10B981", AMBER = "#ffb347", BLUE = "#4da6ff", RED = "#ff6b6b"
const mono: React.CSSProperties = { fontFamily: "'Fira Code', monospace" }
const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PData = any
type Toast = { msg: string; type: "success" | "error" } | null

export default function PayrollPage() {
  const { isOwner, isStylist } = useUserRole()
  const [loc, setLoc] = useState<"CC" | "SA">("CC")
  const [offset, setOffset] = useState(0)
  const [period, setPeriod] = useState<{ start: Date; end: Date } | null>(null)
  const [data, setData] = useState<PData>(null)
  const [loading, setLoading] = useState(false)
  const [calcing, setCalcing] = useState(false)
  const [marking, setMarking] = useState(false)
  const [history, setHistory] = useState<PData[]>([])
  const [showHist, setShowHist] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  const showT = (msg: string, type: "success" | "error" = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    try { setPeriod(offset === 0 ? getCurrentPayPeriod() : getPreviousPayPeriod(offset)) } catch (e: unknown) { setError(e instanceof Error ? e.message : "Period calc error") }
  }, [offset])

  const loadPayroll = useCallback(async () => {
    if (!period) return; setLoading(true); setError(null); setData(null)
    try {
      const r = await fetch(`/api/payroll/periods?locationId=${loc}`); if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json(); const match = (d.periods || []).find((p: PData) => Math.abs(new Date(p.periodStart).getTime() - period.start.getTime()) < 300000)
      setData(match || null)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Load failed") }
    setLoading(false)
  }, [period, loc])

  const loadHistory = useCallback(async () => {
    try { const r = await fetch(`/api/payroll/periods?locationId=${loc}`); if (r.ok) { const d = await r.json(); setHistory(d.periods || []) } } catch { /**/ }
  }, [loc])

  useEffect(() => { loadPayroll() }, [loadPayroll])
  useEffect(() => { loadHistory() }, [loadHistory])

  async function calculate() {
    if (!period) return; setCalcing(true); setError(null)
    try {
      const r = await fetch("/api/payroll/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: loc, start: period.start.toISOString(), end: period.end.toISOString() }) })
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || "Failed")
      setData(d.period); loadHistory(); showT("Payroll calculated")
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : "Failed"; setError(msg); showT(msg, "error") }
    setCalcing(false)
  }

  async function markPaid() {
    if (!data) return; setMarking(true)
    try {
      const r = await fetch(`/api/payroll/periods/${data.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed"); setData(d.period); loadHistory(); showT("Marked as paid")
    } catch (e: unknown) { showT(e instanceof Error ? e.message : "Failed", "error") }
    setMarking(false)
  }

  function loadHistPeriod(p: PData) {
    setData(p); const ps = new Date(p.periodStart); const c = getCurrentPayPeriod()
    setOffset(Math.round((c.start.getTime() - ps.getTime()) / (7 * 86400000))); setShowHist(false)
  }

  const label = period ? formatPeriodLabel(period.start, period.end) : "Loading..."
  const payDay = period ? getPayDay(period.end) : ""
  const isPaid = data?.status === "paid"
  const totalPayout = data ? (data.totalCommission + data.totalTips) : 0
  const entries: PData[] = data?.entries || []

  function printReport() {
    if (!data || !period) return
    const location = loc === "CC" ? "Salon Envy Corpus Christi" : "Salon Envy San Antonio"
    const pLabel = formatPeriodLabel(period.start, period.end)
    const pDay = getPayDay(period.end)
    const tp = (data.totalCommission + data.totalTips).toFixed(2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data.entries || []).map((e: any) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:13px">${e.teamMemberName}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center">${e.serviceCount}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right">$${e.serviceSubtotal.toFixed(2)}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;color:#10B981;font-weight:600">$${e.commission.toFixed(2)}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;color:#f59e0b">$${e.tips.toFixed(2)}</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;font-weight:700">$${e.totalPayout.toFixed(2)}</td></tr>`).join("")
    const w = window.open("", "_blank"); if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Payroll — ${location}</title><style>body{font-family:-apple-system,sans-serif;color:#111;padding:40px}.hdr{display:flex;justify-content:space-between;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #111}.sum{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}.cd{background:#f9fafb;padding:12px 14px;border-radius:8px;border-left:3px solid #374151}.cd.g{border-color:#10B981}.cd.a{border-color:#f59e0b}.cd .v{font-size:18px;font-weight:700;font-family:monospace}.cd .l{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#666;margin-top:2px}table{width:100%;border-collapse:collapse}thead tr{background:#f3f4f6}th{padding:8px 14px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#666;text-align:left}th:not(:first-child){text-align:right}.tot td{font-weight:700;background:#f9fafb;border-top:2px solid #111;padding:10px 14px}.ft{margin-top:32px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#999;display:flex;justify-content:space-between}</style></head><body><div class="hdr"><div><div style="font-size:20px;font-weight:700">Salon Envy</div><div style="font-size:13px;color:#666;margin-top:2px">${location}</div></div><div style="text-align:right"><div style="font-size:15px;font-weight:600">Payroll — ${pLabel}</div><div style="font-size:12px;color:#666;margin-top:2px">Pay Day: ${pDay}</div><div style="margin-top:4px;display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;background:${data.status === "paid" ? "#d1fae5" : "#f3f4f6"};color:${data.status === "paid" ? "#065f46" : "#374151"}">${data.status}</div></div></div><div class="sum"><div class="cd g"><div class="v">$${data.totalCommission.toFixed(2)}</div><div class="l">Commission</div></div><div class="cd a"><div class="v">$${data.totalTips.toFixed(2)}</div><div class="l">Tips</div></div><div class="cd"><div class="v">$${tp}</div><div class="l">Total Payout</div></div><div class="cd"><div class="v">${data.totalServices}</div><div class="l">Services</div></div></div><table><thead><tr><th>Stylist</th><th style="text-align:right">Services</th><th style="text-align:right">Subtotal</th><th style="text-align:right">Commission (40%)</th><th style="text-align:right">Tips</th><th style="text-align:right">Total Payout</th></tr></thead><tbody>${rows}<tr class="tot"><td>TOTAL</td><td style="text-align:right">${data.totalServices}</td><td></td><td style="text-align:right;color:#10B981">$${data.totalCommission.toFixed(2)}</td><td style="text-align:right;color:#f59e0b">$${data.totalTips.toFixed(2)}</td><td style="text-align:right">$${tp}</td></tr></tbody></table><div class="ft"><span>Generated ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CST</span><span>portal.salonenvyusa.com</span></div><script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }

  if (isStylist) return <div style={{ padding: "40px", textAlign: "center", color: MUTED }}><div style={{ fontSize: "16px", fontWeight: 700 }}>Owner / Manager Access Only</div></div>

  return (
    <div style={{ ...jakarta, minHeight: "100%", backgroundColor: "#06080d", color: "#fff", padding: "24px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`@media(max-width:767px){.pr4{grid-template-columns:1fr 1fr !important}.pr-tbl{display:block !important;overflow-x:auto}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 500, margin: 0 }}>Payroll</h1>
            <div style={{ display: "flex", gap: "3px", background: S1, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "3px" }}>
              {(["CC", "SA"] as const).map(l => <button key={l} onClick={() => setLoc(l)} style={{ padding: "5px 14px", borderRadius: "5px", border: "none", cursor: "pointer", background: loc === l ? `linear-gradient(135deg, ${ACC_B}, ${ACC})` : "transparent", color: loc === l ? "#fff" : MUTED, fontSize: "11px", fontWeight: loc === l ? 600 : 400, ...mono, textTransform: "uppercase", letterSpacing: "0.08em", transition: "all 0.15s" }}>{l === "CC" ? "Corpus Christi" : "San Antonio"}</button>)}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {data && <button onClick={printReport} style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "7px", color: MID, fontSize: "12px", cursor: "pointer", ...jakarta }}>Print Report</button>}
            {data && <button onClick={() => window.open(`/api/payroll/export?periodId=${data.id}`, "_blank")} style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${BORDER2}`, borderRadius: "7px", color: MID, fontSize: "12px", cursor: "pointer", ...jakarta }}>Export CSV</button>}
            {data && data.status === "pending" && isOwner && <button onClick={markPaid} disabled={marking} style={{ padding: "8px 18px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "7px", color: GREEN, fontSize: "12px", fontWeight: 600, cursor: "pointer", ...jakarta, opacity: marking ? 0.5 : 1 }}>{marking ? "..." : "Mark as Paid"}</button>}
          </div>
        </div>

        {/* Period nav */}
        <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "20px 24px", marginBottom: "20px", boxShadow: CARD_SHADOW }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <button onClick={() => setOffset(o => o + 1)} style={{ width: "36px", height: "36px", borderRadius: "8px", background: S2, border: `1px solid ${BORDER2}`, color: MID, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>&#8592;</button>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ ...mono, fontSize: "18px", fontWeight: 500 }}>{label}</span>
                {isPaid && <span style={{ ...mono, fontSize: "9px", padding: "3px 10px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: GREEN, textTransform: "uppercase", letterSpacing: "0.1em" }}>Paid</span>}
                {data?.status === "pending" && <span style={{ ...mono, fontSize: "9px", padding: "3px 10px", borderRadius: "20px", background: ACC_DIM, border: `1px solid ${ACC_BDR}`, color: ACC_B, textTransform: "uppercase", letterSpacing: "0.1em" }}>Pending</span>}
              </div>
              <div style={{ ...mono, fontSize: "11px", color: MUTED, marginTop: "4px" }}>Pay day: {payDay}</div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {offset > 0 && <button onClick={() => setOffset(0)} style={{ padding: "8px 12px", borderRadius: "8px", background: ACC_DIM, border: `1px solid ${ACC_BDR}`, color: ACC_B, fontSize: "10px", fontWeight: 600, cursor: "pointer", ...mono, letterSpacing: "0.06em" }}>TODAY</button>}
              <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} style={{ width: "36px", height: "36px", borderRadius: "8px", background: offset === 0 ? "rgba(255,255,255,0.02)" : S2, border: `1px solid ${BORDER2}`, color: offset === 0 ? "rgba(255,255,255,0.15)" : MID, cursor: offset === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>&#8594;</button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", fontSize: "13px", color: RED }}>{error}</div>}

        {/* KPIs */}
        <div className="pr4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "TOTAL COMMISSION", val: data ? `$${data.totalCommission.toFixed(2)}` : "\u2014", accent: GREEN },
            { label: "TOTAL TIPS", val: data ? `$${data.totalTips.toFixed(2)}` : "\u2014", accent: AMBER },
            { label: "TOTAL PAYOUT", val: data ? `$${totalPayout.toFixed(2)}` : "\u2014", accent: ACC_B },
            { label: "SERVICES", val: data ? String(data.totalServices) : "\u2014", accent: BLUE },
          ].map(k => (
            <div key={k.label} style={{ background: S1, border: `1px solid ${BORDER2}`, borderLeft: `3px solid ${k.accent}`, borderRadius: "0 10px 10px 0", padding: "18px 20px", boxShadow: CARD_SHADOW }}>
              {loading ? <div style={{ height: "28px", background: S2, borderRadius: "4px", marginBottom: "8px", animation: "pulse 1.5s infinite" }} /> : <div style={{ ...mono, fontSize: "26px", fontWeight: 500, marginBottom: "6px" }}>{k.val}</div>}
              <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Main content */}
        {loading ? (
          <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "24px", boxShadow: CARD_SHADOW }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ height: "44px", background: S2, borderRadius: "6px", marginBottom: "8px", animation: "pulse 1.5s infinite", opacity: 1 - i * 0.15 }} />)}
          </div>
        ) : !data ? (
          <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "60px 24px", textAlign: "center" }}>
            <div style={{ ...mono, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "12px" }}>No payroll data</div>
            <div style={{ fontSize: "15px", fontWeight: 500, color: MID, marginBottom: "6px" }}>No payroll calculated for {label}</div>
            <div style={{ fontSize: "12px", color: MUTED, marginBottom: "24px" }}>Click Calculate to pull SalonTransact data and compute commissions</div>
            <button onClick={calculate} disabled={calcing} style={{ padding: "12px 28px", background: calcing ? "rgba(96,110,116,0.3)" : `linear-gradient(135deg, ${ACC_B}, ${ACC})`, border: "none", borderRadius: "9px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: calcing ? "default" : "pointer", ...jakarta }}>
              {calcing ? <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Calculating...</span> : "Calculate Payroll"}
            </button>
          </div>
        ) : (
          <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", overflow: "hidden", boxShadow: CARD_SHADOW }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>Stylist Breakdown</span>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {data.status === "pending" && <button onClick={calculate} disabled={calcing} style={{ background: "none", border: "none", color: ACC_B, fontSize: "12px", cursor: "pointer", ...jakarta }}>{calcing ? "Recalculating..." : "Recalculate"}</button>}
                {isPaid && data.paidAt && <span style={{ ...mono, fontSize: "10px", color: GREEN }}>Paid {new Date(data.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}</span>}
              </div>
            </div>
            <div className="pr-tbl" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead><tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${BORDER}` }}>
                  {["Stylist", "Services", "Subtotal", "Commission (40%)", "Tips", "Total Payout"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: h === "Stylist" ? "left" : "right", ...mono, fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {entries.length === 0 ? <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: MUTED }}>No service data</td></tr> : entries.map((e: PData, i: number) => (
                    <tr key={e.id || i} style={{ borderBottom: i < entries.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                      <td style={{ padding: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: `linear-gradient(135deg, ${ACC_B}, ${ACC})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>{e.teamMemberName.charAt(0)}</div>
                        <div><div style={{ fontSize: "13px", fontWeight: 500 }}>{e.teamMemberName}</div>{TEAM_MEMBERS[e.teamMemberId]?.isManager && <div style={{ ...mono, fontSize: "8px", color: ACC_B, textTransform: "uppercase" }}>Manager</div>}</div>
                      </td>
                      <td style={{ ...mono, padding: "14px", textAlign: "right", fontSize: "13px", color: MUTED }}>{e.serviceCount}</td>
                      <td style={{ ...mono, padding: "14px", textAlign: "right", fontSize: "13px", color: MID }}>${e.serviceSubtotal.toFixed(2)}</td>
                      <td style={{ ...mono, padding: "14px", textAlign: "right", fontSize: "14px", fontWeight: 600, color: GREEN }}>${e.commission.toFixed(2)}</td>
                      <td style={{ ...mono, padding: "14px", textAlign: "right", fontSize: "13px", color: AMBER }}>${e.tips.toFixed(2)}</td>
                      <td style={{ ...mono, padding: "14px", textAlign: "right", fontSize: "15px", fontWeight: 700 }}>${e.totalPayout.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                {entries.length > 0 && <tfoot><tr style={{ background: S2, borderTop: `2px solid ${BORDER2}` }}>
                  <td style={{ padding: "14px", fontSize: "13px", fontWeight: 600, color: MID }}>TOTAL</td>
                  <td style={{ ...mono, padding: "14px", textAlign: "right", fontWeight: 600, color: MUTED }}>{data.totalServices}</td>
                  <td style={{ padding: "14px" }} />
                  <td style={{ ...mono, padding: "14px", textAlign: "right", fontSize: "14px", fontWeight: 700, color: GREEN }}>${data.totalCommission.toFixed(2)}</td>
                  <td style={{ ...mono, padding: "14px", textAlign: "right", fontWeight: 600, color: AMBER }}>${data.totalTips.toFixed(2)}</td>
                  <td style={{ ...mono, padding: "14px", textAlign: "right", fontSize: "15px", fontWeight: 700 }}>${totalPayout.toFixed(2)}</td>
                </tr></tfoot>}
              </table>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <button onClick={() => setShowHist(h => !h)} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: MID, fontSize: "13px", cursor: "pointer", padding: "8px 0", ...jakarta }}>
              <span style={{ ...mono, fontSize: "9px", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>Period History ({history.length})</span>
              <span style={{ color: MUTED, fontSize: "10px", transform: showHist ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>&#9660;</span>
            </button>
            {showHist && (
              <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", marginTop: "8px" }}>
                {history.map((hp, i) => (
                  <div key={hp.id} onClick={() => loadHistPeriod(hp)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < history.length - 1 ? `1px solid ${BORDER}` : "none", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => (e.currentTarget.style.background = S2)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ ...mono, fontSize: "12px", color: MID }}>{formatPeriodLabel(new Date(hp.periodStart), new Date(hp.periodEnd))}</span>
                      <span style={{ ...mono, fontSize: "8px", padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.08em", background: hp.status === "paid" ? "rgba(16,185,129,0.1)" : ACC_DIM, color: hp.status === "paid" ? GREEN : ACC_B, border: `1px solid ${hp.status === "paid" ? "rgba(16,185,129,0.2)" : ACC_BDR}` }}>{hp.status}</span>
                    </div>
                    <span style={{ ...mono, fontSize: "13px", color: GREEN }}>${(hp.totalCommission + hp.totalTips).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <div style={{ position: "fixed", bottom: "90px", right: "20px", zIndex: 999, background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(255,107,107,0.15)", border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(255,107,107,0.3)"}`, borderRadius: "10px", padding: "12px 20px", color: "#fff", fontSize: "13px", fontWeight: 500, backdropFilter: "blur(8px)", ...jakarta }}>{toast.msg}</div>}
    </div>
  )
}
