"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"

type Receipt = {
  id: string
  vendor: string
  amount: number
  category: string
  description: string
  receiptDate: string
  isDeductible: boolean
  aiAnalysis: string
  taxYear: number
  createdAt: string
}

type MileageLogEntry = {
  id: string
  date: string
  purpose: string
  miles: number
  amount: number
  notes: string | null
  taxYear: number
}

const TABS = ["Dashboard", "Receipts", "Mileage", "Quarterly Taxes", "Deductions Guide"]

const CATEGORY_COLORS: Record<string, string> = {
  Supplies: "#22c55e",
  Equipment: "#3b82f6",
  Education: "#a855f7",
  Travel: "#f97316",
  Marketing: "#ec4899",
  Office: "#06b6d4",
  Insurance: "#eab308",
  Licensing: "#8b5cf6",
  Software: "#14b8a6",
  Other: "#6b7280",
}

const DEDUCTION_CATEGORIES = [
  {
    title: "Booth/Chair Rental",
    icon: "chair",
    items: [
      "Weekly or monthly booth rental fees",
      "Station rental agreements",
      "Shared space rental costs",
      "Commission splits (1099 stylists)",
    ],
  },
  {
    title: "Supplies & Products",
    icon: "inventory_2",
    items: [
      "Hair color, developer, toner",
      "Shampoo, conditioner, treatments",
      "Styling products (gel, mousse, spray)",
      "Foils, caps, clips, pins, rubber bands",
      "Gloves, capes, towels, neck strips",
      "Cleaning supplies for your station",
    ],
  },
  {
    title: "Tools & Equipment",
    icon: "content_cut",
    items: [
      "Shears, razors, clippers, trimmers",
      "Blow dryers, flat irons, curling irons",
      "Brushes, combs, rollers",
      "Salon chair (if you own it)",
      "Mirrors, stations, carts",
      "Wash bowl/shampoo bowl",
      "Equipment repairs and maintenance",
    ],
  },
  {
    title: "Education & Training",
    icon: "school",
    items: [
      "Continuing education courses",
      "Hair shows and conventions",
      "Certification classes",
      "Online training subscriptions",
      "Trade publications and books",
      "Workshops and seminars",
    ],
  },
  {
    title: "Licensing & Insurance",
    icon: "verified_user",
    items: [
      "Cosmetology license renewal",
      "TDLR license fees (Texas)",
      "Professional liability insurance",
      "Business insurance premiums",
      "Bonding fees",
    ],
  },
  {
    title: "Marketing & Advertising",
    icon: "campaign",
    items: [
      "Business cards and flyers",
      "Website hosting and domain",
      "Social media advertising (Instagram, Facebook)",
      "Photography for portfolio",
      "Booking platform fees (Vagaro, Square, etc.)",
      "Signage and branding materials",
    ],
  },
  {
    title: "Vehicle & Mileage",
    icon: "directions_car",
    items: [
      "Mileage to/from salon (if not primary workplace)",
      "Mileage to supply stores",
      "Mileage to education events",
      "Mileage to client locations (mobile stylist)",
      "2025 IRS rate: $0.70/mile",
      "Parking fees and tolls (business-related)",
    ],
  },
  {
    title: "Technology & Software",
    icon: "devices",
    items: [
      "Phone bill (business use percentage)",
      "Internet bill (business use percentage)",
      "Booking/scheduling software",
      "Accounting software (QuickBooks, etc.)",
      "POS system fees",
      "iPad or tablet for business",
    ],
  },
  {
    title: "Office & Administrative",
    icon: "business_center",
    items: [
      "Business bank account fees",
      "Credit card processing fees",
      "Postage and shipping",
      "Office supplies (pens, paper, planner)",
      "Business phone line",
      "Professional memberships and dues",
    ],
  },
  {
    title: "Apparel & Appearance",
    icon: "checkroom",
    items: [
      "Uniforms or aprons (with salon logo)",
      "Non-slip work shoes",
      "Protective smocks",
      "Laundry costs for work uniforms",
      "Note: Regular clothing is NOT deductible",
    ],
  },
  {
    title: "Health & Wellness",
    icon: "health_and_safety",
    items: [
      "Health insurance premiums (self-employed deduction)",
      "HSA contributions",
      "Ergonomic equipment (anti-fatigue mat, wrist brace)",
      "Note: Only if self-employed and not eligible for employer plan",
    ],
  },
  {
    title: "Retirement",
    icon: "savings",
    items: [
      "SEP IRA contributions (up to 25% of net income)",
      "Solo 401(k) contributions",
      "SIMPLE IRA contributions",
      "Note: Reduces taxable income significantly",
    ],
  },
]

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
  const [mileageForm, setMileageForm] = useState({ date: "", purpose: "", miles: "", notes: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentYear = new Date().getFullYear()

  // Check access
  useEffect(() => {
    fetch("/api/suite/subscription")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasAccess && !isOwner) {
          router.push("/suite")
          return
        }
        setHasAccess(true)
        setLoading(false)
      })
      .catch(() => router.push("/suite"))
  }, [isOwner, router])

  // Load data
  useEffect(() => {
    if (!hasAccess && !isOwner) return
    fetch(`/api/suite/tax/receipts?year=${currentYear}`)
      .then((r) => r.json())
      .then((data) => setReceipts(data.receipts || []))
      .catch(() => {})

    fetch(`/api/suite/tax/mileage?year=${currentYear}`)
      .then((r) => r.json())
      .then((data) => {
        setMileageLogs(data.logs || [])
        setTotalMiles(data.totalMiles || 0)
        setTotalMileageAmount(data.totalAmount || 0)
      })
      .catch(() => {})
  }, [hasAccess, isOwner, currentYear])

  const handleScanReceipt = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = reader.result as string
        const res = await fetch("/api/suite/tax/scan-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: base64 }),
        })
        const data = await res.json()
        if (data.receipt) {
          setReceipts((prev) => [data.receipt, ...prev])
          setTab(1) // Switch to receipts tab
        }
      } catch {
        // handle error
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleLogMileage = useCallback(async () => {
    if (!mileageForm.date || !mileageForm.purpose || !mileageForm.miles) return

    try {
      const res = await fetch("/api/suite/tax/mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: mileageForm.date,
          purpose: mileageForm.purpose,
          miles: parseFloat(mileageForm.miles),
          notes: mileageForm.notes || undefined,
        }),
      })
      const data = await res.json()
      if (data.log) {
        setMileageLogs((prev) => [data.log, ...prev])
        setTotalMiles((prev) => prev + data.log.miles)
        setTotalMileageAmount((prev) => prev + data.log.amount)
        setShowMileageModal(false)
        setMileageForm({ date: "", purpose: "", miles: "", notes: "" })
      }
    } catch {
      // handle error
    }
  }, [mileageForm])

  // Calculations
  const totalDeductions = receipts.filter((r) => r.isDeductible).reduce((sum, r) => sum + (r.amount || 0), 0) + totalMileageAmount
  const estimatedIncome = 75000 // Placeholder; would come from actual data
  const taxableIncome = Math.max(0, estimatedIncome - totalDeductions)
  const selfEmploymentTax = taxableIncome * 0.9235 * 0.153
  const federalIncomeTax = taxableIncome * 0.22 // Estimated bracket
  const totalEstimatedTax = selfEmploymentTax + federalIncomeTax
  const quarterlyPayment = totalEstimatedTax / 4

  const categoryBreakdown = receipts
    .filter((r) => r.isDeductible)
    .reduce((acc: Record<string, number>, r) => {
      const cat = r.category || "Other"
      acc[cat] = (acc[cat] || 0) + (r.amount || 0)
      return acc
    }, {})

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "rgba(205,201,192,0.5)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>progress_activity</span>
        <p style={{ marginTop: "12px", fontSize: "13px" }}>Loading StyleTax...</p>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "rgba(205,201,192,0.06)",
    border: "1px solid rgba(205,201,192,0.15)",
    color: "#FFFFFF",
    fontSize: "13px",
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "rgba(205,201,192,0.5)",
    marginBottom: "6px",
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

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
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleScanReceipt}
            disabled={scanning}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              backgroundColor: scanning ? "rgba(34,197,94,0.3)" : "#22c55e",
              border: "none",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: scanning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              {scanning ? "progress_activity" : "document_scanner"}
            </span>
            {scanning ? "Scanning..." : "Scan Receipt"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: "4px",
        marginBottom: "24px",
        overflowX: "auto",
        borderBottom: "1px solid rgba(205,201,192,0.1)",
        paddingBottom: "0",
      }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              padding: "10px 16px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: tab === i ? "#22c55e" : "rgba(205,201,192,0.5)",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: tab === i ? "2px solid #22c55e" : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ═══════ TAB 0: Dashboard ═══════ */}
      {tab === 0 && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
            {[
              { label: "YTD Income (Est.)", value: `$${estimatedIncome.toLocaleString()}`, color: "#FFFFFF", icon: "payments" },
              { label: "Total Deductions", value: `$${totalDeductions.toFixed(2)}`, color: "#22c55e", icon: "savings" },
              { label: "Taxable Income", value: `$${taxableIncome.toLocaleString()}`, color: "#f97316", icon: "account_balance" },
              { label: "Quarterly Payment", value: `$${quarterlyPayment.toFixed(0)}`, color: "#3b82f6", icon: "calendar_month" },
            ].map((kpi) => (
              <div key={kpi.label} style={{
                padding: "20px",
                borderRadius: "12px",
                backgroundColor: "rgba(205,201,192,0.04)",
                border: "1px solid rgba(205,201,192,0.1)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: kpi.color }}>{kpi.icon}</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)" }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Scan Receipt CTA */}
          <div style={{
            padding: "24px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)",
            border: "1px solid rgba(34,197,94,0.2)",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "#22c55e" }}>document_scanner</span>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>Scan a Receipt</div>
              <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)" }}>
                Take a photo or upload a receipt image. Our AI will automatically extract vendor, amount, and categorize it for tax deductions.
              </div>
            </div>
            <button
              onClick={handleScanReceipt}
              disabled={scanning}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                backgroundColor: "#22c55e",
                border: "none",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: scanning ? "not-allowed" : "pointer",
              }}
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>

          {/* Deduction Breakdown */}
          <div style={{
            padding: "24px",
            borderRadius: "12px",
            backgroundColor: "rgba(205,201,192,0.04)",
            border: "1px solid rgba(205,201,192,0.1)",
          }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginTop: 0, marginBottom: "16px" }}>Deduction Breakdown by Category</h3>
            {Object.keys(categoryBreakdown).length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "rgba(205,201,192,0.4)", fontSize: "13px" }}>
                No deductions recorded yet. Scan your first receipt to get started.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Object.entries(categoryBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: CATEGORY_COLORS[cat] || "#6b7280",
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, fontSize: "13px", color: "rgba(205,201,192,0.7)" }}>{cat}</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>${amount.toFixed(2)}</div>
                    </div>
                  ))}
                {totalMileageAmount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#f97316", flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: "13px", color: "rgba(205,201,192,0.7)" }}>Mileage</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>${totalMileageAmount.toFixed(2)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ TAB 1: Receipts ═══════ */}
      {tab === 1 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.5)" }}>{receipts.length} receipt{receipts.length !== 1 ? "s" : ""} this year</div>
            <button
              onClick={handleScanReceipt}
              disabled={scanning}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                backgroundColor: "#22c55e",
                border: "none",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 700,
                cursor: scanning ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
              Scan Receipt
            </button>
          </div>

          {receipts.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "48px 20px",
              borderRadius: "12px",
              backgroundColor: "rgba(205,201,192,0.04)",
              border: "1px solid rgba(205,201,192,0.08)",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)" }}>receipt_long</span>
              <p style={{ color: "rgba(205,201,192,0.4)", fontSize: "13px", marginTop: "12px" }}>No receipts yet. Scan your first receipt to start tracking deductions.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {receipts.map((r) => (
                <div key={r.id} style={{
                  padding: "16px 20px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(205,201,192,0.04)",
                  border: "1px solid rgba(205,201,192,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "24px", color: CATEGORY_COLORS[r.category] || "#6b7280" }}>receipt</span>
                  <div style={{ flex: 1, minWidth: "150px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{r.vendor}</div>
                    <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginTop: "2px" }}>{r.description}</div>
                  </div>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: "20px",
                    backgroundColor: `${CATEGORY_COLORS[r.category] || "#6b7280"}20`,
                    color: CATEGORY_COLORS[r.category] || "#6b7280",
                    fontSize: "10px",
                    fontWeight: 700,
                  }}>
                    {r.category}
                  </span>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: r.isDeductible ? "#22c55e" : "#FFFFFF", minWidth: "80px", textAlign: "right" }}>
                    ${(r.amount || 0).toFixed(2)}
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
          {/* Mileage Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(205,201,192,0.1)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>Total Miles</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF" }}>{totalMiles.toFixed(1)}</div>
            </div>
            <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(205,201,192,0.1)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>Total Deduction</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#22c55e" }}>${totalMileageAmount.toFixed(2)}</div>
            </div>
            <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(205,201,192,0.1)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.5)", marginBottom: "8px" }}>IRS Rate (2025)</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#f97316" }}>$0.70/mi</div>
            </div>
          </div>

          {/* Log Trip Button */}
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={() => setShowMileageModal(true)}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                backgroundColor: "#f97316",
                border: "none",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
              Log Trip
            </button>
          </div>

          {/* Trip List */}
          {mileageLogs.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "48px 20px",
              borderRadius: "12px",
              backgroundColor: "rgba(205,201,192,0.04)",
              border: "1px solid rgba(205,201,192,0.08)",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)" }}>directions_car</span>
              <p style={{ color: "rgba(205,201,192,0.4)", fontSize: "13px", marginTop: "12px" }}>No trips logged yet. Start tracking your business mileage.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {mileageLogs.map((log) => (
                <div key={log.id} style={{
                  padding: "16px 20px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(205,201,192,0.04)",
                  border: "1px solid rgba(205,201,192,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#f97316" }}>directions_car</span>
                  <div style={{ flex: 1, minWidth: "150px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{log.purpose}</div>
                    {log.notes && <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginTop: "2px" }}>{log.notes}</div>}
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.6)" }}>{log.miles.toFixed(1)} mi</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#22c55e", minWidth: "70px", textAlign: "right" }}>${log.amount.toFixed(2)}</div>
                  <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)", minWidth: "80px", textAlign: "right" }}>
                    {new Date(log.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ TAB 3: Quarterly Taxes ═══════ */}
      {tab === 3 && (
        <div>
          <div style={{
            padding: "20px",
            borderRadius: "12px",
            backgroundColor: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            marginBottom: "24px",
          }}>
            <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", marginBottom: "4px" }}>
              Texas has NO state income tax. You only owe federal taxes + self-employment tax.
            </div>
          </div>

          {/* Quarter Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
            {[
              { q: "Q1", due: "April 15, 2025", months: "Jan - Mar" },
              { q: "Q2", due: "June 15, 2025", months: "Apr - May" },
              { q: "Q3", due: "September 15, 2025", months: "Jun - Aug" },
              { q: "Q4", due: "January 15, 2026", months: "Sep - Dec" },
            ].map((quarter) => (
              <div key={quarter.q} style={{
                padding: "20px",
                borderRadius: "12px",
                backgroundColor: "rgba(205,201,192,0.04)",
                border: "1px solid rgba(205,201,192,0.1)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: "20px",
                    backgroundColor: "rgba(59,130,246,0.15)",
                    color: "#3b82f6",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}>
                    {quarter.q}
                  </span>
                  <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)" }}>{quarter.months}</span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", marginBottom: "4px" }}>${quarterlyPayment.toFixed(0)}</div>
                <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginBottom: "12px" }}>Due: {quarter.due}</div>
                <a
                  href="https://www.irs.gov/payments/direct-pay"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.2)",
                    color: "#3b82f6",
                    textDecoration: "none",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                  IRS Direct Pay
                </a>
              </div>
            ))}
          </div>

          {/* Full Tax Estimate Breakdown */}
          <div style={{
            padding: "24px",
            borderRadius: "12px",
            backgroundColor: "rgba(205,201,192,0.04)",
            border: "1px solid rgba(205,201,192,0.1)",
          }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 16px" }}>Estimated Tax Breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Estimated Gross Income", value: `$${estimatedIncome.toLocaleString()}`, color: "#FFFFFF" },
                { label: "Total Deductions", value: `-$${totalDeductions.toFixed(2)}`, color: "#22c55e" },
                { label: "Taxable Income", value: `$${taxableIncome.toLocaleString()}`, color: "#FFFFFF", bold: true },
                { label: "Self-Employment Tax (15.3%)", value: `$${selfEmploymentTax.toFixed(0)}`, color: "#f97316" },
                { label: "Federal Income Tax (Est. 22%)", value: `$${federalIncomeTax.toFixed(0)}`, color: "#f97316" },
                { label: "State Income Tax (Texas)", value: "$0", color: "#22c55e" },
                { label: "Total Estimated Annual Tax", value: `$${totalEstimatedTax.toFixed(0)}`, color: "#ef4444", bold: true },
                { label: "Quarterly Payment", value: `$${quarterlyPayment.toFixed(0)}`, color: "#3b82f6", bold: true },
              ].map((row) => (
                <div key={row.label} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: row.bold ? "10px 0" : "4px 0",
                  borderTop: row.bold ? "1px solid rgba(205,201,192,0.1)" : "none",
                }}>
                  <span style={{ fontSize: "13px", color: "rgba(205,201,192,0.6)", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                  <span style={{ fontSize: row.bold ? "16px" : "13px", fontWeight: row.bold ? 800 : 600, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "8px", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.6)" }}>
                These are estimates based on a 22% federal bracket. Actual taxes depend on your total income, filing status, and other factors. Consult a tax professional for precise calculations.
              </div>
            </div>
          </div>

          {/* Useful IRS Links */}
          <div style={{ marginTop: "20px", padding: "20px", borderRadius: "12px", backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(205,201,192,0.1)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 12px" }}>Useful IRS Resources</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                { label: "IRS Direct Pay", url: "https://www.irs.gov/payments/direct-pay" },
                { label: "Form 1040-ES", url: "https://www.irs.gov/forms-pubs/about-form-1040-es" },
                { label: "Schedule C", url: "https://www.irs.gov/forms-pubs/about-schedule-c-form-1040" },
                { label: "Schedule SE", url: "https://www.irs.gov/forms-pubs/about-schedule-se-form-1040" },
                { label: "Business Use of Car", url: "https://www.irs.gov/taxtopics/tc510" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    backgroundColor: "rgba(205,201,192,0.06)",
                    border: "1px solid rgba(205,201,192,0.12)",
                    color: "#3b82f6",
                    textDecoration: "none",
                    fontSize: "11px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>open_in_new</span>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TAB 4: Deductions Guide ═══════ */}
      {tab === 4 && (
        <div>
          <div style={{
            padding: "16px 20px",
            borderRadius: "12px",
            backgroundColor: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.15)",
            marginBottom: "24px",
          }}>
            <div style={{ fontSize: "13px", color: "rgba(205,201,192,0.7)" }}>
              As an independent stylist (1099 contractor), you can deduct ordinary and necessary business expenses. Keep receipts for everything and track mileage daily.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
            {DEDUCTION_CATEGORIES.map((cat) => (
              <div key={cat.title} style={{
                padding: "20px",
                borderRadius: "12px",
                backgroundColor: "rgba(205,201,192,0.04)",
                border: "1px solid rgba(205,201,192,0.1)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#22c55e" }}>{cat.icon}</span>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>{cat.title}</h4>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {cat.items.map((item, i) => {
                    const isNote = item.startsWith("Note:")
                    return (
                      <li key={i} style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        padding: "4px 0",
                        fontSize: "12px",
                        color: isNote ? "#eab308" : "rgba(205,201,192,0.6)",
                        fontStyle: isNote ? "italic" : "normal",
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "12px", marginTop: "2px", color: isNote ? "#eab308" : "rgba(34,197,94,0.5)" }}>
                          {isNote ? "info" : "check"}
                        </span>
                        {item}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ Mileage Modal ═══════ */}
      {showMileageModal && (
        <div
          onClick={() => setShowMileageModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#1a2a32",
              borderRadius: "16px",
              border: "1px solid rgba(205,201,192,0.15)",
              padding: "28px",
              maxWidth: "440px",
              width: "100%",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 20px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#f97316", verticalAlign: "middle", marginRight: "8px" }}>directions_car</span>
              Log Business Trip
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={mileageForm.date}
                  onChange={(e) => setMileageForm({ ...mileageForm, date: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Purpose</label>
                <input
                  type="text"
                  placeholder="e.g., Drive to Sally Beauty Supply"
                  value={mileageForm.purpose}
                  onChange={(e) => setMileageForm({ ...mileageForm, purpose: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Miles</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 12.5"
                  value={mileageForm.miles}
                  onChange={(e) => setMileageForm({ ...mileageForm, miles: e.target.value })}
                  style={inputStyle}
                />
                {mileageForm.miles && (
                  <div style={{ fontSize: "12px", color: "#22c55e", marginTop: "6px" }}>
                    Deduction: ${(parseFloat(mileageForm.miles) * 0.70).toFixed(2)}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <input
                  type="text"
                  placeholder="Any additional details"
                  value={mileageForm.notes}
                  onChange={(e) => setMileageForm({ ...mileageForm, notes: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <button
                onClick={() => setShowMileageModal(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  border: "1px solid rgba(205,201,192,0.15)",
                  color: "rgba(205,201,192,0.5)",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogMileage}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  backgroundColor: "#f97316",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Save Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
