"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useUserRole } from "@/hooks/useUserRole"

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const BORDER = "rgba(255,255,255,0.07)"
const BORDER2 = "rgba(255,255,255,0.12)"
const S1 = "rgba(255,255,255,0.03)"
const S2 = "rgba(255,255,255,0.05)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#10B981"
const BLUE = "#4da6ff"
const AMBER = "#ffb347"

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "credit_score" },
  { id: "tracker", label: "Credit Builder", icon: "trending_up" },
  { id: "income", label: "Income Letters", icon: "description" },
  { id: "action", label: "Action Plan", icon: "checklist" },
  { id: "dispute", label: "Dispute Letters", icon: "gavel" },
]

const SCORE_TIERS = [
  { label: "Poor", range: "300\u2013579", color: "#ff6b6b", min: 300, max: 579 },
  { label: "Fair", range: "580\u2013669", color: AMBER, min: 580, max: 669 },
  { label: "Good", range: "670\u2013739", color: "#facc15", min: 670, max: 739 },
  { label: "Very Good", range: "740\u2013799", color: GREEN, min: 740, max: 799 },
  { label: "Exceptional", range: "800\u2013850", color: BLUE, min: 800, max: 850 },
]

const ERROR_TYPES = [
  { id: "not_mine", label: "Account is not mine" },
  { id: "wrong_balance", label: "Wrong balance reported" },
  { id: "duplicate", label: "Duplicate account" },
  { id: "wrong_status", label: "Wrong account status" },
  { id: "identity_theft", label: "Identity theft" },
  { id: "other", label: "Other error" },
]

type CreditProfile = {
  id: string
  currentScore: number | null
  scoreHistory: Array<{ date: string; score: number }> | null
  tier: string | null
  totalPaymentsReported: number
}

type DisputeLetterRecord = {
  id: string
  bureau: string
  creditorName: string
  accountNumber: string | null
  errorType: string
  description: string
  letterContent: string
  status: string
  createdAt: string
}

