"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useUserRole } from "@/hooks/useUserRole"

interface StaffMember { id: string; fullName: string; position: string; locationId: string }
interface ShiftData { start: string; end: string; isOff: boolean }
interface ScheduleShift {
  id: string; staffMemberId: string; date: string; startTime: string; endTime: string; isTimeOff: boolean
  staffMember: { fullName: string; position: string }
}
interface Schedule {
  id: string; locationId: string; weekStart: string; weekEnd: string; status: string
  rejectionNote?: string; shifts: ScheduleShift[]; location: { name: string }
}
interface Location { id: string; name: string }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOURS = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"]

function getWeekStart(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function parseTimeToHours(t: string): number {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return 0
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && h !== 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return h + m / 60
}

function calcTotalHours(staffShifts: Record<string, ShiftData> | undefined): number {
  if (!staffShifts) return 0
  let total = 0
  for (const sh of Object.values(staffShifts)) {
    if (sh.isOff || !sh.start || !sh.end) continue
    const diff = parseTimeToHours(sh.end) - parseTimeToHours(sh.start)
    if (diff > 0) total += diff
  }
  return total
}
function getWeekDates(ws: Date) { return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d }) }
function fmtDate(d: Date) { return d.toISOString().split("T")[0] }

const STATUS_COLOR: Record<string, string> = { draft: "#94A3B8", pending: "#F59E0B", approved: "#10B981", rejected: "#EF4444" }
const STATUS_LABEL: Record<string, string> = { draft: "Draft", pending: "Pending Approval", approved: "Approved", rejected: "Rejected" }

