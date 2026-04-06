"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"

/* ─── Types ─── */
type Receipt = {
  id: string; vendor: string; amount: number; category: string; description: string
  receiptDate: string; isDeductible: boolean; aiAnalysis: string; taxYear: number
  createdAt: string; scheduleC_line?: string; isSplit?: boolean; businessPercent?: number
  businessAmount?: number; isDuplicate?: boolean; merchantCategory?: string
}

type MileageLogEntry = {
  id: string; date: string; purpose: string; miles: number; amount: number
  notes: string | null; taxYear: number; fromLocation?: string; toLocation?: string; isRoundTrip?: boolean
}

type QuarterlyPayment = {
  id: string; taxYear: number; quarter: number; dueDate: string
  estimatedAmount: number; actualAmount: number | null; paidAt: string | null
  confirmationNum: string | null; status: string
}

type ChatMsg = { role: "user" | "assistant"; content: string }

/* ─── Constants ─── */
const TABS = ["Dashboard", "Receipts", "Mileage", "Quarterly", "Optimizer", "Year-End", "Reyna Tax"]

const CATEGORY_COLORS: Record<string, string> = {
  Supplies: "#22c55e", Equipment: "#3b82f6", Education: "#a855f7", Travel: "#f97316",
  Marketing: "#ec4899", Office: "#06b6d4", Insurance: "#eab308", Licensing: "#8b5cf6",
  Software: "#14b8a6", Other: "#6b7280",
}

const SCHEDULE_C_LINES: Record<string, string> = {
  "8": "Advertising", "9": "Car and truck expenses", "10": "Commissions and fees",
  "11": "Contract labor", "13": "Depreciation", "15": "Insurance", "16a": "Mortgage interest",
  "17": "Legal and professional services", "18": "Office expense", "20a": "Rent - vehicles/equipment",
  "20b": "Rent - other", "22": "Supplies", "24a": "Travel", "24b": "Meals (50%)",
  "25": "Utilities", "27a": "Other expenses",
}

const QUICK_TRIPS = [
  { label: "Salon Centric CC", miles: 5 },
  { label: "Sally Beauty SA", miles: 8 },
  { label: "CosmoProf", miles: 6 },
]

const SUGGESTED_TAX_QUESTIONS = [
  "What deductions am I missing as a salon professional?",
  "How much should I set aside from each paycheck for taxes?",
  "Should I set up a SEP-IRA? How much can I contribute?",
  "Can I deduct my phone bill and internet?",
  "What records do I need to keep for the IRS?",
]

/* ─── Tax math helpers ─── */
const SE_TAX_RATE = 0.153
const FED_RATE = 0.12
const MILEAGE_RATE = 0.70

function calcTaxes(income: number, deductions: number) {
  const taxableIncome = Math.max(0, income - deductions)
  const seBase = taxableIncome * 0.9235
  const seTax = seBase * SE_TAX_RATE
  const seDeduction = seTax * 0.5
  const adjustedIncome = Math.max(0, taxableIncome - seDeduction)
  const fedTax = adjustedIncome * FED_RATE
  const totalTax = seTax + fedTax
  const quarterly = totalTax / 4
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0
  const savePercent = Math.ceil(effectiveRate) + 2
  const taxSavings = deductions * (FED_RATE + SE_TAX_RATE)
  return { taxableIncome, seTax, seDeduction, fedTax, totalTax, quarterly, effectiveRate, savePercent, taxSavings }
}

/* ─── Shared styles ─── */
const cardStyle: React.CSSProperties = {
  padding: "20px", borderRadius: "12px",
  backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(205,201,192,0.1)",
}
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: "8px",
  backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)",
  color: "#FFFFFF", fontSize: "13px", outline: "none",
}
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "10px", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase",
  color: "rgba(205,201,192,0.5)", marginBottom: "6px",
}
const btnPrimary = (color: string, disabled?: boolean): React.CSSProperties => ({
  padding: "8px 16px", borderRadius: "8px", backgroundColor: disabled ? `${color}55` : color,
  border: "none", color: "#FFFFFF", fontSize: "11px", fontWeight: 800,
  letterSpacing: "0.06em", textTransform: "uppercase",
  cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px",
})
const subtext: React.CSSProperties = { fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }

/* ══════════════════════════════════════════════════════ */
export default function StyleTaxPage() {
  const router = useRouter()
  const { isOwner } = useUserRole()
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [mileageLogs, setMileageLogs] = useState<MileageLogEntry[]>([])
  const [totalMiles, setTotalMiles] = useState(0)
  const [totalMileageAmount, setTotalMileageAmount] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [showMileageModal, setShowMileageModal] = useState(false)
  const [mileageForm, setMileageForm] = useState({ date: "", purpose: "", miles: "", notes: "", isRoundTrip: false })
  const [quarterlyPayments, setQuarterlyPayments] = useState<QuarterlyPayment[]>([])
  const [showPayModal, setShowPayModal] = useState<number | null>(null)
  const [payForm, setPayForm] = useState({ amount: "", confirmation: "" })
  const [sepMonthly, setSepMonthly] = useState("500")
  const [healthPremium, setHealthPremium] = useState("400")
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()

  /* ─── Data loading ─── */
  useEffect(() => {
    fetch("/api/suite/subscription")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasAccess && !isOwner) { router.push("/suite"); return }
        setHasAccess(true); setLoading(false)
      })
      .catch(() => router.push("/suite"))
  }, [isOwner, router])

  useEffect(() => {
    if (!hasAccess && !isOwner) return
    fetch(`/api/suite/tax/receipts?year=${currentYear}`)
      .then((r) => r.json()).then((d) => setReceipts(d.receipts || [])).catch(() => {})
    fetch(`/api/suite/tax/mileage?year=${currentYear}`)
      .then((r) => r.json()).then((d) => {
        setMileageLogs(d.logs || []); setTotalMiles(d.totalMiles || 0); setTotalMileageAmount(d.totalAmount || 0)
      }).catch(() => {})
    fetch("/api/suite/tax/quarterly")
      .then((r) => r.json()).then((d) => setQuarterlyPayments(d.payments || [])).catch(() => {})
  }, [hasAccess, isOwner, currentYear])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [chatMessages])

  /* ─── Handlers ─── */
  const handleScanReceipt = useCallback(() => { fileInputRef.current?.click() }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await fetch("/api/suite/tax/scan-receipt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: reader.result as string }),
        })
        const data = await res.json()
        if (data.receipt) { setReceipts((prev) => [data.receipt, ...prev]); setTab(1) }
      } catch { /* noop */ } finally { setScanning(false) }
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleLogMileage = useCallback(async () => {
    if (!mileageForm.date || !mileageForm.purpose || !mileageForm.miles) return
    const miles = parseFloat(mileageForm.miles) * (mileageForm.isRoundTrip ? 2 : 1)
    try {
      const res = await fetch("/api/suite/tax/mileage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: mileageForm.date, purpose: mileageForm.purpose, miles, notes: mileageForm.notes || undefined }),
      })
      const data = await res.json()
      if (data.log) {
        setMileageLogs((prev) => [data.log, ...prev])
        setTotalMiles((prev) => prev + data.log.miles)
        setTotalMileageAmount((prev) => prev + data.log.amount)
        setShowMileageModal(false)
        setMileageForm({ date: "", purpose: "", miles: "", notes: "", isRoundTrip: false })
      }
    } catch { /* noop */ }
  }, [mileageForm])

  const handleQuickTrip = useCallback(async (label: string, miles: number) => {
    const today = new Date().toISOString().split("T")[0]
    try {
      const res = await fetch("/api/suite/tax/mileage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, purpose: label, miles, notes: "Quick log" }),
      })
      const data = await res.json()
      if (data.log) {
        setMileageLogs((prev) => [data.log, ...prev])
        setTotalMiles((prev) => prev + data.log.miles)
        setTotalMileageAmount((prev) => prev + data.log.amount)
      }
    } catch { /* noop */ }
  }, [])

  const handleMarkPaid = useCallback(async () => {
    if (showPayModal === null || !payForm.amount) return
    try {
      const res = await fetch("/api/suite/tax/quarterly", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter: showPayModal, actualAmount: parseFloat(payForm.amount), confirmationNum: payForm.confirmation || undefined }),
      })
      const data = await res.json()
      if (data.payment) {
        setQuarterlyPayments((prev) => prev.map((p) => p.quarter === showPayModal ? data.payment : p))
        setShowPayModal(null); setPayForm({ amount: "", confirmation: "" })
      }
    } catch { /* noop */ }
  }, [showPayModal, payForm])

  const handleChat = useCallback(async (msg?: string) => {
    const text = msg || chatInput.trim()
    if (!text) return
    setChatInput("")
    const newMsgs: ChatMsg[] = [...chatMessages, { role: "user", content: text }]
    setChatMessages(newMsgs)
    setChatLoading(true)
    try {
      const taxCtx = `User is a self-employed hair stylist in Texas. YTD income: ~$${estimatedIncome.toLocaleString()}. YTD deductions: $${totalDeductions.toFixed(0)}. Mileage: ${totalMiles.toFixed(0)} miles ($${totalMileageAmount.toFixed(0)}). Receipts: ${receipts.length}. Tax year: ${currentYear}. Answer as a tax advisor specialized in 1099 stylists.`
      const res = await fetch("/api/reyna", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "system", content: taxCtx }, ...newMsgs] }),
      })
      const data = await res.json()
      if (data.reply) {
        setChatMessages([...newMsgs, { role: "assistant", content: data.reply }])
      }
    } catch { /* noop */ } finally { setChatLoading(false) }
  }, [chatInput, chatMessages, receipts.length, totalMiles, totalMileageAmount, currentYear])

  /* ─── Calculations ─── */
  const estimatedIncome = 75000
  const receiptDeductions = receipts.filter((r) => r.isDeductible).reduce((s, r) => s + (r.businessAmount ?? r.amount ?? 0), 0)
  const totalDeductions = receiptDeductions + totalMileageAmount
  const tax = calcTaxes(estimatedIncome, totalDeductions)
  const categoryBreakdown = receipts.filter((r) => r.isDeductible).reduce((acc: Record<string, number>, r) => {
    const cat = r.category || "Other"; acc[cat] = (acc[cat] || 0) + (r.businessAmount ?? r.amount ?? 0); return acc
  }, {})

  // Schedule C line breakdown
  const scheduleCBreakdown = receipts.filter((r) => r.isDeductible && r.scheduleC_line).reduce((acc: Record<string, number>, r) => {
    const line = r.scheduleC_line || "27a - Other"; acc[line] = (acc[line] || 0) + (r.businessAmount ?? r.amount ?? 0); return acc
  }, {})

  // Optimizer calcs
  const sepAnnual = Math.min(parseFloat(sepMonthly || "0") * 12, estimatedIncome * 0.25, 69000)
  const sepTaxSaved = sepAnnual * (FED_RATE + SE_TAX_RATE)
  const healthAnnual = parseFloat(healthPremium || "0") * 12
  const healthTaxSaved = healthAnnual * FED_RATE

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "rgba(205,201,192,0.5)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>progress_activity</span>
        <p style={{ marginTop: "12px", fontSize: "13px" }}>Loading StyleTax...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => router.push("/suite")} style={{ background: "none", border: "none", color: "rgba(205,201,192,0.5)", cursor: "pointer", padding: "4px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
          </button>
          <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#22c55e" }}>receipt_long</span>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>StyleTax</h1>
          <span style={{ padding: "3px 10px", borderRadius: "20px", backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: "10px", fontWeight: 700 }}>{currentYear}</span>
        </div>
        <button onClick={handleScanReceipt} disabled={scanning} style={btnPrimary("#22c55e", scanning)}>
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{scanning ? "progress_activity" : "document_scanner"}</span>
          {scanning ? "Scanning..." : "Scan Receipt"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", overflowX: "auto", borderBottom: "1px solid rgba(205,201,192,0.1)" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "10px 16px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase", color: tab === i ? "#22c55e" : "rgba(205,201,192,0.5)",
            backgroundColor: "transparent", border: "none",
            borderBottom: tab === i ? "2px solid #22c55e" : "2px solid transparent",
            cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s ease",
          }}>{t}</button>
        ))}
      </div>

      {/* ═══════ TAB 0: Dashboard ═══════ */}
      {tab === 0 && (
        <div>
          {/* Save alert */}
          <div style={{ padding: "14px 20px", borderRadius: "10px", backgroundColor: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#f97316" }}>savings</span>
            <span style={{ fontSize: "13px", color: "rgba(205,201,192,0.8)" }}>
              Save <strong style={{ color: "#f97316" }}>{tax.savePercent}%</strong> from every check to cover taxes. Set it aside automatically.
            </span>
          </div>

          {/* 6 KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            {[
              { label: "YTD Income (Est.)", value: `$${estimatedIncome.toLocaleString()}`, color: "#FFFFFF", icon: "payments" },
              { label: "Total Deductions", value: `$${totalDeductions.toFixed(0)}`, color: "#22c55e", icon: "savings" },
              { label: "Tax Savings", value: `$${tax.taxSavings.toFixed(0)}`, color: "#14b8a6", icon: "trending_down" },
              { label: "Taxable Income", value: `$${tax.taxableIncome.toLocaleString()}`, color: "#f97316", icon: "account_balance" },
              { label: "Est. Tax Bill", value: `$${tax.totalTax.toFixed(0)}`, color: "#ef4444", icon: "receipt" },
              { label: "Quarterly Amount", value: `$${tax.quarterly.toFixed(0)}`, color: "#3b82f6", icon: "calendar_month" },
            ].map((kpi) => (
              <div key={kpi.label} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: kpi.color }}>{kpi.icon}</span>
                  <span style={subtext}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Tax Breakdown + Category Chart */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            {/* Tax breakdown panel */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "14px" }}>Tax Breakdown</h3>
              {[
                { l: "Gross Income", v: `$${estimatedIncome.toLocaleString()}`, c: "#FFFFFF" },
                { l: "Deductions", v: `-$${totalDeductions.toFixed(0)}`, c: "#22c55e" },
                { l: "SE Tax (15.3%)", v: `$${tax.seTax.toFixed(0)}`, c: "#f97316" },
                { l: "SE Deduction (50%)", v: `-$${tax.seDeduction.toFixed(0)}`, c: "#22c55e" },
                { l: "Federal Tax (12%)", v: `$${tax.fedTax.toFixed(0)}`, c: "#f97316" },
                { l: "Texas State Tax", v: "$0", c: "#22c55e" },
                { l: "Total Tax", v: `$${tax.totalTax.toFixed(0)}`, c: "#ef4444", bold: true },
              ].map((r) => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: r.bold ? "1px solid rgba(205,201,192,0.1)" : "none" }}>
                  <span style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", fontWeight: r.bold ? 700 : 400 }}>{r.l}</span>
                  <span style={{ fontSize: r.bold ? "15px" : "12px", fontWeight: r.bold ? 800 : 600, color: r.c }}>{r.v}</span>
                </div>
              ))}
            </div>

            {/* Category chart */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "14px" }}>Deductions by Category</h3>
              {Object.keys(categoryBreakdown).length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "rgba(205,201,192,0.4)", fontSize: "13px" }}>No deductions yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                    const pct = totalDeductions > 0 ? (amt / totalDeductions) * 100 : 0
                    return (
                      <div key={cat}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                          <span style={{ fontSize: "11px", color: "rgba(205,201,192,0.7)" }}>{cat}</span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF" }}>${amt.toFixed(0)}</span>
                        </div>
                        <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "rgba(205,201,192,0.1)" }}>
                          <div style={{ height: "100%", borderRadius: "3px", backgroundColor: CATEGORY_COLORS[cat] || "#6b7280", width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  {totalMileageAmount > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontSize: "11px", color: "rgba(205,201,192,0.7)" }}>Mileage</span>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF" }}>${totalMileageAmount.toFixed(0)}</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "rgba(205,201,192,0.1)" }}>
                        <div style={{ height: "100%", borderRadius: "3px", backgroundColor: "#f97316", width: `${(totalMileageAmount / totalDeductions) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Scan CTA */}
          <div style={{ padding: "20px", borderRadius: "12px", background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#22c55e" }}>document_scanner</span>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>Scan a Receipt</div>
              <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)" }}>AI extracts vendor, amount, category, and IRS Schedule C line automatically.</div>
            </div>
            <button onClick={handleScanReceipt} disabled={scanning} style={btnPrimary("#22c55e", scanning)}>{scanning ? "Scanning..." : "Scan Now"}</button>
          </div>
        </div>
      )}

      {/* ═══════ TAB 1: Receipts ═══════ */}
      {tab === 1 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.5)" }}>{receipts.length} receipt{receipts.length !== 1 ? "s" : ""} this year</div>
            <button onClick={handleScanReceipt} disabled={scanning} style={btnPrimary("#22c55e", scanning)}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>Scan Receipt
            </button>
          </div>
          {receipts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", ...cardStyle }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)" }}>receipt_long</span>
              <p style={{ color: "rgba(205,201,192,0.4)", fontSize: "13px", marginTop: "12px" }}>No receipts yet. Scan your first receipt.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {receipts.map((r) => (
                <div key={r.id} style={{ padding: "16px 20px", borderRadius: "10px", backgroundColor: r.isDuplicate ? "rgba(239,68,68,0.06)" : "rgba(205,201,192,0.04)", border: r.isDuplicate ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(205,201,192,0.1)", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "24px", color: CATEGORY_COLORS[r.category] || "#6b7280" }}>receipt</span>
                  <div style={{ flex: 1, minWidth: "150px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{r.vendor}</span>
                      {r.isDuplicate && <span style={{ padding: "2px 8px", borderRadius: "10px", backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: "9px", fontWeight: 700 }}>DUPLICATE?</span>}
                      {r.isSplit && <span style={{ padding: "2px 8px", borderRadius: "10px", backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7", fontSize: "9px", fontWeight: 700 }}>{r.businessPercent}% BIZ</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginTop: "2px" }}>{r.description}</div>
                    {r.scheduleC_line && <div style={{ fontSize: "10px", color: "rgba(59,130,246,0.7)", marginTop: "3px" }}>Sched C: {r.scheduleC_line}</div>}
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: "20px", backgroundColor: `${CATEGORY_COLORS[r.category] || "#6b7280"}20`, color: CATEGORY_COLORS[r.category] || "#6b7280", fontSize: "10px", fontWeight: 700 }}>{r.category}</span>
                  <div style={{ textAlign: "right", minWidth: "80px" }}>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: r.isDeductible ? "#22c55e" : "#FFFFFF" }}>${(r.amount || 0).toFixed(2)}</div>
                    {r.isSplit && r.businessAmount != null && <div style={{ fontSize: "10px", color: "#a855f7" }}>Biz: ${r.businessAmount.toFixed(2)}</div>}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)", minWidth: "80px", textAlign: "right" }}>
                    {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString() : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ TAB 2: Mileage ═══════ */}
      {tab === 2 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", marginBottom: "20px" }}>
            <div style={cardStyle}>
              <div style={subtext}>Total Miles</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF" }}>{totalMiles.toFixed(1)}</div>
            </div>
            <div style={cardStyle}>
              <div style={subtext}>Total Deduction</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#22c55e" }}>${totalMileageAmount.toFixed(2)}</div>
            </div>
            <div style={cardStyle}>
              <div style={subtext}>IRS Rate</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#f97316" }}>$0.70/mi</div>
            </div>
          </div>

          {/* Quick log buttons */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {QUICK_TRIPS.map((t) => (
              <button key={t.label} onClick={() => handleQuickTrip(t.label, t.miles)} style={{
                padding: "8px 14px", borderRadius: "20px", backgroundColor: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.25)", color: "#f97316", fontSize: "11px",
                fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>directions_car</span>
                {t.label} ({t.miles} mi)
              </button>
            ))}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <button onClick={() => setShowMileageModal(true)} style={btnPrimary("#f97316")}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>Log Trip
            </button>
          </div>

          {mileageLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", ...cardStyle }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)" }}>directions_car</span>
              <p style={{ color: "rgba(205,201,192,0.4)", fontSize: "13px", marginTop: "12px" }}>No trips logged yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {mileageLogs.map((log) => (
                <div key={log.id} style={{ padding: "16px 20px", borderRadius: "10px", ...cardStyle, display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#f97316" }}>directions_car</span>
                  <div style={{ flex: 1, minWidth: "150px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{log.purpose}</div>
                    {log.notes && <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginTop: "2px" }}>{log.notes}</div>}
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.6)" }}>{log.miles.toFixed(1)} mi</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#22c55e", minWidth: "70px", textAlign: "right" }}>${log.amount.toFixed(2)}</div>
                  <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)", minWidth: "80px", textAlign: "right" }}>{new Date(log.date).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ TAB 3: Quarterly ═══════ */}
      {tab === 3 && (
        <div>
          <div style={{ padding: "16px 20px", borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.7)" }}>
              Texas has <strong style={{ color: "#22c55e" }}>no state income tax</strong>. You only owe federal + self-employment tax.
            </div>
          </div>

          {/* Safe harbor warning */}
          <div style={{ padding: "14px 20px", borderRadius: "10px", backgroundColor: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#eab308" }}>warning</span>
            <span style={{ fontSize: "12px", color: "rgba(205,201,192,0.7)" }}>
              <strong>Safe Harbor Rule:</strong> Pay at least 100% of last year{"'"}s tax (or 110% if income {">"} $150k) to avoid underpayment penalties.
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            {[
              { q: 1, label: "Q1", months: "Jan - Mar", due: `April 15, ${currentYear}` },
              { q: 2, label: "Q2", months: "Apr - May", due: `June 15, ${currentYear}` },
              { q: 3, label: "Q3", months: "Jun - Aug", due: `September 15, ${currentYear}` },
              { q: 4, label: "Q4", months: "Sep - Dec", due: `January 15, ${currentYear + 1}` },
            ].map((quarter) => {
              const payment = quarterlyPayments.find((p) => p.quarter === quarter.q)
              const status = payment?.status || "upcoming"
              const statusColor = status === "paid" ? "#22c55e" : status === "overdue" ? "#ef4444" : "#3b82f6"
              return (
                <div key={quarter.q} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "20px", backgroundColor: `${statusColor}20`, color: statusColor, fontSize: "12px", fontWeight: 800 }}>{quarter.label}</span>
                    <span style={{ padding: "3px 10px", borderRadius: "10px", backgroundColor: `${statusColor}15`, color: statusColor, fontSize: "9px", fontWeight: 700, textTransform: "uppercase" }}>{status}</span>
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", marginBottom: "4px" }}>
                    ${(payment?.actualAmount ?? payment?.estimatedAmount ?? tax.quarterly).toFixed(0)}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginBottom: "4px" }}>Due: {quarter.due}</div>
                  <div style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)", marginBottom: "12px" }}>{quarter.months}</div>
                  {payment?.confirmationNum && (
                    <div style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)", marginBottom: "8px" }}>Conf#: {payment.confirmationNum}</div>
                  )}
                  <div style={{ display: "flex", gap: "6px" }}>
                    {status !== "paid" && (
                      <button onClick={() => { setShowPayModal(quarter.q); setPayForm({ amount: String(payment?.estimatedAmount || Math.round(tax.quarterly)), confirmation: "" }) }} style={{ ...btnPrimary("#22c55e"), flex: 1, justifyContent: "center", padding: "8px" }}>
                        Mark Paid
                      </button>
                    )}
                    <a href="https://www.irs.gov/payments/direct-pay" target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      padding: "8px", borderRadius: "8px", backgroundColor: "rgba(59,130,246,0.1)",
                      border: "1px solid rgba(59,130,246,0.2)", color: "#3b82f6", textDecoration: "none",
                      fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                      IRS Pay
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════ TAB 4: Optimizer ═══════ */}
      {tab === 4 && (
        <div>
          {/* SEP-IRA */}
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#a855f7" }}>savings</span>
              SEP-IRA Optimizer
            </h3>
            <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", marginBottom: "14px" }}>
              Contribute up to 25% of net self-employment income (max $69,000/yr). Contributions reduce taxable income.
            </div>
            <div style={{ maxWidth: "300px", marginBottom: "14px" }}>
              <label style={labelStyle}>Monthly Contribution</label>
              <input type="number" value={sepMonthly} onChange={(e) => setSepMonthly(e.target.value)} style={inputStyle} placeholder="500" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
              <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
                <div style={subtext}>Annual Contribution</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#a855f7" }}>${sepAnnual.toLocaleString()}</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={subtext}>Tax Saved</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#22c55e" }}>${sepTaxSaved.toFixed(0)}</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.1)" }}>
                <div style={subtext}>Effective Cost</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#FFFFFF" }}>${(sepAnnual - sepTaxSaved).toFixed(0)}</div>
              </div>
            </div>
          </div>

          {/* Health Insurance */}
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#3b82f6" }}>health_and_safety</span>
              Health Insurance Deduction
            </h3>
            <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", marginBottom: "14px" }}>
              Self-employed stylists can deduct 100% of health insurance premiums as an above-the-line deduction.
            </div>
            <div style={{ maxWidth: "300px", marginBottom: "14px" }}>
              <label style={labelStyle}>Monthly Premium</label>
              <input type="number" value={healthPremium} onChange={(e) => setHealthPremium(e.target.value)} style={inputStyle} placeholder="400" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                <div style={subtext}>Annual Deduction</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#3b82f6" }}>${healthAnnual.toLocaleString()}</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={subtext}>Tax Saved</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#22c55e" }}>${healthTaxSaved.toFixed(0)}</div>
              </div>
            </div>
          </div>

          {/* Missed deductions alerts */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#eab308" }}>lightbulb</span>
              Deductions You Might Be Missing
            </h3>
            {[
              { text: "Home office deduction - if you do admin work from home", icon: "home" },
              { text: "Phone & internet - deduct business-use percentage (typically 50-70%)", icon: "phone_iphone" },
              { text: "Continuing education - classes, shows, certifications", icon: "school" },
              { text: "Business insurance - liability, property, professional", icon: "shield" },
              { text: "Retirement contributions - SEP-IRA, Solo 401(k)", icon: "savings" },
              { text: "Professional subscriptions - booking software, accounting tools", icon: "subscriptions" },
            ].map((tip) => (
              <div key={tip.text} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid rgba(205,201,192,0.06)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#eab308" }}>{tip.icon}</span>
                <span style={{ fontSize: "12px", color: "rgba(205,201,192,0.7)" }}>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ TAB 5: Year-End ═══════ */}
      {tab === 5 && (
        <div>
          {/* Schedule C Summary */}
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "16px" }}>Schedule C - Profit or Loss from Business</h3>
            <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.5)", marginBottom: "16px" }}>Hair Styling / Cosmetology Services | Principal Business Code: 812111</div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(205,201,192,0.1)" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>Line 1 - Gross Income</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF" }}>${estimatedIncome.toLocaleString()}</span>
            </div>

            <div style={{ padding: "8px 0 4px", fontSize: "11px", fontWeight: 700, color: "rgba(205,201,192,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Expenses by Schedule C Line</div>
            {Object.entries(scheduleCBreakdown).sort((a, b) => b[1] - a[1]).map(([line, amt]) => (
              <div key={line} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(205,201,192,0.05)" }}>
                <span style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)" }}>Line {line}</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e" }}>${amt.toFixed(2)}</span>
              </div>
            ))}
            {totalMileageAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(205,201,192,0.05)" }}>
                <span style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)" }}>Line 9 - Car and truck expenses</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e" }}>${totalMileageAmount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "2px solid rgba(205,201,192,0.1)", marginTop: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>Line 28 - Total Expenses</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "#22c55e" }}>${totalDeductions.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid rgba(205,201,192,0.1)" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>Line 31 - Net Profit</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF" }}>${tax.taxableIncome.toLocaleString()}</span>
            </div>
          </div>

          {/* Schedule 1 - Above the line */}
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "14px" }}>Schedule 1 - Above-the-Line Deductions</h3>
            {[
              { line: "15", label: "Deductible part of SE tax", value: tax.seDeduction },
              { line: "16", label: "SEP-IRA deduction", value: sepAnnual },
              { line: "17", label: "Self-employed health insurance", value: healthAnnual },
            ].map((item) => (
              <div key={item.line} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(205,201,192,0.05)" }}>
                <span style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)" }}>Line {item.line} - {item.label}</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e" }}>${item.value.toFixed(0)}</span>
              </div>
            ))}
          </div>

          {/* Mileage Log Summary */}
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "14px" }}>Mileage Log Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <div style={subtext}>Total Miles</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF" }}>{totalMiles.toFixed(1)}</div>
              </div>
              <div>
                <div style={subtext}>IRS Rate</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#f97316" }}>$0.70</div>
              </div>
              <div>
                <div style={subtext}>Total Deduction</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#22c55e" }}>${totalMileageAmount.toFixed(2)}</div>
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)", marginTop: "10px" }}>{mileageLogs.length} trips logged</div>
          </div>

          {/* Export button */}
          <button onClick={() => {
            const lines = [
              `StyleTax Year-End Summary - ${currentYear}`,
              `Generated: ${new Date().toLocaleDateString()}`,
              ``,
              `SCHEDULE C SUMMARY`,
              `Gross Income: $${estimatedIncome.toLocaleString()}`,
              ...Object.entries(scheduleCBreakdown).map(([l, a]) => `  Line ${l}: $${a.toFixed(2)}`),
              totalMileageAmount > 0 ? `  Line 9 - Mileage: $${totalMileageAmount.toFixed(2)}` : "",
              `Total Expenses: $${totalDeductions.toFixed(2)}`,
              `Net Profit: $${tax.taxableIncome.toLocaleString()}`,
              ``,
              `ABOVE-THE-LINE DEDUCTIONS`,
              `  SE Tax Deduction: $${tax.seDeduction.toFixed(0)}`,
              `  SEP-IRA: $${sepAnnual.toFixed(0)}`,
              `  Health Insurance: $${healthAnnual.toFixed(0)}`,
              ``,
              `MILEAGE LOG`,
              `  Total Miles: ${totalMiles.toFixed(1)}`,
              `  Rate: $0.70/mi`,
              `  Deduction: $${totalMileageAmount.toFixed(2)}`,
              `  Trips: ${mileageLogs.length}`,
              ``,
              `TAX ESTIMATE`,
              `  SE Tax: $${tax.seTax.toFixed(0)}`,
              `  Federal Tax: $${tax.fedTax.toFixed(0)}`,
              `  State Tax: $0`,
              `  Total: $${tax.totalTax.toFixed(0)}`,
            ].filter(Boolean).join("\n")
            const blob = new Blob([lines], { type: "text/plain" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url; a.download = `styletax-summary-${currentYear}.txt`; a.click()
            URL.revokeObjectURL(url)
          }} style={btnPrimary("#3b82f6")}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>
            Export Year-End Summary
          </button>
        </div>
      )}

      {/* ═══════ TAB 6: Reyna Tax ═══════ */}
      {tab === 6 && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)" }}>
          <div style={{ ...cardStyle, marginBottom: "12px", padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#a855f7" }}>smart_toy</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>Reyna Tax Advisor</span>
              <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)" }}>AI-powered tax guidance for salon professionals</span>
            </div>
          </div>

          {/* Suggested questions (only when no messages) */}
          {chatMessages.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {SUGGESTED_TAX_QUESTIONS.map((q) => (
                <button key={q} onClick={() => handleChat(q)} style={{
                  padding: "8px 14px", borderRadius: "20px", backgroundColor: "rgba(168,85,247,0.08)",
                  border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7", fontSize: "11px",
                  fontWeight: 600, cursor: "pointer", textAlign: "left",
                }}>{q}</button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px", padding: "4px" }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                maxWidth: "85%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                padding: "12px 16px", borderRadius: "12px",
                backgroundColor: msg.role === "user" ? "rgba(168,85,247,0.15)" : "rgba(205,201,192,0.06)",
                border: msg.role === "user" ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(205,201,192,0.1)",
              }}>
                <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.85)", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{msg.content}</div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: "12px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.1)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "rgba(205,201,192,0.4)" }}>progress_activity</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text" value={chatInput} placeholder="Ask about taxes, deductions, quarterly payments..."
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat() } }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={() => handleChat()} disabled={chatLoading || !chatInput.trim()} style={btnPrimary("#a855f7", chatLoading || !chatInput.trim())}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>send</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════ Mileage Modal ═══════ */}
      {showMileageModal && (
        <div onClick={() => setShowMileageModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#1a2a32", borderRadius: "16px", border: "1px solid rgba(205,201,192,0.15)", padding: "28px", maxWidth: "440px", width: "100%" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 20px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#f97316", verticalAlign: "middle", marginRight: "8px" }}>directions_car</span>
              Log Business Trip
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={mileageForm.date} onChange={(e) => setMileageForm({ ...mileageForm, date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Purpose</label>
                <input type="text" placeholder="e.g., Drive to Sally Beauty Supply" value={mileageForm.purpose} onChange={(e) => setMileageForm({ ...mileageForm, purpose: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Miles (one way)</label>
                <input type="number" step="0.1" placeholder="e.g., 12.5" value={mileageForm.miles} onChange={(e) => setMileageForm({ ...mileageForm, miles: e.target.value })} style={inputStyle} />
                {mileageForm.miles && (
                  <div style={{ fontSize: "12px", color: "#22c55e", marginTop: "6px" }}>
                    Deduction: ${(parseFloat(mileageForm.miles) * MILEAGE_RATE * (mileageForm.isRoundTrip ? 2 : 1)).toFixed(2)}
                    {mileageForm.isRoundTrip && ` (${(parseFloat(mileageForm.miles) * 2).toFixed(1)} mi round trip)`}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" id="roundTrip" checked={mileageForm.isRoundTrip} onChange={(e) => setMileageForm({ ...mileageForm, isRoundTrip: e.target.checked })} style={{ accentColor: "#f97316" }} />
                <label htmlFor="roundTrip" style={{ fontSize: "12px", color: "rgba(205,201,192,0.7)", cursor: "pointer" }}>Round trip (doubles mileage)</label>
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <input type="text" placeholder="Any additional details" value={mileageForm.notes} onChange={(e) => setMileageForm({ ...mileageForm, notes: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <button onClick={() => setShowMileageModal(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.15)", color: "rgba(205,201,192,0.5)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleLogMileage} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "#f97316", border: "none", color: "#FFFFFF", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Save Trip</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Mark Paid Modal ═══════ */}
      {showPayModal !== null && (
        <div onClick={() => setShowPayModal(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#1a2a32", borderRadius: "16px", border: "1px solid rgba(205,201,192,0.15)", padding: "28px", maxWidth: "440px", width: "100%" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 20px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#22c55e", verticalAlign: "middle", marginRight: "8px" }}>check_circle</span>
              Mark Q{showPayModal} as Paid
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Amount Paid</label>
                <input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} style={inputStyle} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>IRS Confirmation Number (optional)</label>
                <input type="text" value={payForm.confirmation} onChange={(e) => setPayForm({ ...payForm, confirmation: e.target.value })} style={inputStyle} placeholder="e.g., 1234-5678-9012" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <button onClick={() => setShowPayModal(null)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.15)", color: "rgba(205,201,192,0.5)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleMarkPaid} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "#22c55e", border: "none", color: "#FFFFFF", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
