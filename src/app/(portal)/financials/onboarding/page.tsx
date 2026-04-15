"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const TOKENS = {
  bg: "#06080d",
  card: "#0d1117",
  border: "rgba(255,255,255,0.06)",
  borderLight: "rgba(255,255,255,0.08)",
  accent: "#7a8f96",
  accentHover: "#8fa3ab",
  inputBg: "rgba(255,255,255,0.04)",
  textPrimary: "#e6edf3",
  textSecondary: "rgba(255,255,255,0.5)",
  textMuted: "rgba(255,255,255,0.35)",
  danger: "#f85149",
  success: "#3fb950",
}

const LOCATIONS = [
  { id: "corpus-christi", name: "Corpus Christi", squareId: "LTJSA6QR1HGW6" },
  { id: "san-antonio", name: "San Antonio", squareId: "LXJYXDXWR0XZF" },
]

const MODEL_TYPES = [
  { value: "commission", label: "Commission-Based", desc: "Stylists earn a percentage of service revenue" },
  { value: "booth_rental", label: "Booth Rental", desc: "Stylists rent booth space at a fixed rate" },
  { value: "suite_rental", label: "Suite Rental", desc: "Stylists rent a private suite" },
  { value: "hybrid", label: "Hybrid", desc: "Combination of commission and rental" },
  { value: "w2_employee", label: "W-2 Employee", desc: "Stylists are salaried or hourly employees" },
]

const CC_EXPENSE_DEFAULTS = [
  { label: "Rent / Lease", category: "Rent & Lease" },
  { label: "Electricity", category: "Utilities" },
  { label: "Water / Sewer", category: "Utilities" },
  { label: "Internet / Phone", category: "Utilities" },
  { label: "Cleaning Service", category: "Repairs & Maintenance" },
  { label: "Supplies & Products", category: "Supplies & Products" },
]

const SA_EXPENSE_DEFAULTS = [
  { label: "Rent / Lease", category: "Rent & Lease" },
  { label: "Electricity", category: "Utilities" },
  { label: "Water / Sewer", category: "Utilities" },
  { label: "Internet / Phone", category: "Utilities" },
  { label: "Cleaning Service", category: "Repairs & Maintenance" },
  { label: "Supplies & Products", category: "Supplies & Products" },
]

const BIZ_EXPENSE_DEFAULTS = [
  { label: "Business Insurance", category: "Insurance" },
  { label: "Liability Insurance", category: "Insurance" },
  { label: "Marketing / Advertising", category: "Marketing & Advertising" },
  { label: "Software / Subscriptions", category: "Software & Subscriptions" },
  { label: "Accounting / Bookkeeping", category: "Professional Services" },
  { label: "Licenses & Permits", category: "Licenses & Permits" },
]

interface ExpenseRow { label: string; amount: string; category: string }

function initRows(defaults: { label: string; category: string }[]): ExpenseRow[] {
  return defaults.map(d => ({ label: d.label, amount: "", category: d.category }))
}