export default function SchedulePage() {
  const { data: session } = useSession()
  const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined
  const { isOwner, locationName: userLocation } = useUserRole()

  const [locations, setLocations] = useState<Location[]>([])
  const [selLoc, setSelLoc] = useState<Location | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [weekDates, setWeekDates] = useState(getWeekDates(getWeekStart(new Date())))
  const [shifts, setShifts] = useState<Record<string, Record<string, ShiftData>>>({})
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<"builder" | "list">("builder")
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(d => {
      setLocations(d.locations || [])
      if (d.locations?.length) setSelLoc(d.locations[0])
    })
  }, [])

  const loadStaff = useCallback(async (locId: string) => {
    const r = await fetch(`/api/staff/by-location?locationId=${locId}`)
    const d = await r.json(); setStaff(d.staff || [])
  }, [])

  const loadSchedules = useCallback(async (locId: string) => {
    setLoading(true)
    const r = await fetch(`/api/schedule?locationId=${locId}&weekStart=${fmtDate(weekStart)}`)
    const d = await r.json(); const list: Schedule[] = d.schedules || []
    setSchedules(list)
    const found = list.find(s => fmtDate(new Date(s.weekStart)) === fmtDate(weekStart))
    setSchedule(found || null)
    if (found) {
      const map: Record<string, Record<string, ShiftData>> = {}
      for (const sh of found.shifts) {
        const dk = fmtDate(new Date(sh.date))
        if (!map[sh.staffMemberId]) map[sh.staffMemberId] = {}
        map[sh.staffMemberId][dk] = { start: sh.startTime, end: sh.endTime, isOff: sh.isTimeOff }
      }
      setShifts(map)
    } else { setShifts({}) }
    setLoading(false)
  }, [weekStart])

  useEffect(() => { if (selLoc) { loadStaff(selLoc.id); loadSchedules(selLoc.id) } }, [selLoc, loadStaff, loadSchedules])
  useEffect(() => { setWeekDates(getWeekDates(weekStart)); if (selLoc) loadSchedules(selLoc.id) }, [weekStart, selLoc, loadSchedules])

  const createSchedule = async () => {
    if (!selLoc) return; setSaving(true)
    const we = new Date(weekStart); we.setDate(we.getDate() + 6)
    const r = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: selLoc.id, weekStart: weekStart.toISOString(), weekEnd: we.toISOString() }) })
    const d = await r.json(); setSchedule(d.schedule); setSaving(false)
  }

  const saveShifts = async () => {
    if (!schedule) return; setSaving(true)
    const arr = []
    for (const [sid, dates] of Object.entries(shifts))
      for (const [date, sh] of Object.entries(dates))
        if (sh.start && sh.end) arr.push({ staffMemberId: sid, date, startTime: sh.start, endTime: sh.end, isTimeOff: sh.isOff })
    await fetch("/api/schedule/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduleId: schedule.id, shifts: arr }) })
    setSaving(false); if (selLoc) loadSchedules(selLoc.id)
  }

  const submitForApproval = async () => {
    if (!schedule) return; setSaving(true)
    await fetch(`/api/schedule/${schedule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit" }) })
    setSaving(false); if (selLoc) loadSchedules(selLoc.id)
  }

  const approveSchedule = async (id: string) => {
    await fetch(`/api/schedule/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) })
    if (selLoc) loadSchedules(selLoc.id)
  }

  const rejectSchedule = async (id: string) => {
    await fetch(`/api/schedule/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", rejectionNote: rejectNote }) })
    setRejectModal(null); setRejectNote(""); if (selLoc) loadSchedules(selLoc.id)
  }

  const updateShift = (sid: string, dk: string, field: string, val: string | boolean) => {
    setShifts(p => ({ ...p, [sid]: { ...p[sid], [dk]: { ...p[sid]?.[dk], [field]: val } as ShiftData } }))
  }

  const canEdit = !schedule || schedule.status === "draft" || schedule.status === "rejected"
  const canSubmit = schedule && schedule.status === "draft"
  // isOwner comes from useUserRole hook

  const pill = (active: boolean) => ({ padding: "6px 14px", fontSize: "10px", fontWeight: 700 as const, letterSpacing: "0.08em", textTransform: "uppercase" as const, borderRadius: "6px", border: "none", cursor: "pointer" as const, backgroundColor: active ? "#CDC9C0" : "transparent", color: active ? "#0f1d24" : "rgba(205,201,192,0.5)", transition: "all 0.15s" })

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />

      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Schedule Builder</h1>
          <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>Build weekly schedules and submit for owner approval</p>
        </div>
        <div style={{ display: "inline-flex", gap: "2px", backgroundColor: "#0d1117", padding: "3px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)" }}>
          <button onClick={() => setView("builder")} style={pill(view === "builder")}>Builder</button>
          <button onClick={() => setView("list")} style={pill(view === "list")}>History</button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: "2px", backgroundColor: "#0d1117", padding: "3px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)" }}>
          {(isOwner ? locations : locations.filter(l => l.name === userLocation)).map(loc => (
            <button key={loc.id} onClick={() => setSelLoc(loc)} style={pill(selLoc?.id === loc.id)}>
              {loc.name === "Corpus Christi" ? "CC" : "SA"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#0d1117", padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)" }}>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }} style={{ background: "none", border: "none", color: "#CDC9C0", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}>{"\u2039"}</button>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#FFFFFF", whiteSpace: "nowrap" }}>Week of {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }} style={{ background: "none", border: "none", color: "#CDC9C0", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}>{"\u203A"}</button>
        </div>
        {schedule && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "8px", border: `1px solid ${STATUS_COLOR[schedule.status]}40` }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: STATUS_COLOR[schedule.status] }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: STATUS_COLOR[schedule.status], textTransform: "uppercase", letterSpacing: "0.08em" }}>{STATUS_LABEL[schedule.status]}</span>
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          {!schedule && <button onClick={createSchedule} disabled={saving} style={{ padding: "8px 16px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "7px", color: "#0f1d24", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>+ New Schedule</button>}
          {schedule && canEdit && <button onClick={saveShifts} disabled={saving} style={{ padding: "8px 16px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.3)", borderRadius: "7px", color: "#CDC9C0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>{saving ? "Saving..." : "Save Draft"}</button>}
          {canSubmit && canEdit && <button onClick={submitForApproval} disabled={saving} style={{ padding: "8px 16px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "7px", color: "#0f1d24", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>Submit for Approval</button>}
          {isOwner && schedule?.status === "pending" && (
            <>
              <button onClick={() => setRejectModal(schedule.id)} style={{ padding: "8px 16px", backgroundColor: "transparent", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "7px", color: "#FCA5A5", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>Reject</button>
              <button onClick={() => approveSchedule(schedule.id)} style={{ padding: "8px 16px", backgroundColor: "#10B981", border: "none", borderRadius: "7px", color: "#FFFFFF", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>{"\u2713"} Approve</button>
            </>
          )}
        </div>
      </div>

      {/* Rejection note */}
      {schedule?.status === "rejected" && schedule.rejectionNote && (
        <div style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "10px" }}>
          <span className="material-symbols-outlined" style={{ color: "#EF4444", fontSize: "18px", flexShrink: 0 }}>cancel</span>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#EF4444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px" }}>Schedule Rejected</div>
            <div style={{ fontSize: "13px", color: "#FCA5A5" }}>{schedule.rejectionNote}</div>
          </div>
        </div>
      )}

      {view === "builder" && (
        <>
          {!schedule ? (
            <div style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "60px", textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)", display: "block", marginBottom: "16px" }}>calendar_month</span>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>No schedule for this week</p>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Create a new schedule to start assigning shifts.</p>
              <button onClick={createSchedule} style={{ padding: "10px 24px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "7px", color: "#0f1d24", fontSize: "12px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>Create Schedule</button>
            </div>
          ) : loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "20px 0" }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ height: 60, background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "pulse 2s infinite" }} />
              ))}
            </div>
          ) : (
            !isMobile ? (
            <div style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#0f1d24" }}>
                    <th style={{ padding: "12px 16px", fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", textAlign: "left", width: "160px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Staff</th>
                    {weekDates.map((date, i) => {
                      const isToday = date.toDateString() === new Date().toDateString()
                      return (
                        <th key={i} style={{ padding: "12px 8px", fontSize: "10px", fontWeight: 700, color: isToday ? "#CDC9C0" : "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", borderLeft: "1px solid rgba(255,255,255,0.04)" }}>
                          <div>{DAYS[date.getDay()]}</div>
                          <div style={{ fontSize: "11px", fontWeight: 800, color: isToday ? "#CDC9C0" : "#FFFFFF", marginTop: "2px" }}>{date.getDate()}</div>
                        </th>
                      )
                    })}
                    <th style={{ padding: "12px 8px", fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", borderLeft: "1px solid rgba(255,255,255,0.04)", width: "70px" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((m, ri) => (
                    <tr key={m.id} style={{ backgroundColor: ri % 2 === 0 ? "transparent" : "rgba(205,201,192,0.02)" }}>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(205,201,192,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#CDC9C0", flexShrink: 0 }}>
                            {m.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#FFFFFF" }}>{m.fullName.split(" ")[0]}</div>
                            <div style={{ fontSize: "9px", color: "rgba(205,201,192,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.position}</div>
                          </div>
                        </div>
                      </td>
                      {weekDates.map(date => {
                        const dk = fmtDate(date)
                        const sh = shifts[m.id]?.[dk]
                        return (
                          <td key={dk} style={{ padding: "6px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(205,201,192,0.04)", textAlign: "center", verticalAlign: "middle" }}>
                            {canEdit ? (
                              sh?.isOff ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#EF4444", textTransform: "uppercase" }}>Off</span>
                                  <button onClick={() => updateShift(m.id, dk, "isOff", false)} style={{ fontSize: "9px", color: "rgba(205,201,192,0.4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>clear</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                  <select value={sh?.start || ""} onChange={e => updateShift(m.id, dk, "start", e.target.value)} style={{ width: "80px", padding: "3px 4px", backgroundColor: sh?.start ? "#142127" : "rgba(205,201,192,0.04)", border: `1px solid ${sh?.start ? "rgba(205,201,192,0.3)" : "rgba(205,201,192,0.1)"}`, borderRadius: "4px", color: sh?.start ? "#FFFFFF" : "rgba(205,201,192,0.3)", fontSize: "10px", cursor: "pointer" }}>
                                    <option value="">Start</option>
                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <select value={sh?.end || ""} onChange={e => updateShift(m.id, dk, "end", e.target.value)} style={{ width: "80px", padding: "3px 4px", backgroundColor: sh?.end ? "#142127" : "rgba(205,201,192,0.04)", border: `1px solid ${sh?.end ? "rgba(205,201,192,0.3)" : "rgba(205,201,192,0.1)"}`, borderRadius: "4px", color: sh?.end ? "#FFFFFF" : "rgba(205,201,192,0.3)", fontSize: "10px", cursor: "pointer" }}>
                                    <option value="">End</option>
                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <button onClick={() => updateShift(m.id, dk, "isOff", true)} style={{ fontSize: "9px", color: "rgba(239,68,68,0.5)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>off</button>
                                </div>
                              )
                            ) : (
                              sh?.isOff ? (
                                <span style={{ fontSize: "10px", fontWeight: 700, color: "#EF4444" }}>OFF</span>
                              ) : sh?.start ? (
                                <div style={{ fontSize: "10px", color: "#CDC9C0", fontWeight: 600 }}>
                                  <div>{sh.start}</div>
                                  <div style={{ color: "rgba(205,201,192,0.4)" }}>{"\u2013"}</div>
                                  <div>{sh.end}</div>
                                </div>
                              ) : (
                                <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.2)" }}>{"\u2014"}</span>
                              )
                            )}
                          </td>
                        )
                      })}
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.04)", textAlign: "center", verticalAlign: "middle" }}>
                        {(() => { const hrs = calcTotalHours(shifts[m.id]); return hrs > 0 ? (
                          <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: "10px", backgroundColor: "rgba(205,201,192,0.1)", fontSize: "10px", fontWeight: 700, color: "#CDC9C0" }}>{hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hrs</span>
                        ) : <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.2)" }}>{"\u2014"}</span> })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {staff.map(m => {
                const hrs = calcTotalHours(shifts[m.id])
                return (
                  <div key={m.id} style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(205,201,192,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#CDC9C0", flexShrink: 0 }}>
                          {m.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>{m.fullName}</div>
                          <div style={{ fontSize: "9px", color: "rgba(205,201,192,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.position}</div>
                        </div>
                      </div>
                      {hrs > 0 && <span style={{ padding: "3px 8px", borderRadius: "10px", backgroundColor: "rgba(205,201,192,0.1)", fontSize: "10px", fontWeight: 700, color: "#CDC9C0" }}>{hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hrs</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {weekDates.map(date => {
                        const dk = fmtDate(date)
                        const sh = shifts[m.id]?.[dk]
                        const isToday = date.toDateString() === new Date().toDateString()
                        return (
                          <div key={dk} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: isToday ? "#CDC9C0" : "rgba(205,201,192,0.5)", width: "36px", flexShrink: 0 }}>{DAYS[date.getDay()]}</span>
                            {canEdit ? (
                              sh?.isOff ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#EF4444" }}>OFF</span>
                                  <button onClick={() => updateShift(m.id, dk, "isOff", false)} style={{ fontSize: "9px", color: "rgba(205,201,192,0.4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>clear</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
                                  <select value={sh?.start || ""} onChange={e => updateShift(m.id, dk, "start", e.target.value)} style={{ flex: 1, padding: "4px 6px", backgroundColor: sh?.start ? "#142127" : "rgba(205,201,192,0.04)", border: `1px solid ${sh?.start ? "rgba(205,201,192,0.3)" : "rgba(205,201,192,0.1)"}`, borderRadius: "4px", color: sh?.start ? "#FFFFFF" : "rgba(205,201,192,0.3)", fontSize: "11px", cursor: "pointer" }}>
                                    <option value="">Start</option>
                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <span style={{ color: "rgba(205,201,192,0.3)", fontSize: "10px" }}>to</span>
                                  <select value={sh?.end || ""} onChange={e => updateShift(m.id, dk, "end", e.target.value)} style={{ flex: 1, padding: "4px 6px", backgroundColor: sh?.end ? "#142127" : "rgba(205,201,192,0.04)", border: `1px solid ${sh?.end ? "rgba(205,201,192,0.3)" : "rgba(205,201,192,0.1)"}`, borderRadius: "4px", color: sh?.end ? "#FFFFFF" : "rgba(205,201,192,0.3)", fontSize: "11px", cursor: "pointer" }}>
                                    <option value="">End</option>
                                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <button onClick={() => updateShift(m.id, dk, "isOff", true)} style={{ fontSize: "9px", color: "rgba(239,68,68,0.5)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>off</button>
                                </div>
                              )
                            ) : (
                              <div style={{ flex: 1, fontSize: "11px" }}>
                                {sh?.isOff ? (
                                  <span style={{ fontWeight: 700, color: "#EF4444" }}>OFF</span>
                                ) : sh?.start ? (
                                  <span style={{ color: "#CDC9C0", fontWeight: 600 }}>{sh.start} - {sh.end}</span>
                                ) : (
                                  <span style={{ color: "rgba(205,201,192,0.2)" }}>{"\u2014"}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            )
          )}

          {/* Visual Hour Grid */}
          {schedule && !loading && Object.keys(shifts).length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>
                Visual Overview
              </div>
              <div style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", overflow: "hidden" }}>
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ padding: "8px", fontSize: "9px", color: "rgba(205,201,192,0.3)" }} />
                  {weekDates.map((date, i) => {
                    const today = date.toDateString() === new Date().toDateString()
                    return (
                      <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: "10px", fontWeight: 700, color: today ? "#CDC9C0" : "rgba(205,201,192,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", backgroundColor: today ? "rgba(122,143,150,0.04)" : "transparent" }}>
                        {DAYS[date.getDay()]} {date.getDate()}
                      </div>
                    )
                  })}
                </div>
                {/* Hour rows */}
                <div style={{ position: "relative", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
                  {HOURS.map((hour) => (
                    <div key={hour} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", height: "60px", borderBottom: "1px solid #1a2332" }}>
                      <div style={{ padding: "4px 8px", fontSize: "11px", fontFamily: "Fira Code, monospace", color: "#606E74", display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
                        {hour}
                      </div>
                      {weekDates.map((date, di) => {
                        const dk = fmtDate(date)
                        const today = date.toDateString() === new Date().toDateString()
                        const hourVal = parseTimeToHours(hour)
                        const shiftsInHour = staff.filter(m => {
                          const sh = shifts[m.id]?.[dk]
                          if (!sh || !sh.start || !sh.end) return false
                          const start = parseTimeToHours(sh.start)
                          const end = parseTimeToHours(sh.end)
                          return hourVal >= start && hourVal < end
                        })
                        return (
                          <div key={di} style={{ borderLeft: "1px solid rgba(205,201,192,0.04)", padding: "2px", backgroundColor: today ? "rgba(122,143,150,0.04)" : "transparent", display: "flex", flexDirection: "column", gap: "1px", overflow: "hidden" }}>
                            {shiftsInHour.map(m => {
                              const sh = shifts[m.id]?.[dk]
                              const isOff = sh?.isOff
                              return (
                                <div key={m.id} style={{ backgroundColor: isOff ? "rgba(239,68,68,0.1)" : "rgba(96,110,116,0.2)", borderLeft: isOff ? "3px solid #ef4444" : "3px solid #7a8f96", borderRadius: "4px", padding: "2px 6px", fontSize: "9px", color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "14px" }}>
                                  {m.fullName.split(" ")[0]}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {schedules.length === 0 ? (
            <div style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "60px", textAlign: "center" }}>
              <p style={{ color: "#94A3B8" }}>No schedules found.</p>
            </div>
          ) : schedules.map(s => (
            <div key={s.id} style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: STATUS_COLOR[s.status], flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginBottom: "3px" }}>
                    Week of {new Date(s.weekStart).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                    {s.shifts.length} shifts · {s.location.name}
                    {s.rejectionNote && <span style={{ color: "#EF4444", marginLeft: "8px" }}>Rejected: {s.rejectionNote}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", backgroundColor: `${STATUS_COLOR[s.status]}15`, color: STATUS_COLOR[s.status], textTransform: "uppercase", letterSpacing: "0.08em" }}>{STATUS_LABEL[s.status]}</span>
                {isOwner && s.status === "pending" && (
                  <>
                    <button onClick={() => setRejectModal(s.id)} style={{ padding: "6px 12px", backgroundColor: "transparent", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "6px", color: "#FCA5A5", fontSize: "10px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>Reject</button>
                    <button onClick={() => approveSchedule(s.id)} style={{ padding: "6px 12px", backgroundColor: "#10B981", border: "none", borderRadius: "6px", color: "#FFFFFF", fontSize: "10px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>Approve</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "440px", margin: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>Reject Schedule</h3>
            <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 16px" }}>Provide a reason so the manager knows what to fix.</p>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="e.g. Please add coverage for Saturday afternoon..." rows={3} style={{ width: "100%", padding: "10px 14px", backgroundColor: "#0f1d24", border: "1px solid rgba(205,201,192,0.2)", borderRadius: "7px", color: "#FFFFFF", fontSize: "13px", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: "16px" }} />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => { setRejectModal(null); setRejectNote("") }} style={{ padding: "9px 18px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.2)", borderRadius: "7px", color: "#CDC9C0", fontSize: "11px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>Cancel</button>
              <button onClick={() => rejectSchedule(rejectModal)} disabled={!rejectNote} style={{ padding: "9px 18px", backgroundColor: "#EF4444", border: "none", borderRadius: "7px", color: "#FFFFFF", fontSize: "11px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", opacity: !rejectNote ? 0.5 : 1 }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
