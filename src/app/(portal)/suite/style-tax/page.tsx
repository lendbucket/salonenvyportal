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

type OtherIncomeEntry = { id: string; source: string; amount: number; date: string; notes: string | null; taxYear: number }

type ChatMsg = { role: "user" | "assistant"; content: string }

/* ─── Constants ─── */
const TABS = ["Dashboard", "Income", "Receipts", "Mileage", "Quarterly", "Optimizer", "Year-End", "Reyna Tax"]

const CATEGORY_COLORS: Record<string, string> = {
  Supplies: "#10B981", Equipment: "#4da6ff", Education: "#a78bfa", Travel: "#ffb347",
  Marketing: "#ec4899", Office: "#06b6d4", Insurance: "#eab308", Licensing: "#8b5cf6",
  Software: "#14b8a6", Other: "#6b7280",
}

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS)

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

/* ─── Design tokens ─── */
const C = {
  bg: "#F4F5F7",
  accent: "#606E74",
  bright: "#7a8f96",
  glow: "rgba(96,110,116,0.2)",
  dim: "rgba(96,110,116,0.08)",
  surface: "rgba(26,19,19,0.03)",
  surfaceHover: "rgba(26,19,19,0.05)",
  border: "rgba(26,19,19,0.07)",
  borderHover: "rgba(26,19,19,0.12)",
  stone: "#CDC9C0",
  amber: "#ffb347",
  blue: "#4da6ff",
  purple: "#a78bfa",
  red: "#ff6b6b",
  green: "#10B981",
}

