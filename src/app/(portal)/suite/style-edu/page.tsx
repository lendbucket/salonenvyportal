"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useUserRole } from "@/hooks/useUserRole"

const ACC = "#606E74"
const ACC_BRIGHT = "#7a8f96"
const ACC_DIM = "rgba(96,110,116,0.08)"
const ACC_BORDER = "rgba(96,110,116,0.2)"
const AMBER = "#ffb347"
const PURPLE = "#a78bfa"
const BORDER = "rgba(255,255,255,0.07)"
const BORDER2 = "rgba(255,255,255,0.12)"
const S1 = "rgba(255,255,255,0.03)"
const S2 = "rgba(255,255,255,0.05)"
const MUTED = "rgba(255,255,255,0.3)"
const MID = "rgba(255,255,255,0.6)"
const GREEN = "#10B981"
const BLUE = "#4da6ff"
const RED = "#ff6b6b"

const TABS = [
  { id: "learning", label: "My Learning" },
  { id: "ce", label: "CE Credits" },
  { id: "library", label: "Course Library" },
  { id: "license", label: "License Tracker" },
]

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "color", label: "Color", gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)" },
  { id: "cutting", label: "Cutting", gradient: "linear-gradient(135deg, #2563eb, #4da6ff)" },
  { id: "texture", label: "Texture", gradient: "linear-gradient(135deg, #d97706, #ffb347)" },
  { id: "business", label: "Business", gradient: "linear-gradient(135deg, #059669, #10B981)" },
  { id: "tdlr_ce", label: "TDLR CE", gradient: `linear-gradient(135deg, ${ACC}, ${ACC_BRIGHT})` },
]

const LEVEL_COLORS: Record<string, string> = { beginner: GREEN, intermediate: BLUE, advanced: PURPLE }

function getCategoryGradient(cat: string) {
  return CATEGORIES.find(c => c.id === cat)?.gradient || `linear-gradient(135deg, ${ACC}, ${ACC_BRIGHT})`
}

type Course = {
  id: string; title: string; description: string; category: string; instructor: string | null
  durationMinutes: number; level: string; isFeatured: boolean; isTdlrApproved: boolean
  tdlrHours: number; isCompleted: boolean; completedAt: string | null; videoUrl: string | null
}

type Renewal = {
  id: string; licenseNumber: string | null; licenseExpiration: string | null
  ceHoursRequired: number; ceHoursCompleted: number; renewalDueDate: string | null
}