export default function FinancialOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Step 2 state
  const [ccModel, setCcModel] = useState("commission")
  const [saModel, setSaModel] = useState("booth_rental")
  const [ccCommission, setCcCommission] = useState("40")
  const [saCommission, setSaCommission] = useState("40")

  // Step 3-5 state
  const [ccExpenses, setCcExpenses] = useState<ExpenseRow[]>(initRows(CC_EXPENSE_DEFAULTS))
  const [saExpenses, setSaExpenses] = useState<ExpenseRow[]>(initRows(SA_EXPENSE_DEFAULTS))
  const [bizExpenses, setBizExpenses] = useState<ExpenseRow[]>(initRows(BIZ_EXPENSE_DEFAULTS))

  const TOTAL_STEPS = 6

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: TOKENS.inputBg,
    border: `1px solid ${TOKENS.borderLight}`,
    borderRadius: 8,
    color: TOKENS.textPrimary,
    fontSize: 14,
    outline: "none",
  }

  const cardStyle: React.CSSProperties = {
    background: TOKENS.card,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 12,
    padding: 24,
  }

  const btnPrimary: React.CSSProperties = {
    padding: "10px 24px",
    background: TOKENS.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  }

  const btnSecondary: React.CSSProperties = {
    padding: "10px 24px",
    background: "transparent",
    color: TOKENS.textSecondary,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  }

  async function saveBusinessModels() {
    setSaving(true)
    setError("")
    try {
      for (const loc of LOCATIONS) {
        const model = loc.id === "corpus-christi" ? ccModel : saModel
        const rate = loc.id === "corpus-christi" ? ccCommission : saCommission
        await fetch("/api/financials/business-model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId: loc.squareId,
            modelType: model,
            commissionRate: parseFloat(rate) / 100,
          }),
        })
      }
      setStep(3)
    } catch {
      setError("Failed to save business model. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function saveExpenses(rows: ExpenseRow[], locationId: string) {
    setSaving(true)
    setError("")
    try {
      const filled = rows.filter(r => r.amount && parseFloat(r.amount) > 0)
      for (const row of filled) {
        await fetch("/api/financials/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            date: new Date().toISOString(),
            vendor: row.label,
            description: `Monthly ${row.label}`,
            amount: parseFloat(row.amount),
            category: row.category,
            isRecurring: true,
            recurringFrequency: "monthly",
            taxDeductible: true,
          }),
        })
      }
      setStep(step + 1)
    } catch {
      setError("Failed to save expenses. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function completeOnboarding() {
    setSaving(true)
    setError("")
    try {
      for (const loc of LOCATIONS) {
        const model = loc.id === "corpus-christi" ? ccModel : saModel
        await fetch("/api/financials/business-model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId: loc.squareId,
            modelType: model,
            onboardingComplete: true,
          }),
        })
      }
      router.push("/financials")
    } catch {
      setError("Failed to complete setup. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  function updateExpenseRow(
    rows: ExpenseRow[],
    setRows: React.Dispatch<React.SetStateAction<ExpenseRow[]>>,
    index: number,
    field: keyof ExpenseRow,
    value: string
  ) {
    const updated = [...rows]
    updated[index] = { ...updated[index], [field]: value }
    setRows(updated)
  }

  function addExpenseRow(
    rows: ExpenseRow[],
    setRows: React.Dispatch<React.SetStateAction<ExpenseRow[]>>
  ) {
    setRows([...rows, { label: "", amount: "", category: "Miscellaneous" }])
  }

  function renderProgressBar() {
    return (
      <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < step ? TOKENS.accent : "rgba(255,255,255,0.08)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
    )
  }

  function renderExpenseForm(
    title: string,
    rows: ExpenseRow[],
    setRows: React.Dispatch<React.SetStateAction<ExpenseRow[]>>,
    locationId: string
  ) {
    const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: TOKENS.textPrimary, marginBottom: 8 }}>{title}</h2>
        <p style={{ color: TOKENS.textSecondary, fontSize: 14, marginBottom: 24 }}>
          Enter your typical monthly amounts. These will be automatically tracked each month.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                style={{ ...inputStyle, flex: 2 }}
                placeholder="Expense name"
                value={row.label}
                onChange={e => updateExpenseRow(rows, setRows, i, "label", e.target.value)}
              />
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TOKENS.textMuted, fontSize: 14 }}>$</span>
                <input
                  style={{ ...inputStyle, paddingLeft: 28 }}
                  type="number"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={e => updateExpenseRow(rows, setRows, i, "amount", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => addExpenseRow(rows, setRows)}
          style={{ ...btnSecondary, marginTop: 12, fontSize: 13 }}
        >
          + Add Row
        </button>
        {total > 0 && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(122,143,150,0.08)", borderRadius: 8, color: TOKENS.textPrimary, fontSize: 14 }}>
            Estimated monthly total: <strong>${total.toFixed(2)}</strong>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <button style={btnSecondary} onClick={() => setStep(step - 1)}>Back</button>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={btnSecondary} onClick={() => setStep(step + 1)}>Skip</button>
            <button
              style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
              disabled={saving}
              onClick={() => saveExpenses(rows, locationId)}
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: TOKENS.bg, padding: "40px 20px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {renderProgressBar()}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          {error && (
            <div style={{ padding: "10px 16px", background: "rgba(248,81,73,0.1)", border: `1px solid ${TOKENS.danger}`, borderRadius: 8, color: TOKENS.danger, fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: TOKENS.textPrimary, marginBottom: 8 }}>
                Financial Setup
              </h1>
              <p style={{ color: TOKENS.textSecondary, fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Let&apos;s set up your financial tracking. This will only take a few minutes.
              </p>
              <div style={{ ...cardStyle, background: "rgba(122,143,150,0.06)", marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: TOKENS.accent, marginBottom: 12 }}>
                  What we pull from Square automatically
                </h3>
                <ul style={{ color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
                  <li>Service revenue &amp; checkout counts</li>
                  <li>Tips, taxes, and discounts</li>
                  <li>Payment method breakdown (card vs cash)</li>
                  <li>Per-stylist revenue attribution</li>
                </ul>
              </div>
              <div style={{ ...cardStyle, background: "rgba(122,143,150,0.06)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: TOKENS.accent, marginBottom: 12 }}>
                  What we need from you
                </h3>
                <ul style={{ color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
                  <li>Business model per location (commission, booth rental, etc.)</li>
                  <li>Monthly recurring expenses (rent, utilities, insurance)</li>
                </ul>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
                <button style={btnPrimary} onClick={() => setStep(2)}>Get Started</button>
              </div>
            </div>
          )}

          {/* Step 2: Business Structure */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: TOKENS.textPrimary, marginBottom: 8 }}>
                Business Structure
              </h2>
              <p style={{ color: TOKENS.textSecondary, fontSize: 14, marginBottom: 24 }}>
                Select the business model for each location.
              </p>
              {LOCATIONS.map((loc, li) => {
                const model = li === 0 ? ccModel : saModel
                const setModel = li === 0 ? setCcModel : setSaModel
                const commission = li === 0 ? ccCommission : saCommission
                const setCommission = li === 0 ? setCcCommission : setSaCommission
                return (
                  <div key={loc.id} style={{ marginBottom: li === 0 ? 28 : 0 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: TOKENS.textPrimary, marginBottom: 12 }}>{loc.name}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {MODEL_TYPES.map(mt => (
                        <label
                          key={mt.value}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "12px 16px",
                            background: model === mt.value ? "rgba(122,143,150,0.12)" : TOKENS.inputBg,
                            border: `1px solid ${model === mt.value ? TOKENS.accent : TOKENS.borderLight}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          <input
                            type="radio"
                            name={`model-${loc.id}`}
                            value={mt.value}
                            checked={model === mt.value}
                            onChange={() => setModel(mt.value)}
                            style={{ accentColor: TOKENS.accent }}
                          />
                          <div>
                            <div style={{ color: TOKENS.textPrimary, fontSize: 14, fontWeight: 500 }}>{mt.label}</div>
                            <div style={{ color: TOKENS.textMuted, fontSize: 12 }}>{mt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    {(model === "commission" || model === "hybrid") && (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ color: TOKENS.textSecondary, fontSize: 13, display: "block", marginBottom: 6 }}>
                          Commission Rate (%)
                        </label>
                        <input
                          style={{ ...inputStyle, maxWidth: 120 }}
                          type="number"
                          value={commission}
                          onChange={e => setCommission(e.target.value)}
                          min="0"
                          max="100"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                <button style={btnSecondary} onClick={() => setStep(1)}>Back</button>
                <button
                  style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
                  disabled={saving}
                  onClick={saveBusinessModels}
                >
                  {saving ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: CC Monthly Expenses */}
          {step === 3 && renderExpenseForm(
            "Corpus Christi — Monthly Expenses",
            ccExpenses,
            setCcExpenses,
            LOCATIONS[0].squareId
          )}

          {/* Step 4: SA Monthly Expenses */}
          {step === 4 && renderExpenseForm(
            "San Antonio — Monthly Expenses",
            saExpenses,
            setSaExpenses,
            LOCATIONS[1].squareId
          )}

          {/* Step 5: Business-wide Expenses */}
          {step === 5 && renderExpenseForm(
            "Business-wide Expenses",
            bizExpenses,
            setBizExpenses,
            LOCATIONS[0].squareId
          )}

          {/* Step 6: Review & Complete */}
          {step === 6 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: TOKENS.textPrimary, marginBottom: 8 }}>
                Review & Complete
              </h2>
              <p style={{ color: TOKENS.textSecondary, fontSize: 14, marginBottom: 24 }}>
                Here&apos;s a summary of your financial setup.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Business Models */}
                <div style={{ ...cardStyle, background: "rgba(122,143,150,0.06)" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: TOKENS.accent, marginBottom: 12 }}>Business Models</h3>
                  {LOCATIONS.map((loc, i) => {
                    const model = i === 0 ? ccModel : saModel
                    const rate = i === 0 ? ccCommission : saCommission
                    const mt = MODEL_TYPES.find(m => m.value === model)
                    return (
                      <div key={loc.id} style={{ color: TOKENS.textSecondary, fontSize: 14, marginBottom: 4 }}>
                        <strong style={{ color: TOKENS.textPrimary }}>{loc.name}:</strong> {mt?.label}
                        {(model === "commission" || model === "hybrid") && ` (${rate}%)`}
                      </div>
                    )
                  })}
                </div>

                {/* Expense summaries */}
                {[
                  { title: "Corpus Christi Expenses", rows: ccExpenses },
                  { title: "San Antonio Expenses", rows: saExpenses },
                  { title: "Business-wide Expenses", rows: bizExpenses },
                ].map(section => {
                  const filled = section.rows.filter(r => r.amount && parseFloat(r.amount) > 0)
                  const total = filled.reduce((s, r) => s + parseFloat(r.amount), 0)
                  return (
                    <div key={section.title} style={{ ...cardStyle, background: "rgba(122,143,150,0.06)" }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: TOKENS.accent, marginBottom: 12 }}>{section.title}</h3>
                      {filled.length === 0 ? (
                        <div style={{ color: TOKENS.textMuted, fontSize: 13 }}>No expenses entered (skipped)</div>
                      ) : (
                        <>
                          {filled.map((r, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", color: TOKENS.textSecondary, fontSize: 14, marginBottom: 4 }}>
                              <span>{r.label}</span>
                              <span>${parseFloat(r.amount).toFixed(2)}/mo</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${TOKENS.border}`, display: "flex", justifyContent: "space-between", color: TOKENS.textPrimary, fontSize: 14, fontWeight: 600 }}>
                            <span>Total</span>
                            <span>${total.toFixed(2)}/mo</span>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                <button style={btnSecondary} onClick={() => setStep(5)}>Back</button>
                <button
                  style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, padding: "12px 32px", fontSize: 15 }}
                  disabled={saving}
                  onClick={completeOnboarding}
                >
                  {saving ? "Completing..." : "Complete Setup"}
                </button>
              </div>
            </div>
          )}
        </div>
        <p style={{ textAlign: "center", color: TOKENS.textMuted, fontSize: 12, marginTop: 16 }}>
          Step {step} of {TOTAL_STEPS} — You can update these settings anytime from the Financials page.
        </p>
      </div>
    </div>
  )
}