/* ─── Shared styles ─── */
const cardStyle: React.CSSProperties = {
  padding: "20px", borderRadius: "14px",
  backgroundColor: C.surface, border: `1px solid ${C.border}`,
}
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: "8px",
  backgroundColor: C.dim, border: `1px solid ${C.border}`,
  color: "#1A1313", fontSize: "13px", outline: "none",
}
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "10px", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase",
  color: `${C.stone}80`, marginBottom: "6px",
}
const btnPrimary = (color: string, disabled?: boolean): React.CSSProperties => ({
  padding: "8px 16px", borderRadius: "8px",
  background: disabled ? `${color}55` : `linear-gradient(135deg, ${C.accent} 0%, ${C.bright} 100%)`,
  border: "none", color: "#1A1313", fontSize: "11px", fontWeight: 800,
  letterSpacing: "0.06em", textTransform: "uppercase",
  cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px",
  boxShadow: disabled ? "none" : `0 2px 12px ${C.glow}`,
})
const subtext: React.CSSProperties = { fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: `${C.stone}66`, marginBottom: "8px" }
const mono: React.CSSProperties = { fontFamily: "monospace" }

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

  // Receipt filter state
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterMonth, setFilterMonth] = useState<number | null>(null)
  const [filterSearch, setFilterSearch] = useState("")
  // Receipt edit state
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [editForm, setEditForm] = useState({ category: "", amount: "", businessPercent: "100", description: "" })
  const [savingEdit, setSavingEdit] = useState(false)
  // Other income
  const [otherIncome, setOtherIncome] = useState<OtherIncomeEntry[]>([])
  const [showOtherIncomeForm, setShowOtherIncomeForm] = useState(false)
  const [otherIncomeForm, setOtherIncomeForm] = useState({ source: "", amount: "", date: "", notes: "" })
  // Safe harbor
  const [lastYearTax, setLastYearTax] = useState("")

  /* ─── Data loading ─── */
  useEffect(() => {
    if (isOwner) { setHasAccess(true); setLoading(false); return }
    fetch("/api/suite/subscription")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasAccess) { setHasAccess(true) } else { setHasAccess(false) }
        setLoading(false)
      })
      .catch(() => { setHasAccess(true); setLoading(false) })
  }, [isOwner])

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
    fetch(`/api/suite/tax/income?year=${currentYear}`)
      .then((r) => r.json()).then((d) => setOtherIncome(d.otherIncome || [])).catch(() => {})
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
        if (data.receipt) { setReceipts((prev) => [data.receipt, ...prev]); setTab(2) }
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

  const handleDeleteMileage = useCallback(async (id: string) => {
    if (!confirm("Delete this mileage log?")) return
    const log = mileageLogs.find(l => l.id === id)
    try {
      await fetch(`/api/suite/tax/mileage/${id}`, { method: "DELETE" })
      setMileageLogs(prev => prev.filter(l => l.id !== id))
      if (log) {
        setTotalMiles(prev => prev - log.miles)
        setTotalMileageAmount(prev => prev - log.amount)
      }
    } catch { /* noop */ }
  }, [mileageLogs])

  const handleDeleteReceipt = useCallback(async (id: string) => {
    if (!confirm("Delete this receipt?")) return
    try {
      await fetch(`/api/suite/tax/receipts/${id}`, { method: "DELETE" })
      setReceipts(prev => prev.filter(r => r.id !== id))
    } catch { /* noop */ }
  }, [])

  const handleEditReceipt = useCallback(async () => {
    if (!editingReceipt) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/suite/tax/receipts/${editingReceipt.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: editForm.category, amount: parseFloat(editForm.amount),
          businessPercent: parseFloat(editForm.businessPercent), description: editForm.description,
        }),
      })
      const data = await res.json()
      if (data.receipt) {
        setReceipts(prev => prev.map(r => r.id === editingReceipt.id ? { ...r, ...data.receipt } : r))
        setEditingReceipt(null)
      }
    } catch { /* noop */ }
    setSavingEdit(false)
  }, [editingReceipt, editForm])

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

  const handleAddOtherIncome = useCallback(async () => {
    if (!otherIncomeForm.source || !otherIncomeForm.amount || !otherIncomeForm.date) return
    try {
      const res = await fetch("/api/suite/tax/income", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...otherIncomeForm, taxYear: currentYear }),
      })
      const data = await res.json()
      if (data.income) {
        setOtherIncome(prev => [data.income, ...prev])
        setShowOtherIncomeForm(false)
        setOtherIncomeForm({ source: "", amount: "", date: "", notes: "" })
      }
    } catch { /* noop */ }
  }, [otherIncomeForm, currentYear])

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
  const otherIncomeTotal = otherIncome.reduce((s, o) => s + o.amount, 0)
  const totalIncome = estimatedIncome + otherIncomeTotal
  const receiptDeductions = receipts.filter((r) => r.isDeductible).reduce((s, r) => s + (r.businessAmount ?? r.amount ?? 0), 0)
  const totalDeductions = receiptDeductions + totalMileageAmount
  const tax = calcTaxes(totalIncome, totalDeductions)
  const categoryBreakdown = receipts.filter((r) => r.isDeductible).reduce((acc: Record<string, number>, r) => {
    const cat = r.category || "Other"; acc[cat] = (acc[cat] || 0) + (r.businessAmount ?? r.amount ?? 0); return acc
  }, {})

  const scheduleCBreakdown = receipts.filter((r) => r.isDeductible && r.scheduleC_line).reduce((acc: Record<string, number>, r) => {
    const line = r.scheduleC_line || "27a - Other"; acc[line] = (acc[line] || 0) + (r.businessAmount ?? r.amount ?? 0); return acc
  }, {})

  const sepAnnual = Math.min(parseFloat(sepMonthly || "0") * 12, totalIncome * 0.25, 69000)
  const sepTaxSaved = sepAnnual * (FED_RATE + SE_TAX_RATE)
  const healthAnnual = parseFloat(healthPremium || "0") * 12
  const healthTaxSaved = healthAnnual * FED_RATE

  // Filtered receipts
  const filteredReceipts = receipts.filter(r => {
    if (filterCategory && r.category !== filterCategory) return false
    if (filterMonth !== null && r.receiptDate) {
      const m = new Date(r.receiptDate).getMonth()
      if (m !== filterMonth) return false
    }
    if (filterSearch && !r.vendor?.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  // Monthly receipt breakdown for chart
  const monthlyReceiptTotals = Array.from({ length: 12 }, (_, i) => {
    return receipts.filter(r => r.isDeductible && r.receiptDate && new Date(r.receiptDate).getMonth() === i)
      .reduce((s, r) => s + (r.businessAmount ?? r.amount ?? 0), 0)
  })
  const maxMonthReceipt = Math.max(...monthlyReceiptTotals, 1)
  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  // Safe harbor calc
  const lastYearTaxNum = parseFloat(lastYearTax) || 0
  const safeHarborQuarterly = lastYearTaxNum > 0 ? Math.ceil(lastYearTaxNum / 4) : 0

  // Mileage weekly/monthly summaries
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekMiles = mileageLogs.filter(l => new Date(l.date) >= weekStart).reduce((s, l) => s + l.miles, 0)
  const weekAmount = weekMiles * MILEAGE_RATE
  const monthMiles = mileageLogs.filter(l => new Date(l.date) >= monthStart).reduce((s, l) => s + l.miles, 0)
  const monthAmount = monthMiles * MILEAGE_RATE

  // Download helpers
  const downloadFile = (content: string, filename: string, type = "text/plain") => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 500, padding: 24 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 60, background: "#FBFBFB", border: "1px solid rgba(205,201,192,0.12)", borderRadius: 10, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 700, color: "#1A1313", marginBottom: 8 }}>StyleTax</div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#7a8f96", marginBottom: 24, textAlign: "center" }}>Subscribe to Envy Suite to access this feature</div>
        <button onClick={() => router.push("/suite")} style={{ background: "transparent", border: "1px solid #606E74", color: "#7a8f96", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>View Plans</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "-180px", left: "50%", transform: "translateX(-50%)",
        width: "700px", height: "500px",
        background: `radial-gradient(ellipse at center, ${C.glow} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileSelect} />

        {/* ── Breadcrumb Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => router.push("/suite")} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px",
              color: `${C.stone}80`, cursor: "pointer", padding: "6px 8px",
              display: "flex", alignItems: "center",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
            </button>
            <span style={{ fontSize: "12px", color: `${C.stone}44` }}>/</span>
            <span style={{ fontSize: "12px", color: `${C.stone}55` }}>Envy Suite</span>
            <span style={{ fontSize: "12px", color: `${C.stone}44` }}>/</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px", color: C.bright }}>receipt_long</span>
              <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#1A1313", margin: 0 }}>StyleTax</h1>
            </div>
            <span style={{
              padding: "3px 12px", borderRadius: "20px",
              background: C.dim, border: `1px solid ${C.border}`,
              color: C.bright, fontSize: "10px", fontWeight: 700,
            }}>{currentYear}</span>
          </div>
          <button onClick={handleScanReceipt} disabled={scanning} style={btnPrimary(C.accent, scanning)}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{scanning ? "progress_activity" : "document_scanner"}</span>
            {scanning ? "Scanning..." : "Scan Receipt"}
          </button>
        </div>

        {/* ── Save Banner ── */}
        <div style={{
          padding: "14px 20px", borderRadius: "12px",
          background: "rgba(255,179,71,0.06)", border: "1px solid rgba(255,179,71,0.15)",
          marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.amber }}>savings</span>
          <span style={{ fontSize: "13px", color: `${C.stone}cc` }}>
            Save <strong style={{ color: C.amber, ...mono }}>{tax.savePercent}%</strong> from every check to cover taxes. Set it aside automatically.
          </span>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: "flex", gap: "2px", marginBottom: "28px", overflowX: "auto",
          borderBottom: `1px solid ${C.border}`, paddingBottom: "0",
        }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              padding: "10px 16px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: tab === i ? C.bright : `${C.stone}55`,
              backgroundColor: tab === i ? C.dim : "transparent",
              border: "none",
              borderBottom: tab === i ? `2px solid ${C.accent}` : "2px solid transparent",
              borderRadius: tab === i ? "6px 6px 0 0" : "0",
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s ease",
            }}>{t}</button>
          ))}
        </div>

        {/* ═══════ TAB 0: Dashboard ═══════ */}
        {tab === 0 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "28px" }}>
              {[
                { label: "YTD Income (Est.)", value: `$${totalIncome.toLocaleString()}`, color: "#1A1313", icon: "payments" },
                { label: "Total Deductions", value: `$${totalDeductions.toFixed(0)}`, color: C.green, icon: "savings" },
                { label: "Tax Savings", value: `$${tax.taxSavings.toFixed(0)}`, color: "#14b8a6", icon: "trending_down" },
                { label: "Taxable Income", value: `$${tax.taxableIncome.toLocaleString()}`, color: C.amber, icon: "account_balance" },
                { label: "Est. Tax Bill", value: `$${tax.totalTax.toFixed(0)}`, color: C.red, icon: "receipt" },
                { label: "Quarterly Amount", value: `$${tax.quarterly.toFixed(0)}`, color: C.blue, icon: "calendar_month" },
              ].map((kpi) => (
                <div key={kpi.label} style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: kpi.color }}>{kpi.icon}</span>
                    <span style={subtext}>{kpi.label}</span>
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: kpi.color, ...mono }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "14px" }}>Tax Breakdown</h3>
                {[
                  { l: "Gross Income", v: `$${totalIncome.toLocaleString()}`, c: "#FBFBFB" },
                  { l: "Deductions", v: `-$${totalDeductions.toFixed(0)}`, c: C.green },
                  { l: "SE Tax (15.3%)", v: `$${tax.seTax.toFixed(0)}`, c: C.amber },
                  { l: "SE Deduction (50%)", v: `-$${tax.seDeduction.toFixed(0)}`, c: C.green },
                  { l: "Federal Tax (12%)", v: `$${tax.fedTax.toFixed(0)}`, c: C.amber },
                  { l: "Texas State Tax", v: "$0", c: C.green },
                  { l: "Total Tax", v: `$${tax.totalTax.toFixed(0)}`, c: C.red, bold: true },
                ].map((r) => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: r.bold ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize: "12px", color: `${C.stone}88`, fontWeight: r.bold ? 700 : 400 }}>{r.l}</span>
                    <span style={{ fontSize: r.bold ? "15px" : "12px", fontWeight: r.bold ? 800 : 600, color: r.c, ...mono }}>{r.v}</span>
                  </div>
                ))}
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "14px" }}>Deductions by Category</h3>
                {Object.keys(categoryBreakdown).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: `${C.stone}55`, fontSize: "13px" }}>No deductions yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                      const pct = totalDeductions > 0 ? (amt / totalDeductions) * 100 : 0
                      return (
                        <div key={cat}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                            <span style={{ fontSize: "11px", color: `${C.stone}aa` }}>{cat}</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#1A1313", ...mono }}>${amt.toFixed(0)}</span>
                          </div>
                          <div style={{ height: "6px", borderRadius: "3px", backgroundColor: C.dim }}>
                            <div style={{ height: "100%", borderRadius: "3px", backgroundColor: CATEGORY_COLORS[cat] || "#6b7280", width: `${pct}%`, transition: "width 0.3s ease" }} />
                          </div>
                        </div>
                      )
                    })}
                    {totalMileageAmount > 0 && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                          <span style={{ fontSize: "11px", color: `${C.stone}aa` }}>Mileage</span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#1A1313", ...mono }}>${totalMileageAmount.toFixed(0)}</span>
                        </div>
                        <div style={{ height: "6px", borderRadius: "3px", backgroundColor: C.dim }}>
                          <div style={{ height: "100%", borderRadius: "3px", backgroundColor: C.amber, width: `${(totalMileageAmount / totalDeductions) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{
              padding: "24px", borderRadius: "14px",
              background: C.dim, border: `1px solid ${C.accent}33`,
              display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: C.bright }}>document_scanner</span>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", marginBottom: "4px" }}>Scan a Receipt</div>
                <div style={{ fontSize: "12px", color: `${C.stone}88` }}>AI extracts vendor, amount, category, and IRS Schedule C line automatically.</div>
              </div>
              <button onClick={handleScanReceipt} disabled={scanning} style={btnPrimary(C.accent, scanning)}>{scanning ? "Scanning..." : "Scan Now"}</button>
            </div>
          </div>
        )}

        {/* ═══════ TAB 1: Income ═══════ */}
        {tab === 1 && (
          <div>
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "20px" }}>
              {[
                { label: "YTD (SalonTransact)", value: `$${estimatedIncome.toLocaleString()}`, color: "#1A1313" },
                { label: "Other Income", value: `$${otherIncomeTotal.toLocaleString()}`, color: C.purple },
                { label: "Total Income", value: `$${totalIncome.toLocaleString()}`, color: C.amber },
                { label: "Projected Annual", value: `$${Math.round(totalIncome / Math.max(now.getMonth() + 1, 1) * 12).toLocaleString()}`, color: C.blue },
                { label: "Weekly Average", value: `$${Math.round(totalIncome / Math.max(Math.ceil((now.getTime() - new Date(currentYear, 0, 1).getTime()) / (7 * 86400000)), 1)).toLocaleString()}`, color: C.green },
              ].map(kpi => (
                <div key={kpi.label} style={cardStyle}>
                  <div style={subtext}>{kpi.label}</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: kpi.color, ...mono }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Tax reserve tracker */}
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: C.amber }}>savings</span>
                Tax Reserve Tracker
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.amber}0c`, border: `1px solid ${C.amber}22` }}>
                  <div style={subtext}>Should Have Saved</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: C.amber, ...mono }}>${Math.round(totalIncome * tax.savePercent / 100).toLocaleString()}</div>
                  <div style={{ fontSize: "10px", color: `${C.stone}55`, marginTop: "4px" }}>{tax.savePercent}% of income</div>
                </div>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.red}0c`, border: `1px solid ${C.red}22` }}>
                  <div style={subtext}>Estimated Tax Owed</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: C.red, ...mono }}>${tax.totalTax.toFixed(0)}</div>
                </div>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.green}0c`, border: `1px solid ${C.green}22` }}>
                  <div style={subtext}>Tax Savings from Deductions</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: C.green, ...mono }}>${tax.taxSavings.toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Other income */}
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", margin: 0 }}>Other Income Sources</h3>
                <button onClick={() => setShowOtherIncomeForm(true)} style={btnPrimary(C.accent)}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>Add Income
                </button>
              </div>
              {otherIncome.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: `${C.stone}55`, fontSize: "12px" }}>No other income sources recorded. Add tips, side gigs, or other 1099 income.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {otherIncome.map(o => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "8px", backgroundColor: C.surfaceHover, border: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1313" }}>{o.source}</div>
                        {o.notes && <div style={{ fontSize: "10px", color: `${C.stone}55` }}>{o.notes}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: C.green, ...mono }}>${o.amount.toFixed(2)}</div>
                        <div style={{ fontSize: "10px", color: `${C.stone}55` }}>{new Date(o.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other income modal */}
            {showOtherIncomeForm && (
              <div onClick={() => setShowOtherIncomeForm(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#FBFBFB", borderRadius: "18px", border: `1px solid ${C.border}`, padding: "28px", maxWidth: "440px", width: "100%", boxShadow: `0 24px 80px rgba(0,0,0,0.6)` }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1A1313", margin: "0 0 20px" }}>Add Other Income</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div><label style={labelStyle}>Source</label><input value={otherIncomeForm.source} onChange={e => setOtherIncomeForm(p => ({ ...p, source: e.target.value }))} placeholder="e.g., Tips, Side gig, Freelance" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Amount</label><input type="number" step="0.01" value={otherIncomeForm.amount} onChange={e => setOtherIncomeForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Date</label><input type="date" value={otherIncomeForm.date} onChange={e => setOtherIncomeForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Notes (optional)</label><input value={otherIncomeForm.notes} onChange={e => setOtherIncomeForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} /></div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                    <button onClick={() => setShowOtherIncomeForm(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: `${C.stone}66`, fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    <button onClick={handleAddOtherIncome} style={{ flex: 1, padding: "10px", borderRadius: "8px", background: `linear-gradient(135deg, ${C.accent} 0%, ${C.bright} 100%)`, border: "none", color: "#1A1313", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", cursor: "pointer" }}>Save</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ TAB 2: Receipts ═══════ */}
        {tab === 2 && (
          <div>
            {/* Monthly breakdown bar chart */}
            {receipts.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: "16px" }}>
                <div style={subtext}>Monthly Deductions</div>
                <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "80px" }}>
                  {monthlyReceiptTotals.map((amt, i) => (
                    <div key={i} onClick={() => setFilterMonth(filterMonth === i ? null : i)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                      <div style={{ width: "100%", height: `${Math.max((amt / maxMonthReceipt) * 60, 2)}px`, backgroundColor: filterMonth === i ? C.bright : `${C.accent}66`, borderRadius: "3px 3px 0 0", transition: "all 0.2s" }} />
                      <div style={{ fontSize: "8px", color: filterMonth === i ? C.bright : `${C.stone}44`, marginTop: "4px", ...mono }}>{MONTH_LABELS[i]}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter bar */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search vendor..." style={{ ...inputStyle, width: "180px", fontSize: "11px", padding: "7px 10px" }} />
              <select value={filterMonth ?? ""} onChange={e => setFilterMonth(e.target.value === "" ? null : parseInt(e.target.value))} style={{ ...inputStyle, width: "130px", fontSize: "11px", padding: "7px 10px" }}>
                <option value="">All months</option>
                {MONTH_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {ALL_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? null : cat)} style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "9px", fontWeight: 700, border: `1px solid ${filterCategory === cat ? CATEGORY_COLORS[cat] + "60" : C.border}`, background: filterCategory === cat ? `${CATEGORY_COLORS[cat]}15` : "transparent", color: filterCategory === cat ? CATEGORY_COLORS[cat] : `${C.stone}55`, cursor: "pointer" }}>{cat}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", color: `${C.stone}66` }}>{filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? "s" : ""}{filterCategory || filterMonth !== null || filterSearch ? " (filtered)" : ""}</div>
              <button onClick={handleScanReceipt} disabled={scanning} style={btnPrimary(C.accent, scanning)}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>Scan Receipt
              </button>
            </div>
            {filteredReceipts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", ...cardStyle }}>
                <span className="material-symbols-outlined" style={{ fontSize: "48px", color: `${C.stone}33` }}>receipt_long</span>
                <p style={{ color: `${C.stone}55`, fontSize: "13px", marginTop: "12px" }}>{receipts.length === 0 ? "No receipts yet. Scan your first receipt." : "No receipts match your filters."}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredReceipts.map((r) => (
                  <div key={r.id} style={{
                    padding: "16px 20px", borderRadius: "12px",
                    backgroundColor: r.isDuplicate ? "rgba(255,107,107,0.04)" : C.surface,
                    border: r.isDuplicate ? `1px solid rgba(255,107,107,0.15)` : `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px", color: CATEGORY_COLORS[r.category] || "#6b7280" }}>receipt</span>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313" }}>{r.vendor}</span>
                        {r.isDuplicate && <span style={{ padding: "2px 8px", borderRadius: "10px", backgroundColor: "rgba(255,107,107,0.12)", color: C.red, fontSize: "9px", fontWeight: 700 }}>DUPLICATE?</span>}
                        {r.isSplit && <span style={{ padding: "2px 8px", borderRadius: "10px", backgroundColor: "rgba(167,139,250,0.12)", color: C.purple, fontSize: "9px", fontWeight: 700 }}>{r.businessPercent}% BIZ</span>}
                      </div>
                      <div style={{ fontSize: "11px", color: `${C.stone}66`, marginTop: "2px" }}>{r.description}</div>
                      {r.scheduleC_line && <div style={{ fontSize: "10px", color: `${C.blue}bb`, marginTop: "3px", ...mono }}>Sched C: {r.scheduleC_line}</div>}
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: "20px", backgroundColor: `${CATEGORY_COLORS[r.category] || "#6b7280"}15`, color: CATEGORY_COLORS[r.category] || "#6b7280", fontSize: "10px", fontWeight: 700 }}>{r.category}</span>
                    <div style={{ textAlign: "right", minWidth: "80px" }}>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: r.isDeductible ? C.green : "#FBFBFB", ...mono }}>${(r.amount || 0).toFixed(2)}</div>
                      {r.isSplit && r.businessAmount != null && <div style={{ fontSize: "10px", color: C.purple, ...mono }}>Biz: ${r.businessAmount.toFixed(2)}</div>}
                    </div>
                    <div style={{ fontSize: "11px", color: `${C.stone}55`, minWidth: "80px", textAlign: "right" }}>
                      {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString() : ""}
                    </div>
                    {/* Edit/Delete buttons */}
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => { setEditingReceipt(r); setEditForm({ category: r.category || "", amount: String(r.amount || 0), businessPercent: String(r.businessPercent || 100), description: r.description || "" }) }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: `${C.stone}66`, fontSize: "10px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit</span>
                      </button>
                      <button onClick={() => handleDeleteReceipt(r.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: `${C.red}88`, fontSize: "10px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Edit receipt modal */}
            {editingReceipt && (
              <div onClick={() => setEditingReceipt(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#FBFBFB", borderRadius: "18px", border: `1px solid ${C.border}`, padding: "28px", maxWidth: "440px", width: "100%", boxShadow: `0 24px 80px rgba(0,0,0,0.6)` }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1A1313", margin: "0 0 20px" }}>Edit Receipt</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div><label style={labelStyle}>Category</label>
                      <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                        {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>Amount</label><input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} /></div>
                    <div>
                      <label style={labelStyle}>Business Use: {editForm.businessPercent}%</label>
                      <input type="range" min="0" max="100" value={editForm.businessPercent} onChange={e => setEditForm(p => ({ ...p, businessPercent: e.target.value }))} style={{ width: "100%", accentColor: C.accent }} />
                    </div>
                    <div><label style={labelStyle}>Description</label><input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} /></div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                    <button onClick={() => setEditingReceipt(null)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: `${C.stone}66`, fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    <button onClick={handleEditReceipt} disabled={savingEdit} style={{ flex: 1, padding: "10px", borderRadius: "8px", background: `linear-gradient(135deg, ${C.accent} 0%, ${C.bright} 100%)`, border: "none", color: "#1A1313", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", cursor: "pointer" }}>{savingEdit ? "Saving..." : "Save Changes"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ TAB 3: Mileage ═══════ */}
        {tab === 3 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px", marginBottom: "20px" }}>
              {[
                { label: "This Week", value: `${weekMiles.toFixed(1)} mi`, sub: `$${weekAmount.toFixed(2)}`, color: C.blue },
                { label: "This Month", value: `${monthMiles.toFixed(1)} mi`, sub: `$${monthAmount.toFixed(2)}`, color: C.bright },
                { label: "YTD Miles", value: totalMiles.toFixed(1), sub: "", color: "#1A1313" },
                { label: "YTD Deduction", value: `$${totalMileageAmount.toFixed(2)}`, sub: "", color: C.green },
                { label: "IRS Rate", value: "$0.70/mi", sub: "", color: C.amber },
              ].map(kpi => (
                <div key={kpi.label} style={cardStyle}>
                  <div style={subtext}>{kpi.label}</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: kpi.color, ...mono }}>{kpi.value}</div>
                  {kpi.sub && <div style={{ fontSize: "10px", color: `${C.stone}55`, marginTop: "2px", ...mono }}>{kpi.sub}</div>}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {QUICK_TRIPS.map((t) => (
                <button key={t.label} onClick={() => handleQuickTrip(t.label, t.miles)} style={{
                  padding: "8px 14px", borderRadius: "20px",
                  backgroundColor: C.dim, border: `1px solid ${C.accent}33`,
                  color: C.bright, fontSize: "11px",
                  fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>directions_car</span>
                  {t.label} ({t.miles} mi)
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <button onClick={() => setShowMileageModal(true)} style={btnPrimary(C.accent)}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>Log Trip
              </button>
              <button onClick={() => {
                const lines = ["Date,Origin,Destination,Business Purpose,Miles,Amount"]
                mileageLogs.forEach(l => {
                  lines.push(`${new Date(l.date).toLocaleDateString()},${l.fromLocation || "Salon"},${l.toLocation || l.purpose},${l.purpose},${l.miles.toFixed(1)},$${l.amount.toFixed(2)}`)
                })
                lines.push(`\nTotal,,,,${totalMiles.toFixed(1)},$${totalMileageAmount.toFixed(2)}`)
                downloadFile(lines.join("\n"), `irs-mileage-log-${currentYear}.csv`, "text/csv")
              }} style={{ ...btnPrimary(C.accent), background: `${C.blue}0d`, border: `1px solid ${C.blue}22`, color: C.blue, boxShadow: "none" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>Export IRS Mileage Log
              </button>
            </div>

            {mileageLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", ...cardStyle }}>
                <span className="material-symbols-outlined" style={{ fontSize: "48px", color: `${C.stone}33` }}>directions_car</span>
                <p style={{ color: `${C.stone}55`, fontSize: "13px", marginTop: "12px" }}>No trips logged yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {mileageLogs.map((log) => (
                  <div key={log.id} style={{ padding: "16px 20px", borderRadius: "12px", backgroundColor: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "22px", color: C.bright }}>directions_car</span>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313" }}>{log.purpose}</div>
                      {log.notes && <div style={{ fontSize: "11px", color: `${C.stone}66`, marginTop: "2px" }}>{log.notes}</div>}
                    </div>
                    <div style={{ fontSize: "13px", color: `${C.stone}88`, ...mono }}>{log.miles.toFixed(1)} mi</div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: C.green, minWidth: "70px", textAlign: "right", ...mono }}>${log.amount.toFixed(2)}</div>
                    <div style={{ fontSize: "11px", color: `${C.stone}55`, minWidth: "80px", textAlign: "right" }}>{new Date(log.date).toLocaleDateString()}</div>
                    <button onClick={() => handleDeleteMileage(log.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: `${C.red}88` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ TAB 4: Quarterly ═══════ */}
        {tab === 4 && (
          <div>
            <div style={{ padding: "16px 20px", borderRadius: "12px", backgroundColor: `${C.blue}0a`, border: `1px solid ${C.blue}22`, marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", color: `${C.stone}aa` }}>
                Texas has <strong style={{ color: C.green }}>no state income tax</strong>. You only owe federal + self-employment tax.
              </div>
            </div>

            {/* Safe Harbor Calculator */}
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: C.green }}>shield</span>
                Safe Harbor Protection
              </h3>
              <div style={{ fontSize: "12px", color: `${C.stone}88`, marginBottom: "14px" }}>
                Pay the <strong>lesser</strong> of 90% of this year{"'"}s tax or 100% of last year{"'"}s tax to avoid underpayment penalties.
              </div>
              <div style={{ maxWidth: "300px", marginBottom: "14px" }}>
                <label style={labelStyle}>Last Year{"'"}s Total Tax Paid</label>
                <input type="number" value={lastYearTax} onChange={e => setLastYearTax(e.target.value)} placeholder="e.g. 8000" style={{ ...inputStyle, borderColor: `${C.accent}44` }} />
              </div>
              {lastYearTaxNum > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.green}0c`, border: `1px solid ${C.green}22` }}>
                    <div style={subtext}>Safe Harbor / Quarter</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: C.green, ...mono }}>${safeHarborQuarterly.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.amber}0c`, border: `1px solid ${C.amber}22` }}>
                    <div style={subtext}>90% This Year / Quarter</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: C.amber, ...mono }}>${Math.ceil(tax.totalTax * 0.9 / 4).toLocaleString()}</div>
                  </div>
                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                    <div style={subtext}>You Need / Quarter</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#1A1313", ...mono }}>${Math.min(safeHarborQuarterly, Math.ceil(tax.totalTax * 0.9 / 4)).toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Quarter cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              {[
                { q: 1, label: "Q1", months: "Jan - Mar", due: `April 15, ${currentYear}` },
                { q: 2, label: "Q2", months: "Apr - May", due: `June 16, ${currentYear}` },
                { q: 3, label: "Q3", months: "Jun - Aug", due: `September 15, ${currentYear}` },
                { q: 4, label: "Q4", months: "Sep - Dec", due: `January 15, ${currentYear + 1}` },
              ].map((quarter) => {
                const payment = quarterlyPayments.find((p) => p.quarter === quarter.q)
                const status = payment?.status || "upcoming"
                const statusColor = status === "paid" ? C.green : status === "overdue" ? C.red : C.blue
                const underpayment = safeHarborQuarterly > 0 && status === "paid" && payment?.actualAmount
                  ? Math.max(0, safeHarborQuarterly - payment.actualAmount) : 0
                return (
                  <div key={quarter.q} style={{ ...cardStyle, borderLeft: `3px solid ${statusColor}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span style={{ padding: "4px 12px", borderRadius: "20px", backgroundColor: `${statusColor}18`, color: statusColor, fontSize: "12px", fontWeight: 800 }}>{quarter.label}</span>
                      <span style={{ padding: "3px 10px", borderRadius: "10px", backgroundColor: `${statusColor}12`, color: statusColor, fontSize: "9px", fontWeight: 700, textTransform: "uppercase" }}>{status}</span>
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#1A1313", marginBottom: "4px", ...mono }}>
                      ${(payment?.actualAmount ?? payment?.estimatedAmount ?? tax.quarterly).toFixed(0)}
                    </div>
                    <div style={{ fontSize: "11px", color: `${C.stone}66`, marginBottom: "4px" }}>Due: {quarter.due}</div>
                    <div style={{ fontSize: "10px", color: `${C.stone}55`, marginBottom: "12px" }}>{quarter.months}</div>
                    {payment?.confirmationNum && (
                      <div style={{ fontSize: "10px", color: `${C.stone}55`, marginBottom: "8px", ...mono }}>Conf#: {payment.confirmationNum}</div>
                    )}
                    {underpayment > 0 && (
                      <div style={{ fontSize: "10px", color: C.red, marginBottom: "8px", ...mono }}>Underpaid by ${underpayment.toFixed(0)} vs safe harbor</div>
                    )}
                    <div style={{ display: "flex", gap: "6px" }}>
                      {status !== "paid" && (
                        <button onClick={() => { setShowPayModal(quarter.q); setPayForm({ amount: String(payment?.estimatedAmount || Math.round(tax.quarterly)), confirmation: "" }) }} style={{ ...btnPrimary(C.accent), flex: 1, justifyContent: "center", padding: "8px" }}>
                          Mark Paid
                        </button>
                      )}
                      <a href="https://www.irs.gov/payments/direct-pay" target="_blank" rel="noopener noreferrer" style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                        padding: "8px", borderRadius: "8px", backgroundColor: `${C.blue}0d`,
                        border: `1px solid ${C.blue}22`, color: C.blue, textDecoration: "none",
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

            {/* How to Pay */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: C.blue }}>info</span>
                How to Pay Quarterly Taxes
              </h3>
              {[
                { step: "1", text: `Go to IRS Direct Pay (irs.gov/payments/direct-pay)` },
                { step: "2", text: `Select "Estimated Tax" as payment reason` },
                { step: "3", text: `Select "1040-ES" as form` },
                { step: "4", text: `Enter tax year: ${currentYear}` },
                { step: "5", text: `Enter your payment amount: $${tax.quarterly.toFixed(0)}` },
                { step: "6", text: `Enter your SSN and confirm — keep confirmation number!` },
              ].map(s => (
                <div key={s.step} style={{ display: "flex", gap: "12px", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: `${C.blue}15`, border: `1px solid ${C.blue}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", color: C.blue, fontWeight: 700, ...mono }}>{s.step}</div>
                  <span style={{ fontSize: "12px", color: `${C.stone}aa`, lineHeight: 1.6 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ TAB 5: Optimizer ═══════ */}
        {tab === 5 && (
          <div>
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.purple }}>savings</span>
                SEP-IRA / Solo 401(k)
              </h3>
              <div style={{ fontSize: "12px", color: `${C.stone}88`, marginBottom: "14px" }}>
                SEP-IRA: up to 25% of net SE income (max $69,000/yr). Solo 401(k): up to $23,500 employee + 25% employer.
              </div>
              <div style={{ maxWidth: "300px", marginBottom: "14px" }}>
                <label style={labelStyle}>Monthly Contribution</label>
                <input type="number" value={sepMonthly} onChange={(e) => setSepMonthly(e.target.value)} style={{ ...inputStyle, borderColor: `${C.accent}44` }} placeholder="500" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.purple}0c`, border: `1px solid ${C.purple}22` }}>
                  <div style={subtext}>Annual Contribution</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: C.purple, ...mono }}>${sepAnnual.toLocaleString()}</div>
                </div>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.green}0c`, border: `1px solid ${C.green}22` }}>
                  <div style={subtext}>Tax Saved</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: C.green, ...mono }}>${sepTaxSaved.toFixed(0)}</div>
                </div>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                  <div style={subtext}>Effective Cost</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#1A1313", ...mono }}>${(sepAnnual - sepTaxSaved).toFixed(0)}</div>
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.blue }}>health_and_safety</span>
                Health Insurance Deduction
              </h3>
              <div style={{ fontSize: "12px", color: `${C.stone}88`, marginBottom: "14px" }}>
                Self-employed stylists deduct 100% of health, dental, and vision premiums. HSA contributions are also deductible (up to $4,300 individual / $8,550 family).
              </div>
              <div style={{ maxWidth: "300px", marginBottom: "14px" }}>
                <label style={labelStyle}>Monthly Premium</label>
                <input type="number" value={healthPremium} onChange={(e) => setHealthPremium(e.target.value)} style={{ ...inputStyle, borderColor: `${C.accent}44` }} placeholder="400" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.blue}0c`, border: `1px solid ${C.blue}22` }}>
                  <div style={subtext}>Annual Deduction</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: C.blue, ...mono }}>${healthAnnual.toLocaleString()}</div>
                </div>
                <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: `${C.green}0c`, border: `1px solid ${C.green}22` }}>
                  <div style={subtext}>Tax Saved</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: C.green, ...mono }}>${healthTaxSaved.toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Comprehensive deductions guide */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.amber }}>lightbulb</span>
                Complete Deductions Guide
              </h3>
              {[
                { text: "Supplies (color, developer, gloves, capes)", line: "Line 22", pct: "100%", docs: "Receipts", tip: "Scan every Sally/Salon Centric receipt", icon: "inventory_2" },
                { text: "Mileage (salon, supply runs, education)", line: "Line 9", pct: "100%", docs: "Mileage log", tip: "Use the mileage tracker — $0.70/mi adds up fast", icon: "directions_car" },
                { text: "Education (CE classes, shows, certifications)", line: "Line 27a", pct: "100%", docs: "Receipts + certificates", tip: "Hair shows, TDLR CE, and advanced training all count", icon: "school" },
                { text: "Professional liability insurance premium", line: "Line 15", pct: "100%", docs: "Policy statement", tip: "Your StyleInsure $15/mo is fully deductible!", icon: "shield" },
                { text: "Health insurance (medical, dental, vision, HSA)", line: "Schedule 1, Line 17", pct: "100%", docs: "1095-A form", tip: "Above-the-line deduction — reduces AGI directly", icon: "health_and_safety" },
                { text: "Retirement (SEP-IRA, Solo 401k)", line: "Schedule 1, Line 16", pct: "Up to 25%", docs: "Brokerage statement", tip: "SEP-IRA is easiest — open at Fidelity or Vanguard", icon: "savings" },
                { text: "Business meals (with clients, at education events)", line: "Line 24b", pct: "50%", docs: "Receipts + who/why", tip: "Write client name and business purpose on receipt", icon: "restaurant" },
                { text: "Phone & internet (business portion)", line: "Line 25", pct: "50–70%", docs: "Monthly bills", tip: "Track business vs personal usage percentage", icon: "phone_iphone" },
                { text: "Professional memberships & subscriptions", line: "Line 27a", pct: "100%", docs: "Receipts", tip: "Cosmetology associations, booking software, StyleSuite", icon: "card_membership" },
                { text: "Bank fees for business account", line: "Line 27a", pct: "100%", docs: "Bank statements", tip: "Keep a separate business account — deduct all fees", icon: "account_balance" },
                { text: "Marketing & advertising", line: "Line 8", pct: "100%", docs: "Receipts", tip: "Business cards, social media ads, website hosting", icon: "campaign" },
                { text: "Home office (if you do admin from home)", line: "Line 30", pct: "$5/sqft up to 300sqft", docs: "Floor plan measurement", tip: "Simplified method: up to $1,500 deduction", icon: "home" },
              ].map((tip) => (
                <div key={tip.text} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: C.amber, marginTop: "2px" }}>{tip.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: `${C.stone}cc`, marginBottom: "4px" }}>{tip.text}</div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "9px", color: C.blue, ...mono }}>{tip.line}</span>
                      <span style={{ fontSize: "9px", color: C.green, ...mono }}>{tip.pct}</span>
                      <span style={{ fontSize: "9px", color: `${C.stone}55` }}>Docs: {tip.docs}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: C.amber, marginTop: "3px", fontStyle: "italic" }}>Pro tip: {tip.tip}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ TAB 6: Year-End ═══════ */}
        {tab === 6 && (
          <div>
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "16px" }}>Schedule C - Profit or Loss from Business</h3>
              <div style={{ fontSize: "12px", color: `${C.stone}66`, marginBottom: "16px", ...mono }}>Hair Styling / Cosmetology Services | Principal Business Code: 812111</div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1A1313" }}>Line 1 - Gross Income</span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#1A1313", ...mono }}>${totalIncome.toLocaleString()}</span>
              </div>

              <div style={{ padding: "8px 0 4px", fontSize: "11px", fontWeight: 700, color: `${C.stone}55`, textTransform: "uppercase", letterSpacing: "0.08em" }}>Expenses by Schedule C Line</div>
              {Object.entries(scheduleCBreakdown).sort((a, b) => b[1] - a[1]).map(([line, amt]) => (
                <div key={line} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: "12px", color: `${C.stone}88`, ...mono }}>Line {line}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: C.green, ...mono }}>${amt.toFixed(2)}</span>
                </div>
              ))}
              {totalMileageAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: "12px", color: `${C.stone}88`, ...mono }}>Line 9 - Car and truck expenses</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: C.green, ...mono }}>${totalMileageAmount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${C.borderHover}`, marginTop: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1A1313" }}>Line 28 - Total Expenses</span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: C.green, ...mono }}>${totalDeductions.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1A1313" }}>Line 31 - Net Profit</span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#1A1313", ...mono }}>${tax.taxableIncome.toLocaleString()}</span>
              </div>
            </div>

            {/* Schedule 1 */}
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "14px" }}>Schedule 1 - Above-the-Line Deductions</h3>
              {[
                { line: "15", label: "Deductible part of SE tax", value: tax.seDeduction },
                { line: "16", label: "SEP-IRA deduction", value: sepAnnual },
                { line: "17", label: "Self-employed health insurance", value: healthAnnual },
              ].map((item) => (
                <div key={item.line} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: "12px", color: `${C.stone}88`, ...mono }}>Line {item.line} - {item.label}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: C.green, ...mono }}>${item.value.toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Important Deadlines */}
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: C.red }}>event</span>
                Important Tax Deadlines
              </h3>
              {[
                { date: "January 15", desc: "Q4 estimated tax due" },
                { date: "January 31", desc: "Salon Envy sends your 1099-NEC" },
                { date: "April 15", desc: "Tax return AND Q1 estimated tax due" },
                { date: "June 16", desc: "Q2 estimated tax due" },
                { date: "September 15", desc: "Q3 estimated tax due" },
              ].map(d => (
                <div key={d.date} style={{ display: "flex", gap: "12px", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: C.amber, minWidth: "110px", ...mono }}>{d.date}</span>
                  <span style={{ fontSize: "12px", color: `${C.stone}aa` }}>{d.desc}</span>
                </div>
              ))}
            </div>

            {/* Mileage Log Summary */}
            <div style={{ ...cardStyle, marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313", marginTop: 0, marginBottom: "14px" }}>Mileage Log Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div><div style={subtext}>Total Miles</div><div style={{ fontSize: "18px", fontWeight: 800, color: "#1A1313", ...mono }}>{totalMiles.toFixed(1)}</div></div>
                <div><div style={subtext}>IRS Rate</div><div style={{ fontSize: "18px", fontWeight: 800, color: C.amber, ...mono }}>$0.70</div></div>
                <div><div style={subtext}>Total Deduction</div><div style={{ fontSize: "18px", fontWeight: 800, color: C.green, ...mono }}>${totalMileageAmount.toFixed(2)}</div></div>
              </div>
              <div style={{ fontSize: "11px", color: `${C.stone}55`, marginTop: "10px" }}>{mileageLogs.length} trips logged</div>
            </div>

            {/* Export buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => {
                const lines = [
                  `StyleTax Year-End Summary - ${currentYear}`,
                  `Generated: ${new Date().toLocaleDateString()}`,
                  ``, `SCHEDULE C SUMMARY`,
                  `Gross Income: $${totalIncome.toLocaleString()}`,
                  ...Object.entries(scheduleCBreakdown).map(([l, a]) => `  Line ${l}: $${a.toFixed(2)}`),
                  totalMileageAmount > 0 ? `  Line 9 - Mileage: $${totalMileageAmount.toFixed(2)}` : "",
                  `Total Expenses: $${totalDeductions.toFixed(2)}`,
                  `Net Profit: $${tax.taxableIncome.toLocaleString()}`,
                  ``, `ABOVE-THE-LINE DEDUCTIONS`,
                  `  SE Tax Deduction: $${tax.seDeduction.toFixed(0)}`,
                  `  SEP-IRA: $${sepAnnual.toFixed(0)}`,
                  `  Health Insurance: $${healthAnnual.toFixed(0)}`,
                  ``, `MILEAGE LOG`, `  Total Miles: ${totalMiles.toFixed(1)}`, `  Rate: $0.70/mi`,
                  `  Deduction: $${totalMileageAmount.toFixed(2)}`, `  Trips: ${mileageLogs.length}`,
                  ``, `TAX ESTIMATE`, `  SE Tax: $${tax.seTax.toFixed(0)}`,
                  `  Federal Tax: $${tax.fedTax.toFixed(0)}`, `  State Tax: $0`,
                  `  Total: $${tax.totalTax.toFixed(0)}`,
                ].filter(Boolean).join("\n")
                downloadFile(lines, `styletax-summary-${currentYear}.txt`)
              }} style={btnPrimary(C.accent)}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>
                Download Tax Summary (.txt)
              </button>
              <button onClick={() => {
                const csvLines = [
                  "Line,Description,Amount",
                  `1,Gross Receipts,$${totalIncome}`,
                  ...Object.entries(scheduleCBreakdown).map(([l, a]) => `${l},${SCHEDULE_C_LINES[l] || "Other"},$${a.toFixed(2)}`),
                  totalMileageAmount > 0 ? `9,Car and truck expenses,$${totalMileageAmount.toFixed(2)}` : "",
                  `28,Total Expenses,$${totalDeductions.toFixed(2)}`,
                  `31,Net Profit,$${tax.taxableIncome}`,
                ].filter(Boolean).join("\n")
                downloadFile(csvLines, `schedule-c-${currentYear}.csv`, "text/csv")
              }} style={{ ...btnPrimary(C.accent), background: `${C.blue}0d`, border: `1px solid ${C.blue}22`, color: C.blue, boxShadow: "none" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>table_chart</span>
                Download Schedule C (.csv)
              </button>
            </div>
          </div>
        )}

        {/* ═══════ TAB 7: Reyna Tax ═══════ */}
        {tab === 7 && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 260px)" }}>
            <div style={{ ...cardStyle, marginBottom: "12px", padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.bright }}>smart_toy</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1A1313" }}>Reyna Tax Advisor</span>
                <span style={{ fontSize: "10px", color: `${C.stone}55` }}>AI-powered tax guidance for salon professionals</span>
              </div>
            </div>

            {chatMessages.length === 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                {SUGGESTED_TAX_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => handleChat(q)} style={{
                    padding: "8px 14px", borderRadius: "20px",
                    backgroundColor: C.dim, border: `1px solid ${C.accent}33`,
                    color: C.bright, fontSize: "11px",
                    fontWeight: 600, cursor: "pointer", textAlign: "left",
                  }}>{q}</button>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px", padding: "4px" }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  maxWidth: "85%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  padding: "12px 16px", borderRadius: "12px",
                  backgroundColor: msg.role === "user" ? C.dim : C.surface,
                  border: msg.role === "user" ? `1px solid ${C.accent}44` : `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: "12px", color: `${C.stone}dd`, whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: "12px", backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: `${C.stone}55` }}>progress_activity</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text" value={chatInput} placeholder="Ask about taxes, deductions, quarterly payments..."
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat() } }}
                style={{ ...inputStyle, flex: 1, borderColor: `${C.accent}33` }}
              />
              <button onClick={() => handleChat()} disabled={chatLoading || !chatInput.trim()} style={btnPrimary(C.accent, chatLoading || !chatInput.trim())}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>send</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════ Mileage Modal ═══════ */}
        {showMileageModal && (
          <div onClick={() => setShowMileageModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#FBFBFB", borderRadius: "18px", border: `1px solid ${C.border}`, padding: "28px", maxWidth: "440px", width: "100%", boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${C.glow}` }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1A1313", margin: "0 0 20px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.bright, verticalAlign: "middle", marginRight: "8px" }}>directions_car</span>
                Log Business Trip
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div><label style={labelStyle}>Date</label><input type="date" value={mileageForm.date} onChange={(e) => setMileageForm({ ...mileageForm, date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Purpose</label><input type="text" placeholder="e.g., Drive to Sally Beauty Supply" value={mileageForm.purpose} onChange={(e) => setMileageForm({ ...mileageForm, purpose: e.target.value })} style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>Miles (one way)</label>
                  <input type="number" step="0.1" placeholder="e.g., 12.5" value={mileageForm.miles} onChange={(e) => setMileageForm({ ...mileageForm, miles: e.target.value })} style={inputStyle} />
                  {mileageForm.miles && (
                    <div style={{ fontSize: "12px", color: C.green, marginTop: "6px", ...mono }}>
                      Deduction: ${(parseFloat(mileageForm.miles) * MILEAGE_RATE * (mileageForm.isRoundTrip ? 2 : 1)).toFixed(2)}
                      {mileageForm.isRoundTrip && ` (${(parseFloat(mileageForm.miles) * 2).toFixed(1)} mi round trip)`}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" id="roundTrip" checked={mileageForm.isRoundTrip} onChange={(e) => setMileageForm({ ...mileageForm, isRoundTrip: e.target.checked })} style={{ accentColor: C.accent }} />
                  <label htmlFor="roundTrip" style={{ fontSize: "12px", color: `${C.stone}aa`, cursor: "pointer" }}>Round trip (doubles mileage)</label>
                </div>
                <div><label style={labelStyle}>Notes (optional)</label><input type="text" placeholder="Any additional details" value={mileageForm.notes} onChange={(e) => setMileageForm({ ...mileageForm, notes: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                <button onClick={() => setShowMileageModal(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: `${C.stone}66`, fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleLogMileage} style={{ flex: 1, padding: "10px", borderRadius: "8px", background: `linear-gradient(135deg, ${C.accent} 0%, ${C.bright} 100%)`, border: "none", color: "#1A1313", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", boxShadow: `0 2px 12px ${C.glow}` }}>Save Trip</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ Mark Paid Modal ═══════ */}
        {showPayModal !== null && (
          <div onClick={() => setShowPayModal(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#FBFBFB", borderRadius: "18px", border: `1px solid ${C.border}`, padding: "28px", maxWidth: "440px", width: "100%", boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${C.glow}` }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1A1313", margin: "0 0 20px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.green, verticalAlign: "middle", marginRight: "8px" }}>check_circle</span>
                Mark Q{showPayModal} as Paid
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div><label style={labelStyle}>Amount Paid</label><input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} style={inputStyle} placeholder="0.00" /></div>
                <div><label style={labelStyle}>IRS Confirmation Number (optional)</label><input type="text" value={payForm.confirmation} onChange={(e) => setPayForm({ ...payForm, confirmation: e.target.value })} style={inputStyle} placeholder="e.g., 1234-5678-9012" /></div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                <button onClick={() => setShowPayModal(null)} style={{ flex: 1, padding: "10px", borderRadius: "8px", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: `${C.stone}66`, fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleMarkPaid} style={{ flex: 1, padding: "10px", borderRadius: "8px", background: `linear-gradient(135deg, ${C.accent} 0%, ${C.bright} 100%)`, border: "none", color: "#1A1313", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", boxShadow: `0 2px 12px ${C.glow}` }}>Confirm Payment</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