export default function StyleCreditPage() {
  const { isOwner } = useUserRole()
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [profile, setProfile] = useState<CreditProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthsSubscribed, setMonthsSubscribed] = useState(0)
  const [paymentsReported, setPaymentsReported] = useState(0)
  const [estimatedGain, setEstimatedGain] = useState(0)
  const [disputeLetters, setDisputeLetters] = useState<DisputeLetterRecord[]>([])

  // Score input
  const [scoreInput, setScoreInput] = useState("")
  const [savingScore, setSavingScore] = useState(false)

  // Dispute form
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeForm, setDisputeForm] = useState({
    bureau: "experian",
    creditorName: "",
    accountNumber: "",
    errorType: "not_mine",
    description: "",
  })
  const [generatingDispute, setGeneratingDispute] = useState(false)

  // Income letter
  const [generatingIncome, setGeneratingIncome] = useState(false)
  const [incomePurpose, setIncomePurpose] = useState("apartment")
  const [generatedLetter, setGeneratedLetter] = useState("")
  const [showLetterModal, setShowLetterModal] = useState(false)

  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    if (isOwner) { setHasAccess(true); loadData(); return }
    fetch("/api/suite/subscription")
      .then(r => r.json())
      .then(data => {
        if (data.hasAccess) { setHasAccess(true); loadData() }
        else { setHasAccess(false); setLoading(false) }
      })
      .catch(() => { setHasAccess(true); loadData() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [profileRes, disputeRes] = await Promise.all([
        fetch("/api/suite/credit/profile"),
        fetch("/api/suite/credit/dispute"),
      ])
      const profileData = await profileRes.json()
      const disputeData = await disputeRes.json()
      setProfile(profileData.profile)
      setMonthsSubscribed(profileData.monthsSubscribed || 0)
      setPaymentsReported(profileData.paymentsReported || 0)
      setEstimatedGain(profileData.estimatedGain || 0)
      setDisputeLetters(disputeData.letters || [])
      if (profileData.profile?.currentScore) {
        setScoreInput(profileData.profile.currentScore.toString())
      }
    } catch {
      // Failed to load
    }
    setLoading(false)
  }

  const saveScore = async () => {
    if (!scoreInput) return
    setSavingScore(true)
    const score = parseInt(scoreInput)
    const history = profile?.scoreHistory || []
    const newHistory = [...history, { date: new Date().toISOString(), score }]
    await fetch("/api/suite/credit/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentScore: score, scoreHistory: newHistory }),
    })
    setProfile((p) =>
      p ? { ...p, currentScore: score, scoreHistory: newHistory } : p
    )
    setSavingScore(false)
  }

  const generateDisputeLetter = async () => {
    if (!disputeForm.creditorName || !disputeForm.description) return
    setGeneratingDispute(true)
    const res = await fetch("/api/suite/credit/dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(disputeForm),
    })
    const data = await res.json()
    if (data.letter) {
      setDisputeLetters((prev) => [data.letter, ...prev])
      setShowDisputeForm(false)
      setDisputeForm({
        bureau: "experian",
        creditorName: "",
        accountNumber: "",
        errorType: "not_mine",
        description: "",
      })
    }
    setGeneratingDispute(false)
  }

  const generateIncomeLetter = async () => {
    setGeneratingIncome(true)
    const res = await fetch("/api/suite/credit/income-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: incomePurpose }),
    })
    const data = await res.json()
    if (data.letter) {
      setGeneratedLetter(data.letter)
      setShowLetterModal(true)
    }
    setGeneratingIncome(false)
  }

  const downloadLetter = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentScore = profile?.currentScore ?? 0
  const scoreTier = SCORE_TIERS.find(
    (t) => currentScore >= t.min && currentScore <= t.max
  )
  const projectedScore = currentScore
    ? Math.min(850, currentScore + estimatedGain)
    : null
  const scoreBarWidth = currentScore
    ? ((currentScore - 300) / 550) * 100
    : 0

  const mono: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
  }
  const jakarta: React.CSSProperties = {
    fontFamily: "'Inter', -apple-system, sans-serif",
  }
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: `1px solid ${BORDER2}`,
    borderRadius: "8px",
    color: "#FBFBFB",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
    ...jakarta,
  }
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "9px",
    fontWeight: 700,
    color: MUTED,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    marginBottom: "6px",
    ...mono,
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 500 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 60, background: "#1a2a32", border: "1px solid rgba(205,201,192,0.12)", borderRadius: 10, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 700, color: "#FBFBFB", marginBottom: 8 }}>StyleCredit</div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#7a8f96", marginBottom: 24, textAlign: "center" }}>Subscribe to Envy Suite to access this feature</div>
        <button onClick={() => router.push("/suite")} style={{ background: "transparent", border: "1px solid #606E74", color: "#7a8f96", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>View Plans</button>
      </div>
    )
  }

  return (
    <div
      style={{
        ...jakarta,
        minHeight: "100vh",
        backgroundColor: "#06080d",
        color: "#fff",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "400px",
          background: `radial-gradient(ellipse at 50% 0%, ${ACC_DIM} 0%, transparent 65%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "clamp(24px,4vw,48px) clamp(16px,4vw,32px)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "28px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => router.push("/suite")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              color: MUTED,
              background: "none",
              border: "none",
              cursor: "pointer",
              ...jakarta,
            }}
          >
            &larr; Envy Suite
          </button>
          <span style={{ color: BORDER, fontSize: "12px" }}>&rsaquo;</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "5px",
                background: "rgba(77,166,255,0.1)",
                border: "1px solid rgba(77,166,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "14px", color: BLUE }}
              >
                credit_score
              </span>
            </div>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              StyleCredit
            </span>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            {paymentsReported > 0 && (
              <span
                style={{
                  ...mono,
                  fontSize: "9px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  background: "rgba(77,166,255,0.08)",
                  border: "1px solid rgba(77,166,255,0.2)",
                  color: BLUE,
                }}
              >
                {paymentsReported} payments reported
              </span>
            )}
          </div>
        </div>

        {/* COMING SOON BANNER */}
        <div
          style={{
            padding: "16px 20px",
            background: ACC_DIM,
            border: `1px solid ${ACC_BORDER}`,
            borderRadius: "10px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "20px", color: ACC_BRIGHT, flexShrink: 0 }}
          >
            sync
          </span>
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#fff",
                marginBottom: "4px",
              }}
            >
              Credit reporting launching soon
            </div>
            <div
              style={{ fontSize: "12px", color: MID, lineHeight: 1.6 }}
            >
              Your StyleSuite payments are being{" "}
              <strong style={{ color: ACC_BRIGHT }}>
                queued for reporting
              </strong>{" "}
              to Experian, TransUnion, and Equifax. Once our bureau partnership
              launches, every payment you&apos;ve made will be reported
              simultaneously &mdash; giving you immediate credit history. Your
              payments are already working for you.
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: "1px",
            background: S1,
            border: `1px solid ${BORDER}`,
            borderRadius: "9px",
            padding: "3px",
            marginBottom: "20px",
            overflowX: "auto",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: "6px",
                border:
                  activeTab === tab.id
                    ? `1px solid ${ACC_BORDER}`
                    : "1px solid transparent",
                background:
                  activeTab === tab.id
                    ? `linear-gradient(135deg, rgba(122,143,150,0.15), rgba(96,110,116,0.08))`
                    : "transparent",
                color: activeTab === tab.id ? "#fff" : MUTED,
                fontSize: "9px",
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                ...mono,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            style={{ textAlign: "center", padding: "60px", color: MUTED }}
          >
            Loading your credit profile...
          </div>
        ) : (
          <>
            {/* ═══ DASHBOARD TAB ═══ */}
            {activeTab === "dashboard" && (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  {/* Current score card */}
                  <div
                    style={{
                      background: S1,
                      border: `1px solid ${BORDER2}`,
                      borderRadius: "12px",
                      padding: "24px",
                    }}
                  >
                    <div
                      style={{
                        ...mono,
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: MUTED,
                        marginBottom: "16px",
                      }}
                    >
                      Your Credit Score
                    </div>

                    {profile?.currentScore ? (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: "10px",
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              ...mono,
                              fontSize: "52px",
                              fontWeight: 500,
                              lineHeight: 1,
                              color: scoreTier?.color || "#fff",
                            }}
                          >
                            {currentScore}
                          </div>
                          <div style={{ paddingBottom: "8px" }}>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: scoreTier?.color || "#fff",
                              }}
                            >
                              {scoreTier?.label}
                            </div>
                            <div style={{ fontSize: "10px", color: MUTED }}>
                              {scoreTier?.range}
                            </div>
                          </div>
                        </div>

                        {/* Score bar */}
                        <div style={{ position: "relative", marginBottom: "16px" }}>
                          <div
                            style={{
                              height: "6px",
                              background: BORDER2,
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${scoreBarWidth}%`,
                                background: `linear-gradient(90deg, #ff6b6b, ${AMBER}, #facc15, ${GREEN}, ${BLUE})`,
                                borderRadius: "3px",
                                transition: "width 1s ease",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: "4px",
                            }}
                          >
                            <span
                              style={{ ...mono, fontSize: "8px", color: MUTED }}
                            >
                              300
                            </span>
                            <span
                              style={{ ...mono, fontSize: "8px", color: MUTED }}
                            >
                              850
                            </span>
                          </div>
                        </div>

                        {projectedScore && projectedScore > currentScore && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 12px",
                              background: "rgba(16,185,129,0.06)",
                              border: "1px solid rgba(16,185,129,0.15)",
                              borderRadius: "8px",
                            }}
                          >
                            <span
                              style={{
                                ...mono,
                                fontSize: "11px",
                                color: MUTED,
                              }}
                            >
                              Projected in 6 months
                            </span>
                            <span
                              style={{
                                ...mono,
                                fontSize: "16px",
                                fontWeight: 500,
                                color: GREEN,
                                marginLeft: "auto",
                              }}
                            >
                              +{estimatedGain} &rarr; {projectedScore}
                            </span>
                          </div>
                        )}

                        {/* Update score */}
                        <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                          <input
                            type="number"
                            min="300"
                            max="850"
                            value={scoreInput}
                            onChange={(e) => setScoreInput(e.target.value)}
                            placeholder="Update score"
                            style={{ ...inputStyle, flex: 1, fontSize: "12px" }}
                          />
                          <button
                            onClick={saveScore}
                            disabled={savingScore || !scoreInput}
                            style={{
                              padding: "8px 14px",
                              background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`,
                              border: "none",
                              borderRadius: "7px",
                              color: "#fff",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              ...jakarta,
                              opacity: !scoreInput ? 0.5 : 1,
                            }}
                          >
                            {savingScore ? "..." : "Update"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p
                          style={{
                            fontSize: "13px",
                            color: MID,
                            marginBottom: "14px",
                            lineHeight: 1.6,
                          }}
                        >
                          Enter your current credit score to track your progress
                          and see projections.
                        </p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="number"
                            min="300"
                            max="850"
                            value={scoreInput}
                            onChange={(e) => setScoreInput(e.target.value)}
                            placeholder="e.g. 620"
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button
                            onClick={saveScore}
                            disabled={savingScore || !scoreInput}
                            style={{
                              padding: "10px 16px",
                              background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`,
                              border: "none",
                              borderRadius: "7px",
                              color: "#fff",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              ...jakarta,
                              opacity: !scoreInput ? 0.5 : 1,
                            }}
                          >
                            {savingScore ? "..." : "Save"}
                          </button>
                        </div>
                        <p
                          style={{
                            fontSize: "10px",
                            color: MUTED,
                            marginTop: "8px",
                          }}
                        >
                          Check your free score at annualcreditreport.com
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Reporting status */}
                  <div
                    style={{
                      background: S1,
                      border: `1px solid ${BORDER2}`,
                      borderRadius: "12px",
                      padding: "24px",
                    }}
                  >
                    <div
                      style={{
                        ...mono,
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: MUTED,
                        marginBottom: "16px",
                      }}
                    >
                      Credit Bureau Reporting
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        marginBottom: "16px",
                      }}
                    >
                      {["Experian", "TransUnion", "Equifax"].map((name) => (
                        <div
                          key={name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: S2,
                            border: `1px solid ${BORDER}`,
                            borderRadius: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: ACC,
                                boxShadow: `0 0 6px ${ACC}`,
                                animation:
                                  "pulse 2s ease-in-out infinite",
                              }}
                            />
                            <span
                              style={{ fontSize: "13px", fontWeight: 600 }}
                            >
                              {name}
                            </span>
                          </div>
                          <span
                            style={{
                              ...mono,
                              fontSize: "9px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: ACC_DIM,
                              border: `1px solid ${ACC_BORDER}`,
                              color: ACC_BRIGHT,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            Queued
                          </span>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        padding: "10px 12px",
                        background: ACC_DIM,
                        border: `1px solid ${ACC_BORDER}`,
                        borderRadius: "7px",
                      }}
                    >
                      <div
                        style={{
                          ...mono,
                          fontSize: "9px",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: MUTED,
                          marginBottom: "4px",
                        }}
                      >
                        Payments queued
                      </div>
                      <div
                        style={{
                          ...mono,
                          fontSize: "22px",
                          fontWeight: 500,
                          color: ACC_BRIGHT,
                        }}
                      >
                        {Math.max(paymentsReported, 1)}
                      </div>
                      <div style={{ fontSize: "10px", color: MUTED }}>
                        Ready to report on launch day
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score tiers */}
                <div
                  style={{
                    background: S1,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "10px",
                    padding: "18px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      ...mono,
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: MUTED,
                      marginBottom: "14px",
                    }}
                  >
                    Credit Score Ranges
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: "8px",
                    }}
                  >
                    {SCORE_TIERS.map((tier) => {
                      const isActive =
                        currentScore >= tier.min && currentScore <= tier.max
                      return (
                        <div
                          key={tier.label}
                          style={{
                            padding: "10px",
                            background: isActive
                              ? "rgba(255,255,255,0.05)"
                              : S2,
                            border: `1px solid ${isActive ? tier.color + "40" : BORDER}`,
                            borderRadius: "7px",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: tier.color,
                              margin: "0 auto 6px",
                            }}
                          />
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: isActive ? tier.color : MID,
                              marginBottom: "2px",
                            }}
                          >
                            {tier.label}
                          </div>
                          <div
                            style={{
                              ...mono,
                              fontSize: "9px",
                              color: MUTED,
                            }}
                          >
                            {tier.range}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* What score means */}
                {scoreTier && (
                  <div
                    style={{
                      background: S1,
                      border: `1px solid ${BORDER}`,
                      borderRadius: "10px",
                      padding: "18px",
                    }}
                  >
                    <div
                      style={{
                        ...mono,
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: MUTED,
                        marginBottom: "14px",
                      }}
                    >
                      What your {scoreTier.label} score means
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      {[
                        {
                          item: "Auto loan rate",
                          value:
                            currentScore >= 740
                              ? "3\u20135%"
                              : currentScore >= 670
                                ? "6\u20139%"
                                : currentScore >= 580
                                  ? "10\u201314%"
                                  : "15\u201320%+",
                          good: currentScore >= 670,
                        },
                        {
                          item: "Credit card approval",
                          value:
                            currentScore >= 670
                              ? "Most cards"
                              : currentScore >= 580
                                ? "Secured cards"
                                : "Difficulty",
                          good: currentScore >= 670,
                        },
                        {
                          item: "Apartment application",
                          value:
                            currentScore >= 620
                              ? "Strong applicant"
                              : "May need co-signer",
                          good: currentScore >= 620,
                        },
                        {
                          item: "Personal loan rate",
                          value:
                            currentScore >= 740
                              ? "6\u201310%"
                              : currentScore >= 670
                                ? "11\u201316%"
                                : "17\u201325%+",
                          good: currentScore >= 670,
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            background: S2,
                            borderRadius: "6px",
                          }}
                        >
                          <span style={{ fontSize: "12px", color: MID }}>
                            {item.item}
                          </span>
                          <span
                            style={{
                              ...mono,
                              fontSize: "11px",
                              color: item.good ? GREEN : AMBER,
                            }}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ CREDIT BUILDER TRACKER TAB ═══ */}
            {activeTab === "tracker" && (
              <div>
                <div
                  style={{
                    background: S1,
                    border: `1px solid ${ACC_BORDER}`,
                    borderRadius: "12px",
                    padding: "24px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      ...mono,
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: MUTED,
                      marginBottom: "20px",
                    }}
                  >
                    How StyleCredit builds your score
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "12px",
                      marginBottom: "20px",
                    }}
                  >
                    {[
                      {
                        step: "01",
                        title: "You pay $40/month",
                        desc: "Your StyleSuite subscription is processed on time every month",
                        icon: "credit_card",
                      },
                      {
                        step: "02",
                        title: "We report to bureaus",
                        desc: "Each payment is reported to all 3 bureaus as an on-time installment",
                        icon: "bar_chart",
                      },
                      {
                        step: "03",
                        title: "Your score climbs",
                        desc: "Payment history (35% of score) improves with every on-time report",
                        icon: "trending_up",
                      },
                    ].map((s) => (
                      <div
                        key={s.step}
                        style={{
                          padding: "16px",
                          background: S2,
                          border: `1px solid ${BORDER}`,
                          borderRadius: "10px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "22px",
                            color: ACC_BRIGHT,
                            marginBottom: "10px",
                            display: "block",
                          }}
                        >
                          {s.icon}
                        </span>
                        <div
                          style={{
                            ...mono,
                            fontSize: "9px",
                            color: ACC_BRIGHT,
                            marginBottom: "6px",
                            letterSpacing: "0.1em",
                          }}
                        >
                          STEP {s.step}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            marginBottom: "6px",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {s.title}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: MID,
                            lineHeight: 1.6,
                          }}
                        >
                          {s.desc}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Timeline projection */}
                  <div
                    style={{
                      ...mono,
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: MUTED,
                      marginBottom: "12px",
                    }}
                  >
                    Score improvement timeline
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "8px",
                    }}
                  >
                    {[
                      {
                        period: "Month 1\u20132",
                        gain: "+5\u201315 pts",
                        note: "Account established",
                        color: ACC_BRIGHT,
                      },
                      {
                        period: "Month 3\u20134",
                        gain: "+20\u201335 pts",
                        note: "Pattern forming",
                        color: AMBER,
                      },
                      {
                        period: "Month 5\u20136",
                        gain: "+40\u201360 pts",
                        note: "Strong history",
                        color: GREEN,
                      },
                      {
                        period: "12 months",
                        gain: "+60\u201380 pts",
                        note: "Excellent standing",
                        color: BLUE,
                      },
                    ].map((t) => (
                      <div
                        key={t.period}
                        style={{
                          padding: "12px",
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${BORDER}`,
                          borderRadius: "8px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            ...mono,
                            fontSize: "8px",
                            color: MUTED,
                            marginBottom: "6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}
                        >
                          {t.period}
                        </div>
                        <div
                          style={{
                            ...mono,
                            fontSize: "16px",
                            fontWeight: 500,
                            color: t.color,
                            marginBottom: "4px",
                          }}
                        >
                          {t.gain}
                        </div>
                        <div style={{ fontSize: "10px", color: MUTED }}>
                          {t.note}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment history */}
                <div
                  style={{
                    background: S1,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "10px",
                    padding: "18px",
                  }}
                >
                  <div
                    style={{
                      ...mono,
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: MUTED,
                      marginBottom: "14px",
                    }}
                  >
                    Payment reporting history
                  </div>
                  {paymentsReported === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "32px",
                        color: MUTED,
                        fontSize: "13px",
                      }}
                    >
                      Your first payment will be queued for reporting after
                      subscription activation.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {Array.from(
                        { length: Math.min(paymentsReported, 12) },
                        (_, i) => {
                          const d = new Date()
                          d.setMonth(d.getMonth() - i)
                          return (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "10px 14px",
                                background: S2,
                                border: `1px solid ${BORDER}`,
                                borderRadius: "7px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: ACC,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ fontSize: "12px" }}>
                                  StyleSuite Subscription
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "10px",
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: MUTED,
                                  }}
                                >
                                  {d.toLocaleDateString("en-US", {
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <span
                                  style={{
                                    ...mono,
                                    fontSize: "11px",
                                    color: ACC_BRIGHT,
                                  }}
                                >
                                  $40.00
                                </span>
                                <span
                                  style={{
                                    ...mono,
                                    fontSize: "9px",
                                    padding: "2px 7px",
                                    borderRadius: "4px",
                                    background: ACC_DIM,
                                    border: `1px solid ${ACC_BORDER}`,
                                    color: ACC_BRIGHT,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Queued
                                </span>
                              </div>
                            </div>
                          )
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ INCOME LETTERS TAB ═══ */}
            {activeTab === "income" && (
              <div>
                <div
                  style={{
                    background: S1,
                    border: `1px solid ${BORDER2}`,
                    borderRadius: "12px",
                    padding: "24px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      ...mono,
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: MUTED,
                      marginBottom: "6px",
                    }}
                  >
                    Income Verification Letter
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: MID,
                      lineHeight: 1.7,
                      marginBottom: "20px",
                    }}
                  >
                    Generate a professional income verification letter using your
                    real earnings from SalonTransact. Use it for apartment applications,
                    car loans, personal loans, or any situation where you need to
                    prove income as a 1099 contractor.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "10px",
                      alignItems: "end",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Letter Purpose</label>
                      <select
                        value={incomePurpose}
                        onChange={(e) => setIncomePurpose(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="apartment">
                          Apartment Application
                        </option>
                        <option value="car_loan">Auto Loan</option>
                        <option value="personal_loan">Personal Loan</option>
                        <option value="mortgage">
                          Mortgage Pre-qualification
                        </option>
                        <option value="general">General Verification</option>
                      </select>
                    </div>
                    <button
                      onClick={generateIncomeLetter}
                      disabled={generatingIncome}
                      style={{
                        padding: "11px 20px",
                        background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`,
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        ...jakarta,
                        whiteSpace: "nowrap",
                        opacity: generatingIncome ? 0.7 : 1,
                      }}
                    >
                      {generatingIncome ? "Generating..." : "Generate Letter"}
                    </button>
                  </div>
                  <div
                    style={{
                      padding: "12px 16px",
                      background: ACC_DIM,
                      border: `1px solid ${ACC_BORDER}`,
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: MID,
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: ACC_BRIGHT }}>
                      What&apos;s included:
                    </strong>{" "}
                    Your full name, average monthly income from SalonTransact, income
                    consistency rating, employment status at Salon Envy, and a
                    verification reference number. Signed by Robert R. Reyna as
                    Authorized Signor.
                  </div>
                </div>

                {/* Income data preview */}
                <div
                  style={{
                    background: S1,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "10px",
                    padding: "18px",
                  }}
                >
                  <div
                    style={{
                      ...mono,
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: MUTED,
                      marginBottom: "14px",
                    }}
                  >
                    Your Income Profile
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "10px",
                    }}
                  >
                    {[
                      {
                        label: "Income Source",
                        value: "SalonTransact Payments",
                      },
                      {
                        label: "Employment Type",
                        value: "1099 Contractor",
                      },
                      {
                        label: "Employer",
                        value: "Salon Envy USA LLC",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          padding: "14px",
                          background: S2,
                          border: `1px solid ${BORDER}`,
                          borderRadius: "8px",
                        }}
                      >
                        <div
                          style={{
                            ...mono,
                            fontSize: "8px",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            color: MUTED,
                            marginBottom: "6px",
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: ACC_BRIGHT,
                          }}
                        >
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p
                    style={{
                      fontSize: "11px",
                      color: MUTED,
                      marginTop: "12px",
                      lineHeight: 1.6,
                    }}
                  >
                    Income data is pulled from your verified SalonTransact payroll
                    records. The letter is professionally formatted and signed by
                    the salon owner.
                  </p>
                </div>

                {/* Letter modal */}
                {showLetterModal && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0,0,0,0.9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 200,
                      padding: "20px",
                    }}
                  >
                    <div
                      style={{
                        background: "#0d1117",
                        border: `1px solid ${BORDER2}`,
                        borderRadius: "14px",
                        padding: "24px",
                        width: "100%",
                        maxWidth: "600px",
                        maxHeight: "80vh",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "16px",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                            margin: 0,
                          }}
                        >
                          Income Verification Letter
                        </h3>
                        <button
                          onClick={() => setShowLetterModal(false)}
                          style={{
                            background: "none",
                            border: "none",
                            color: MUTED,
                            cursor: "pointer",
                            fontSize: "18px",
                          }}
                        >
                          &times;
                        </button>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          overflow: "auto",
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${BORDER}`,
                          borderRadius: "8px",
                          padding: "16px",
                          marginBottom: "14px",
                        }}
                      >
                        <pre
                          style={{
                            ...mono,
                            fontSize: "11px",
                            color: MID,
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.8,
                            margin: 0,
                          }}
                        >
                          {generatedLetter}
                        </pre>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() =>
                            downloadLetter(
                              generatedLetter,
                              `income-verification-${new Date().toISOString().split("T")[0]}.txt`
                            )
                          }
                          style={{
                            flex: 1,
                            padding: "11px",
                            background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`,
                            border: "none",
                            borderRadius: "8px",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            ...jakarta,
                          }}
                        >
                          Download Letter
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedLetter)
                          }}
                          style={{
                            padding: "11px 18px",
                            background: S1,
                            border: `1px solid ${BORDER2}`,
                            borderRadius: "8px",
                            color: MID,
                            fontSize: "12px",
                            cursor: "pointer",
                            ...jakarta,
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ ACTION PLAN TAB ═══ */}
            {activeTab === "action" && (
              <div>
                <div
                  style={{
                    background: S1,
                    border: `1px solid ${BORDER2}`,
                    borderRadius: "12px",
                    padding: "24px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      ...mono,
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: MUTED,
                      marginBottom: "6px",
                    }}
                  >
                    Your 5-Step Credit Building Plan
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: MID,
                      lineHeight: 1.7,
                      marginBottom: "20px",
                    }}
                  >
                    Follow these steps in order. Most stylists see 40&ndash;80
                    point improvements within 12 months.
                  </p>

                  {[
                    {
                      step: 1,
                      title: "StyleSuite payments being reported",
                      desc: "Your $40/month subscription is queued for reporting to all 3 bureaus. This establishes a new tradeline and builds payment history \u2014 the most important factor in your score (35%).",
                      status:
                        paymentsReported > 0 ? "active" : ("pending" as string),
                      color: ACC_BRIGHT,
                      impact: "+5\u201315 pts in month 1",
                    },
                    {
                      step: 2,
                      title: "Get a secured credit card",
                      desc: "A secured card (Capital One Secured, Discover it Secured) reports to all 3 bureaus and adds a revolving credit line. Apply with $200\u2013500 deposit.",
                      status: "action" as string,
                      color: BLUE,
                      impact: "+10\u201325 pts",
                      link: "https://www.capitalone.com/credit-cards/secured-mastercard/",
                      linkText: "Apply at Capital One \u2192",
                    },
                    {
                      step: 3,
                      title: "Keep credit utilization under 30%",
                      desc: "If your secured card has a $500 limit, never carry more than $150 balance. Pay it off monthly. Utilization is 30% of your score.",
                      status: "info" as string,
                      color: GREEN,
                      impact: "+15\u201330 pts",
                    },
                    {
                      step: 4,
                      title: "Never miss a payment",
                      desc: "Set up autopay on all accounts. One missed payment can drop your score 50\u2013100 points. Payment history is 35% of your score.",
                      status: "info" as string,
                      color: AMBER,
                      impact: "Prevents -50 to -100 pts",
                    },
                    {
                      step: 5,
                      title: "Dispute any errors on your report",
                      desc: "1 in 5 credit reports contain errors. Get your free report at annualcreditreport.com and use our Dispute Letter tool to challenge any mistakes.",
                      status: "info" as string,
                      color: "#a78bfa",
                      impact: "+25\u2013100 pts if errors found",
                    },
                  ].map((s) => (
                    <div
                      key={s.step}
                      style={{
                        display: "flex",
                        gap: "16px",
                        padding: "16px 0",
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background:
                            s.status === "active"
                              ? `${s.color}20`
                              : s.status === "action"
                                ? `${s.color}15`
                                : S2,
                          border: `1px solid ${s.status === "info" ? BORDER : s.color + "40"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        {s.status === "active" ? (
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: s.color,
                              boxShadow: `0 0 6px ${s.color}`,
                              animation:
                                "pulse 2s ease-in-out infinite",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              ...mono,
                              fontSize: "11px",
                              color:
                                s.status === "info" ? MUTED : s.color,
                              fontWeight: 500,
                            }}
                          >
                            {s.step}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "6px",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {s.title}
                          </div>
                          <span
                            style={{
                              ...mono,
                              fontSize: "9px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: `${s.color}10`,
                              border: `1px solid ${s.color}25`,
                              color: s.color,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              flexShrink: 0,
                            }}
                          >
                            {s.impact}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "12px",
                            color: MID,
                            lineHeight: 1.7,
                            margin: "0 0 8px",
                          }}
                        >
                          {s.desc}
                        </p>
                        {"link" in s && s.link && (
                          <a
                            href={s.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "11px",
                              color: BLUE,
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                          >
                            {s.linkText}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ DISPUTE LETTERS TAB ═══ */}
            {activeTab === "dispute" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        margin: "0 0 3px",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      Dispute Letters
                    </h3>
                    <p style={{ fontSize: "12px", color: MUTED, margin: 0 }}>
                      AI-generated FCRA-compliant dispute letters
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDisputeForm(true)}
                    style={{
                      padding: "9px 16px",
                      background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`,
                      border: "none",
                      borderRadius: "7px",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      ...jakarta,
                    }}
                  >
                    New Dispute Letter
                  </button>
                </div>

                <div
                  style={{
                    padding: "12px 16px",
                    background: "rgba(255,107,107,0.04)",
                    border: "1px solid rgba(255,107,107,0.12)",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "12px",
                    color: MID,
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#ff6b6b" }}>Did you know?</strong> 1
                  in 5 Americans has an error on their credit report. Common
                  errors include wrong balances, accounts that aren&apos;t yours,
                  duplicate accounts, and outdated negative items. Disputing
                  errors is free and can add 25&ndash;100 points.
                </div>

                {disputeLetters.length === 0 ? (
                  <div
                    style={{
                      background: S1,
                      border: `1px solid ${BORDER}`,
                      borderRadius: "10px",
                      padding: "48px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "36px",
                        color: MUTED,
                        marginBottom: "14px",
                        display: "block",
                      }}
                    >
                      mail
                    </span>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "8px",
                      }}
                    >
                      No dispute letters yet
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: MUTED,
                        marginBottom: "16px",
                      }}
                    >
                      Pull your free credit report at annualcreditreport.com,
                      look for errors, and use this tool to dispute them.
                    </p>
                    <a
                      href="https://www.annualcreditreport.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: "12px",
                        color: ACC_BRIGHT,
                        fontWeight: 600,
                      }}
                    >
                      Get your free credit report &rarr;
                    </a>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {disputeLetters.map((letter) => (
                      <div
                        key={letter.id}
                        style={{
                          background: S1,
                          border: `1px solid ${BORDER}`,
                          borderRadius: "10px",
                          padding: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "8px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                marginBottom: "2px",
                              }}
                            >
                              {letter.creditorName}
                            </div>
                            <div
                              style={{ fontSize: "11px", color: MUTED }}
                            >
                              {letter.bureau.charAt(0).toUpperCase() +
                                letter.bureau.slice(1)}{" "}
                              &middot;{" "}
                              {letter.errorType.replace(/_/g, " ")}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <span
                              style={{
                                ...mono,
                                fontSize: "9px",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                background:
                                  letter.status === "sent"
                                    ? "rgba(16,185,129,0.08)"
                                    : ACC_DIM,
                                border: `1px solid ${letter.status === "sent" ? "rgba(16,185,129,0.2)" : ACC_BORDER}`,
                                color:
                                  letter.status === "sent"
                                    ? GREEN
                                    : ACC_BRIGHT,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              {letter.status}
                            </span>
                            <button
                              onClick={() =>
                                downloadLetter(
                                  letter.letterContent,
                                  `dispute-${letter.bureau}-${letter.id.slice(-6)}.txt`
                                )
                              }
                              style={{
                                padding: "3px 9px",
                                background: "transparent",
                                border: `1px solid ${BORDER2}`,
                                borderRadius: "5px",
                                color: MID,
                                fontSize: "10px",
                                cursor: "pointer",
                                ...jakarta,
                              }}
                            >
                              Download
                            </button>
                          </div>
                        </div>
                        <p
                          style={{
                            fontSize: "11px",
                            color: MUTED,
                            margin: 0,
                            lineHeight: 1.5,
                          }}
                        >
                          {letter.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dispute form modal */}
                {showDisputeForm && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0,0,0,0.88)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 200,
                      padding: "20px",
                    }}
                  >
                    <div
                      style={{
                        background: "#0d1117",
                        border: `1px solid ${BORDER2}`,
                        borderRadius: "14px",
                        padding: "28px",
                        width: "100%",
                        maxWidth: "500px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "17px",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          marginBottom: "20px",
                        }}
                      >
                        Generate Dispute Letter
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "14px",
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Credit Bureau</label>
                          <select
                            value={disputeForm.bureau}
                            onChange={(e) =>
                              setDisputeForm((p) => ({
                                ...p,
                                bureau: e.target.value,
                              }))
                            }
                            style={inputStyle}
                          >
                            <option value="experian">Experian</option>
                            <option value="transunion">TransUnion</option>
                            <option value="equifax">Equifax</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>
                            Creditor / Company Name
                          </label>
                          <input
                            value={disputeForm.creditorName}
                            onChange={(e) =>
                              setDisputeForm((p) => ({
                                ...p,
                                creditorName: e.target.value,
                              }))
                            }
                            placeholder="e.g. Chase Bank, Capital One"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>
                            Account Number (optional)
                          </label>
                          <input
                            value={disputeForm.accountNumber}
                            onChange={(e) =>
                              setDisputeForm((p) => ({
                                ...p,
                                accountNumber: e.target.value,
                              }))
                            }
                            placeholder="Last 4 digits only"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Type of Error</label>
                          <select
                            value={disputeForm.errorType}
                            onChange={(e) =>
                              setDisputeForm((p) => ({
                                ...p,
                                errorType: e.target.value,
                              }))
                            }
                            style={inputStyle}
                          >
                            {ERROR_TYPES.map((et) => (
                              <option key={et.id} value={et.id}>
                                {et.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>
                            Describe the Error
                          </label>
                          <textarea
                            value={disputeForm.description}
                            onChange={(e) =>
                              setDisputeForm((p) => ({
                                ...p,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Explain what is incorrect and what the correct information should be..."
                            style={{
                              ...inputStyle,
                              height: "90px",
                              resize: "vertical" as const,
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginTop: "20px",
                        }}
                      >
                        <button
                          onClick={() => setShowDisputeForm(false)}
                          style={{
                            flex: 1,
                            padding: "10px",
                            background: "transparent",
                            border: `1px solid ${BORDER2}`,
                            borderRadius: "7px",
                            color: MID,
                            cursor: "pointer",
                            ...jakarta,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={generateDisputeLetter}
                          disabled={
                            generatingDispute ||
                            !disputeForm.creditorName ||
                            !disputeForm.description
                          }
                          style={{
                            flex: 2,
                            padding: "10px",
                            background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`,
                            border: "none",
                            borderRadius: "7px",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            ...jakarta,
                            opacity:
                              !disputeForm.creditorName ||
                              !disputeForm.description ||
                              generatingDispute
                                ? 0.5
                                : 1,
                          }}
                        >
                          {generatingDispute
                            ? "Generating with AI..."
                            : "Generate Letter"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap"
      />
    </div>
  )
}