export default function StyleEduPage() {
  const { isOwner } = useUserRole()
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("learning")
  const [courses, setCourses] = useState<Course[]>([])
  const [completedCeHours, setCompletedCeHours] = useState(0)
  const [renewal, setRenewal] = useState<Renewal | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState("all")
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [completing, setCompleting] = useState(false)
  const [renewalForm, setRenewalForm] = useState({ licenseNumber: "", licenseExpiration: "" })
  const [savingRenewal, setSavingRenewal] = useState(false)

  useEffect(() => { checkAccess() }, [])

  const checkAccess = async () => {
    const res = await fetch("/api/suite/subscription")
    const data = await res.json()
    if (!data.hasAccess) { router.push("/suite"); return }
    loadData()
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [cRes, rRes] = await Promise.all([
        fetch("/api/suite/edu/courses"),
        fetch("/api/suite/edu/renewal"),
      ])
      const cData = await cRes.json()
      const rData = await rRes.json()
      setCourses(cData.courses || [])
      setCompletedCeHours(cData.completedCeHours || 0)
      setRenewal(rData.renewal || null)
      if (rData.renewal?.licenseNumber) setRenewalForm(f => ({ ...f, licenseNumber: rData.renewal.licenseNumber || "" }))
      if (rData.renewal?.licenseExpiration) setRenewalForm(f => ({ ...f, licenseExpiration: rData.renewal.licenseExpiration?.split("T")[0] || "" }))
    } catch { /* noop */ }
    setLoading(false)
  }

  const markComplete = useCallback(async (courseId: string) => {
    setCompleting(true)
    try {
      await fetch("/api/suite/edu/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      })
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, isCompleted: true, completedAt: new Date().toISOString() } : c))
      const course = courses.find(c => c.id === courseId)
      if (course?.isTdlrApproved) setCompletedCeHours(prev => prev + course.tdlrHours)
      setSelectedCourse(null)
    } catch { /* noop */ }
    setCompleting(false)
  }, [courses])

  const saveRenewal = async () => {
    setSavingRenewal(true)
    try {
      const res = await fetch("/api/suite/edu/renewal", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseNumber: renewalForm.licenseNumber || null,
          licenseExpiration: renewalForm.licenseExpiration ? new Date(renewalForm.licenseExpiration).toISOString() : null,
          renewalDueDate: renewalForm.licenseExpiration ? new Date(renewalForm.licenseExpiration).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (data.renewal) setRenewal(data.renewal)
    } catch { /* noop */ }
    setSavingRenewal(false)
  }

  const downloadCertificate = () => {
    const userName = session?.user?.name || "Stylist"
    const completedCe = courses.filter(c => c.isTdlrApproved && c.isCompleted)
    const content = [
      "═══════════════════════════════════════════════════",
      "        CONTINUING EDUCATION CERTIFICATE",
      "         Salon Envy Professional Education",
      "═══════════════════════════════════════════════════",
      "",
      `Name: ${userName}`,
      `License Number: ${renewal?.licenseNumber || "N/A"}`,
      `Date Issued: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      "",
      "COURSES COMPLETED:",
      ...completedCe.map((c, i) => `  ${i + 1}. ${c.title} (${c.tdlrHours} CE hours)`),
      "",
      `Total CE Hours: ${completedCeHours} of 8 required`,
      "",
      "This certificate verifies that the above-named individual",
      "has completed the listed continuing education courses",
      "as required by the Texas Department of Licensing and",
      "Regulation (TDLR) for cosmetology license renewal.",
      "",
      "Issued by: Salon Envy Professional Education",
      "           A division of Salon Envy USA LLC",
      "",
      "═══════════════════════════════════════════════════",
    ].join("\n")
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `ce-certificate-${new Date().toISOString().split("T")[0]}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  const totalCompleted = courses.filter(c => c.isCompleted).length
  const totalHoursLearned = courses.filter(c => c.isCompleted).reduce((s, c) => s + c.durationMinutes, 0)
  const featuredCourses = courses.filter(c => c.isFeatured)
  const ceCourses = courses.filter(c => c.isTdlrApproved)
  const filteredCourses = filterCat === "all" ? courses : courses.filter(c => c.category === filterCat)
  const hivCompleted = courses.some(c => c.title.includes("HIV") && c.isCompleted)
  const daysUntilExpiry = renewal?.licenseExpiration ? Math.ceil((new Date(renewal.licenseExpiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const expiryStatus = daysUntilExpiry === null ? "unknown" : daysUntilExpiry < 0 ? "expired" : daysUntilExpiry < 90 ? "expiring" : "active"

  const mono: React.CSSProperties = { fontFamily: "'Fira Code', monospace" }
  const jakarta: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", backgroundColor: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER2}`, borderRadius: "8px", color: "#FFFFFF", fontSize: "14px", outline: "none", boxSizing: "border-box" as const, ...jakarta }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "6px", ...mono }

  return (
    <div style={{ ...jakarta, minHeight: "100vh", backgroundColor: "#06080d", color: "#fff", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "800px", height: "400px", background: `radial-gradient(ellipse at 50% 0%, ${ACC_DIM} 0%, transparent 65%)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1000px", margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(16px,4vw,32px)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
          <button onClick={() => router.push("/suite")} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: MUTED, background: "none", border: "none", cursor: "pointer", ...jakarta }}>&larr; Envy Suite</button>
          <span style={{ color: BORDER, fontSize: "12px" }}>&rsaquo;</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "22px", height: "22px", borderRadius: "5px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px", color: PURPLE }}>school</span>
            </div>
            <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em" }}>StyleEdu</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <span style={{ ...mono, fontSize: "9px", padding: "3px 8px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: PURPLE }}>{totalCompleted} completed</span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "1px", background: S1, border: `1px solid ${BORDER}`, borderRadius: "9px", padding: "3px", marginBottom: "20px", overflowX: "auto" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: "6px", border: activeTab === tab.id ? `1px solid ${ACC_BORDER}` : "1px solid transparent", background: activeTab === tab.id ? `linear-gradient(135deg, rgba(122,143,150,0.15), rgba(96,110,116,0.08))` : "transparent", color: activeTab === tab.id ? "#fff" : MUTED, fontSize: "9px", fontWeight: activeTab === tab.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em", ...mono }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: MUTED }}>Loading courses...</div>
        ) : (
          <>
            {/* ═══ MY LEARNING TAB ═══ */}
            {activeTab === "learning" && (
              <div>
                {/* Progress summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "18px" }}>
                    <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "10px" }}>CE Hours</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", marginBottom: "8px" }}>
                      <span style={{ ...mono, fontSize: "28px", fontWeight: 500, color: completedCeHours >= 8 ? GREEN : AMBER }}>{completedCeHours}</span>
                      <span style={{ ...mono, fontSize: "14px", color: MUTED, paddingBottom: "4px" }}>/ 8</span>
                    </div>
                    <div style={{ height: "4px", background: BORDER2, borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min((completedCeHours / 8) * 100, 100)}%`, background: completedCeHours >= 8 ? GREEN : AMBER, borderRadius: "2px", transition: "width 0.5s" }} />
                    </div>
                  </div>
                  <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "18px" }}>
                    <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "10px" }}>Courses Completed</div>
                    <div style={{ ...mono, fontSize: "28px", fontWeight: 500, color: PURPLE }}>{totalCompleted}</div>
                    <div style={{ fontSize: "10px", color: MUTED }}>of {courses.length} available</div>
                  </div>
                  <div style={{ background: S1, border: `1px solid ${BORDER2}`, borderRadius: "12px", padding: "18px" }}>
                    <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "10px" }}>Time Learning</div>
                    <div style={{ ...mono, fontSize: "28px", fontWeight: 500, color: BLUE }}>{(totalHoursLearned / 60).toFixed(1)}</div>
                    <div style={{ fontSize: "10px", color: MUTED }}>hours</div>
                  </div>
                </div>

                {/* Featured courses */}
                <div style={{ ...mono, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: MUTED, display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>Featured Courses<div style={{ flex: 1, height: "1px", background: BORDER }} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                  {featuredCourses.slice(0, 4).map(course => (
                    <div key={course.id} onClick={() => setSelectedCourse(course)} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", overflow: "hidden", cursor: "pointer", position: "relative" }}>
                      <div style={{ height: "80px", background: getCategoryGradient(course.category), display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {course.isCompleted && (
                          <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 2, width: "24px", height: "24px", borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#fff" }}>check</span>
                          </div>
                        )}
                        <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "rgba(255,255,255,0.5)" }}>
                          {course.category === "color" ? "palette" : course.category === "cutting" ? "content_cut" : course.category === "business" ? "trending_up" : course.category === "tdlr_ce" ? "verified" : "auto_awesome"}
                        </span>
                        {course.videoUrl && !course.isCompleted && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                              <div style={{ width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "13px solid white", marginLeft: "3px" }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "14px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", letterSpacing: "-0.01em" }}>{course.title}</div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ ...mono, fontSize: "9px", color: MUTED }}>{course.durationMinutes} min</span>
                          <span style={{ ...mono, fontSize: "8px", padding: "1px 6px", borderRadius: "3px", background: `${LEVEL_COLORS[course.level] || ACC}15`, color: LEVEL_COLORS[course.level] || ACC, textTransform: "uppercase" }}>{course.level}</span>
                          {course.isTdlrApproved && <span style={{ ...mono, fontSize: "8px", padding: "1px 6px", borderRadius: "3px", background: `${AMBER}15`, color: AMBER, textTransform: "uppercase" }}>{course.tdlrHours} CE hrs</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recommended */}
                {completedCeHours < 8 && (
                  <div style={{ padding: "16px 20px", background: `${AMBER}06`, border: `1px solid ${AMBER}20`, borderRadius: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: AMBER }}>school</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "2px" }}>Complete your CE hours</div>
                      <div style={{ fontSize: "11px", color: MID }}>You need {8 - completedCeHours} more CE hours for TDLR renewal.</div>
                    </div>
                    <button onClick={() => setActiveTab("ce")} style={{ padding: "8px 14px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "7px", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", ...jakarta }}>Start CE</button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ CE CREDITS TAB ═══ */}
            {activeTab === "ce" && (
              <div>
                {/* Big CE banner */}
                <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "14px", padding: "28px", marginBottom: "16px", textAlign: "center" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "14px" }}>TDLR Continuing Education</div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "8px", marginBottom: "14px" }}>
                    <span style={{ ...mono, fontSize: "52px", fontWeight: 500, lineHeight: 1, color: completedCeHours >= 8 ? GREEN : "#fff" }}>{completedCeHours}</span>
                    <span style={{ ...mono, fontSize: "20px", color: MUTED, paddingBottom: "6px" }}>/ 8 hours</span>
                  </div>
                  <div style={{ maxWidth: "400px", margin: "0 auto 14px", height: "8px", background: BORDER2, borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min((completedCeHours / 8) * 100, 100)}%`, background: completedCeHours >= 8 ? GREEN : `linear-gradient(90deg, ${ACC}, ${ACC_BRIGHT})`, borderRadius: "4px", transition: "width 0.5s" }} />
                  </div>
                  {daysUntilExpiry !== null && (
                    <div style={{ fontSize: "12px", color: expiryStatus === "expired" ? RED : expiryStatus === "expiring" ? AMBER : MID }}>
                      {expiryStatus === "expired" ? "License EXPIRED" : `${daysUntilExpiry} days until license expiration`}
                    </div>
                  )}
                  {completedCeHours >= 8 && (
                    <button onClick={downloadCertificate} style={{ marginTop: "14px", padding: "10px 20px", background: `linear-gradient(135deg, ${GREEN}, #059669)`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", ...jakarta }}>
                      Download CE Certificate
                    </button>
                  )}
                </div>

                {/* Info box */}
                <div style={{ padding: "14px 18px", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, borderRadius: "10px", marginBottom: "16px", fontSize: "12px", color: MID, lineHeight: 1.7 }}>
                  <strong style={{ color: ACC_BRIGHT }}>Texas requires 8 CE hours</strong> before license renewal. At least 1 hour must cover HIV/AIDS. StyleEdu tracks your hours automatically &mdash; download your certificate when complete.
                </div>

                {/* CE course checklist */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {ceCourses.map(course => (
                    <div key={course.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", background: course.isCompleted ? "rgba(16,185,129,0.03)" : S1, border: `1px solid ${course.isCompleted ? "rgba(16,185,129,0.15)" : BORDER}`, borderRadius: "10px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: course.isCompleted ? GREEN : "transparent", border: `2px solid ${course.isCompleted ? GREEN : BORDER2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {course.isCompleted && <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#fff" }}>check</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: course.isCompleted ? MID : "#fff" }}>{course.title}</div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "3px" }}>
                          <span style={{ ...mono, fontSize: "9px", color: AMBER }}>{course.tdlrHours} CE hrs</span>
                          <span style={{ ...mono, fontSize: "9px", color: MUTED }}>{course.durationMinutes} min</span>
                          {course.title.includes("Laws") && <span style={{ ...mono, fontSize: "8px", padding: "1px 5px", borderRadius: "3px", background: `${RED}12`, color: RED, textTransform: "uppercase" }}>Required</span>}
                          {course.title.includes("HIV") && <span style={{ ...mono, fontSize: "8px", padding: "1px 5px", borderRadius: "3px", background: `${RED}12`, color: RED, textTransform: "uppercase" }}>Required</span>}
                        </div>
                      </div>
                      {!course.isCompleted ? (
                        <button onClick={() => setSelectedCourse(course)} style={{ padding: "7px 14px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "7px", color: "#fff", fontSize: "10px", fontWeight: 700, cursor: "pointer", ...jakarta }}>Start</button>
                      ) : (
                        <span style={{ ...mono, fontSize: "9px", color: GREEN }}>&#10003; Done</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ COURSE LIBRARY TAB ═══ */}
            {activeTab === "library" && (
              <div>
                {/* Category filter */}
                <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto" }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setFilterCat(cat.id)} style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, border: `1px solid ${filterCat === cat.id ? ACC_BORDER : BORDER}`, background: filterCat === cat.id ? ACC_DIM : "transparent", color: filterCat === cat.id ? ACC_BRIGHT : MUTED, cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em", ...mono }}>
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Course grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  {filteredCourses.map(course => (
                    <div key={course.id} onClick={() => setSelectedCourse(course)} style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", overflow: "hidden", cursor: "pointer", position: "relative" }}>
                      {course.isCompleted && (
                        <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 2, width: "24px", height: "24px", borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#fff" }}>check</span>
                        </div>
                      )}
                      <div style={{ height: "70px", background: getCategoryGradient(course.category), display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "rgba(255,255,255,0.4)" }}>
                          {course.category === "color" ? "palette" : course.category === "cutting" ? "content_cut" : course.category === "texture" ? "auto_awesome" : course.category === "business" ? "trending_up" : "verified"}
                        </span>
                        {course.isCompleted && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />}
                        {course.videoUrl && !course.isCompleted && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                              <div style={{ width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "13px solid white", marginLeft: "3px" }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "12px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{course.title}</div>
                        <div style={{ fontSize: "10px", color: MUTED, marginBottom: "6px" }}>{course.instructor}</div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          <span style={{ ...mono, fontSize: "8px", padding: "1px 5px", borderRadius: "3px", background: S2, color: MUTED }}>{course.videoUrl ? `\u25B6 ${course.durationMinutes} min` : `${course.durationMinutes} min`}</span>
                          <span style={{ ...mono, fontSize: "8px", padding: "1px 5px", borderRadius: "3px", background: `${LEVEL_COLORS[course.level] || ACC}12`, color: LEVEL_COLORS[course.level] || ACC, textTransform: "uppercase" }}>{course.level}</span>
                          {course.isTdlrApproved && <span style={{ ...mono, fontSize: "8px", padding: "1px 5px", borderRadius: "3px", background: `${AMBER}12`, color: AMBER }}>{course.tdlrHours} CE</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ LICENSE TRACKER TAB ═══ */}
            {activeTab === "license" && (
              <div>
                {/* License info */}
                <div style={{ background: S1, border: `1px solid ${ACC_BORDER}`, borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "16px" }}>TDLR License Information</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                    <div>
                      <label style={labelStyle}>License Number</label>
                      <input value={renewalForm.licenseNumber} onChange={e => setRenewalForm(p => ({ ...p, licenseNumber: e.target.value }))} placeholder="e.g. COS-123456" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Expiration Date</label>
                      <input type="date" value={renewalForm.licenseExpiration} onChange={e => setRenewalForm(p => ({ ...p, licenseExpiration: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button onClick={saveRenewal} disabled={savingRenewal} style={{ padding: "9px 18px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "7px", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", ...jakarta }}>{savingRenewal ? "Saving..." : "Save License Info"}</button>
                    {daysUntilExpiry !== null && (
                      <span style={{ ...mono, fontSize: "11px", padding: "4px 10px", borderRadius: "4px", background: expiryStatus === "expired" ? `${RED}12` : expiryStatus === "expiring" ? `${AMBER}12` : `${GREEN}12`, color: expiryStatus === "expired" ? RED : expiryStatus === "expiring" ? AMBER : GREEN, textTransform: "uppercase" }}>
                        {expiryStatus === "expired" ? "Expired" : expiryStatus === "expiring" ? `${daysUntilExpiry} days left` : `Active — ${daysUntilExpiry} days`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Renewal requirements checklist */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "14px" }}>Renewal Requirements</div>
                  {[
                    { text: `Complete 8 CE hours (${completedCeHours}/8)`, done: completedCeHours >= 8 },
                    { text: "At least 1 HIV/AIDS hour", done: hivCompleted },
                    { text: "Pay TDLR renewal fee ($50\u2013$111)", done: false },
                    { text: "Submit renewal application online", done: false },
                  ].map((req, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: "20px", height: "20px", borderRadius: "5px", background: req.done ? GREEN : "transparent", border: `2px solid ${req.done ? GREEN : BORDER2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {req.done && <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#fff" }}>check</span>}
                      </div>
                      <span style={{ fontSize: "12px", color: req.done ? MID : "#fff" }}>{req.text}</span>
                    </div>
                  ))}
                </div>

                {/* CE hours summary */}
                {courses.filter(c => c.isTdlrApproved && c.isCompleted).length > 0 && (
                  <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
                    <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "14px" }}>Completed CE Courses</div>
                    {courses.filter(c => c.isTdlrApproved && c.isCompleted).map(c => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                        <span style={{ fontSize: "12px", color: MID }}>{c.title}</span>
                        <span style={{ ...mono, fontSize: "11px", color: GREEN }}>{c.tdlrHours} hrs</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>Total</span>
                      <span style={{ ...mono, fontSize: "14px", fontWeight: 500, color: completedCeHours >= 8 ? GREEN : AMBER }}>{completedCeHours} / 8 hrs</span>
                    </div>
                    {completedCeHours < 8 && (
                      <div style={{ fontSize: "11px", color: AMBER, marginTop: "6px" }}>You need {(8 - completedCeHours).toFixed(1)} more hours</div>
                    )}
                  </div>
                )}

                {/* Renewal steps */}
                <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "20px" }}>
                  <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED, marginBottom: "14px" }}>Renewal Steps</div>
                  {[
                    { step: 1, text: "Complete 8 CE hours", sub: `${completedCeHours}/8 done`, color: completedCeHours >= 8 ? GREEN : ACC_BRIGHT },
                    { step: 2, text: "Go to tdlr.texas.gov", sub: "TDLR MyLicense Office", color: BLUE },
                    { step: 3, text: "Log into MyLicense Office", sub: "Use your TDLR account", color: BLUE },
                    { step: 4, text: "Submit renewal + pay fee", sub: "$50\u2013$111 depending on license type", color: AMBER },
                    { step: 5, text: "Print new license", sub: "Available immediately after approval", color: GREEN },
                  ].map(s => (
                    <div key={s.step} style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: `${s.color}15`, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ ...mono, fontSize: "11px", color: s.color }}>{s.step}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700 }}>{s.text}</div>
                        <div style={{ fontSize: "10px", color: MUTED }}>{s.sub}</div>
                      </div>
                    </div>
                  ))}
                  <a href="https://www.tdlr.texas.gov" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "14px", padding: "9px 16px", background: `${BLUE}0d`, border: `1px solid ${BLUE}22`, borderRadius: "8px", color: BLUE, textDecoration: "none", fontSize: "11px", fontWeight: 700, ...jakarta }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                    Go to TDLR Website
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ Course Detail Modal ═══ */}
        {selectedCourse && (
          <div onClick={() => setSelectedCourse(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px", overflowY: "auto" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", border: `1px solid ${BORDER2}`, borderRadius: "14px", width: "100%", maxWidth: "680px", overflow: "hidden", position: "relative", margin: "auto" }}>
              {/* Close button */}
              <button onClick={() => setSelectedCourse(null)} style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10, width: "32px", height: "32px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
              </button>

              {/* Video player or gradient thumbnail */}
              {selectedCourse.videoUrl ? (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", backgroundColor: "#000", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${selectedCourse.videoUrl}?rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&controls=1&color=white&fs=1&playsinline=1`}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    title={selectedCourse.title}
                  />
                </div>
              ) : (
                <div style={{ height: "220px", backgroundColor: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", background: getCategoryGradient(selectedCourse.category) }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(255,255,255,0.3)" }}>
                    {selectedCourse.category === "color" ? "palette" : selectedCourse.category === "cutting" ? "content_cut" : selectedCourse.category === "texture" ? "auto_awesome" : selectedCourse.category === "business" ? "trending_up" : "verified"}
                  </span>
                  <div style={{ ...mono, fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>Video content coming soon</div>
                </div>
              )}

              <div style={{ padding: "24px" }}>
                {/* Title + badges */}
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{selectedCourse.title}</h3>
                <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ ...mono, fontSize: "9px", padding: "2px 8px", borderRadius: "4px", background: S2, color: MUTED }}>{selectedCourse.videoUrl ? `\u25B6 ${selectedCourse.durationMinutes} min` : `${selectedCourse.durationMinutes} min`}</span>
                  <span style={{ ...mono, fontSize: "9px", padding: "2px 8px", borderRadius: "4px", background: `${LEVEL_COLORS[selectedCourse.level] || ACC}12`, color: LEVEL_COLORS[selectedCourse.level] || ACC, textTransform: "uppercase" }}>{selectedCourse.level}</span>
                  {selectedCourse.isTdlrApproved && <span style={{ ...mono, fontSize: "9px", padding: "2px 8px", borderRadius: "4px", background: `${AMBER}12`, color: AMBER }}>{selectedCourse.tdlrHours} CE hours</span>}
                </div>

                {/* What you'll learn */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ ...mono, fontSize: "9px", fontWeight: 700, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>What you&apos;ll learn</div>
                  {selectedCourse.description.split(". ").filter((s: string) => s.length > 20).slice(0, 3).map((point: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "7px", alignItems: "flex-start" }}>
                      <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: ACC, flexShrink: 0, marginTop: "6px" }} />
                      <span style={{ fontSize: "13px", color: MID, lineHeight: 1.6 }}>{point.trim().replace(/\.$/, "")}.</span>
                    </div>
                  ))}
                </div>

                {/* Instructor */}
                {selectedCourse.instructor && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: ACC_DIM, border: `1px solid ${ACC_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px", color: ACC_BRIGHT }}>person</span>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>{selectedCourse.instructor}</div>
                      <div style={{ fontSize: "9px", color: MUTED }}>Instructor</div>
                    </div>
                  </div>
                )}

                {/* Action */}
                {selectedCourse.isCompleted ? (
                  <div style={{ padding: "12px 16px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: GREEN }}>check_circle</span>
                    <span style={{ fontSize: "13px", color: GREEN, fontWeight: 600 }}>Completed{selectedCourse.completedAt ? ` on ${new Date(selectedCourse.completedAt).toLocaleDateString()}` : ""}</span>
                  </div>
                ) : (
                  <button onClick={() => markComplete(selectedCourse.id)} disabled={completing} style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg, ${ACC_BRIGHT}, ${ACC})`, border: "none", borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", ...jakarta, opacity: completing ? 0.7 : 1, boxShadow: `0 2px 16px rgba(96,110,116,0.25)` }}>
                    {completing ? "Marking Complete..." : "Mark as Complete"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" />
    </div>
  )
}
