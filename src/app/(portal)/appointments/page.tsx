"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"
import Link from "next/link"
import { TEAM_NAMES, CC_STYLISTS, SA_STYLISTS } from "@/lib/staff"
function getLocationStylists(loc: string) {
  return loc === "San Antonio" ? SA_STYLISTS : CC_STYLISTS
}

const LOCATIONS = ["Corpus Christi", "San Antonio"]

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ACCEPTED: { bg: "rgba(16,185,129,0.08)", text: "#10B981", border: "#10B981" },
  PENDING: { bg: "rgba(251,191,36,0.08)", text: "#FBBF24", border: "#FBBF24" },
  CANCELLED_BY_SELLER: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444" },
  CANCELLED_BY_BUYER: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444" },
  DECLINED: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444" },
  NO_SHOW: { bg: "rgba(156,163,175,0.08)", text: "#9CA3AF", border: "#9CA3AF" },
}

const DEFAULT_STATUS = { bg: "rgba(205,201,192,0.06)", text: "rgba(205,201,192,0.5)", border: "rgba(205,201,192,0.3)" }

const STYLIST_COLORS: Record<string, string> = {
  // SA
  TMMJKxeQuMlMW1Dw: "#4F8EF7", TMcc0QbHuUZfgcIB: "#9B59B6", "TMfFCmgJ5RV-WCBq": "#E67E22",
  TM5CjcvcHRXZQ4hP: "#E91E8C", TMk1YstlrnPrKw8p: "#1ABC9C", TMltRlD4OaczAnJr: "#1ABC9C",
  // CC
  TMbc13IBzS8Z43AO: "#F44336", TMaExUyYaWYlvSqh: "#FF9800", TMCzd3unwciKEVX7: "#8BC34A",
  TMn7kInT8g7Vrgxi: "#00BCD4", TMMdDDwU8WXpCZ9m: "#9C27B0", TM_xI40vPph2_Cos: "#795548",
}

type WaitlistItem = { id: string; customerName: string; customerPhone: string; requestedDate: string; requestedStylist: string | null; requestedService: string | null; notes: string | null; status: string; createdAt: string }

interface AppointmentService {
  serviceName: string
  price: number
  durationMinutes: number
  serviceVariationId?: string
}

interface Appointment {
  id: string
  customerId?: string | null
  customerName: string
  customerPhone: string
  customerEmail?: string
  startTime: string
  endTime?: string | null
  teamMemberId: string | null
  status: string
  services?: AppointmentService[]
  totalPrice?: number
  totalDurationMinutes?: number
  note?: string | null
  isCheckedOut?: boolean
  orderId?: string
}

export default function AppointmentsPage() {
  const { isOwner, isManager, locationName } = useUserRole()

  const [isMobile, setIsMobile] = useState(false)
  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [location, setLocation] = useState(locationName || "Corpus Christi")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [stylistFilter, setStylistFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "day">("list")
  const [showBooking, setShowBooking] = useState(false)
  const [bookStep, setBookStep] = useState(1)
  const [bookClient, setBookClient] = useState<{ id: string; name: string } | null>(null)
  const [bookStylist, setBookStylist] = useState("")
  const [bookDate, setBookDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` })
  const [bookTime, setBookTime] = useState("10:00")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookServices, setBookServices] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookSelectedSvcs, setBookSelectedSvcs] = useState<any[]>([])
  const [bookNotes, setBookNotes] = useState("")
  const [bookSaving, setBookSaving] = useState(false)
  const [bookError, setBookError] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientResults, setClientResults] = useState<any[]>([])
  const [clientSearching, setClientSearching] = useState(false)
  const [newClient, setNewClient] = useState(false)
  const [newClientForm, setNewClientForm] = useState({ givenName: "", familyName: "", phone: "", email: "" })
  const [bookOverlap, setBookOverlap] = useState(false)
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([])
  const [wlForm, setWlForm] = useState({ customerName: "", customerPhone: "", requestedDate: "", requestedStylist: "", notes: "" })
  const [wlSaving, setWlSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("date", date)
      params.set("all", "true")
      if (isOwner && location) params.set("location", location)
      const res = await fetch(`/api/pos/appointments?${params}`)
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [date, isOwner, location])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const locCode = location === "San Antonio" ? "SA" : "CC"
  const fetchWaitlist = useCallback(async () => {
    try { const r = await fetch(`/api/waitlist?locationId=${locCode}`); const d = await r.json(); setWaitlist(d.entries || []) } catch { /* */ }
  }, [locCode])
  useEffect(() => { fetchWaitlist() }, [fetchWaitlist])

  async function addToWaitlist() {
    if (!wlForm.customerName || !wlForm.customerPhone) return
    setWlSaving(true)
    try {
      await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...wlForm, locationId: locCode }) })
      setWlForm({ customerName: "", customerPhone: "", requestedDate: "", requestedStylist: "", notes: "" })
      fetchWaitlist()
      setToast("Added to waitlist")
      setTimeout(() => setToast(null), 3000)
    } catch { /* */ }
    setWlSaving(false)
  }

  async function updateWaitlistStatus(id: string, status: string) {
    await fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    fetchWaitlist()
  }

  // Booking modal handlers
  async function searchClients(q: string) {
    setClientSearch(q); if (q.length < 2) { setClientResults([]); return }
    setClientSearching(true)
    try { const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`); const d = await r.json(); setClientResults(d.customers || []) } catch { /**/ }
    setClientSearching(false)
  }

  async function createNewClient() {
    if (!newClientForm.givenName) return
    setBookSaving(true)
    try {
      const r = await fetch("/api/customers/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newClientForm) })
      const d = await r.json()
      if (d.customer?.id) { setBookClient({ id: d.customer.id, name: `${d.customer.givenName} ${d.customer.familyName}`.trim() }); setNewClient(false); setBookStep(2) }
      else setBookError(d.error || "Failed to create client")
    } catch { setBookError("Network error") }
    setBookSaving(false)
  }

  useEffect(() => { if (showBooking && bookStep === 3 && bookServices.length === 0) { fetch("/api/catalog/services").then(r => r.json()).then(d => setBookServices(d.services || [])).catch(() => {}) } }, [showBooking, bookStep, bookServices.length])

  function checkOverlap(): boolean {
    const startH = parseInt(bookTime.split(":")[0]); const startM = parseInt(bookTime.split(":")[1])
    const dur = bookSelectedSvcs.reduce((s, sv) => s + (sv.durationMinutes || 60), 0)
    const newStart = new Date(`${bookDate}T${bookTime}:00`).getTime(); const newEnd = newStart + dur * 60000
    return appointments.some(a => {
      if (a.teamMemberId !== bookStylist || !a.startTime) return false
      const aStart = new Date(a.startTime).getTime(); const aEnd = aStart + (a.totalDurationMinutes || 60) * 60000
      return aStart < newEnd && aEnd > newStart
    })
  }

  async function submitBooking() {
    if (!bookClient || !bookStylist || bookSelectedSvcs.length === 0) return
    if (!bookOverlap && checkOverlap()) { setBookOverlap(true); return }
    setBookSaving(true); setBookError("")
    // Convert local time to UTC ISO
    const localDate = new Date(`${bookDate}T${bookTime}:00`)
    const utcISO = localDate.toISOString()
    try {
      const r = await fetch("/api/bookings/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: location === "San Antonio" ? "SA" : "CC", customerId: bookClient.id, stylistId: bookStylist, startAt: utcISO, services: bookSelectedSvcs, notes: bookNotes }) })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || "Booking failed")
      setShowBooking(false); resetBooking(); fetchAppointments()
      setToast("Appointment booked successfully"); setTimeout(() => setToast(null), 3000)
    } catch (e: unknown) { setBookError(e instanceof Error ? e.message : "Failed") }
    setBookSaving(false)
  }

  function resetBooking() { setBookStep(1); setBookClient(null); setBookStylist(""); setBookDate(date); setBookTime("10:00"); setBookSelectedSvcs([]); setBookNotes(""); setBookError(""); setBookOverlap(false); setClientSearch(""); setClientResults([]); setNewClient(false); setNewClientForm({ givenName: "", familyName: "", phone: "", email: "" }) }

  function openBookingModal() { resetBooking(); setShowBooking(true) }

  // Filter by stylist and sort by startTime
  const sorted = useMemo(() => {
    const filtered = stylistFilter === "all"
      ? appointments
      : appointments.filter(a => a.teamMemberId === stylistFilter)
    return [...filtered].sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })
  }, [appointments, stylistFilter])

  const navigateDate = (delta: number) => {
    const d = new Date(date + "T12:00:00")
    d.setDate(d.getDate() + delta)
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
  }

  const goToday = () => {
    const d = new Date()
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
  }

  const displayDate = useMemo(() => {
    const d = new Date(date + "T12:00:00")
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  }, [date])

  const isToday = useMemo(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    return date === today
  }, [date])

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    } catch { return iso }
  }

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

  const getStatusStyle = (status: string) => STATUS_COLORS[status] || DEFAULT_STATUS

  return (
    <div style={{ padding: isMobile ? "16px" : "24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <h1 style={{ fontSize: isMobile ? "22px" : "24px", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
            Appointments
          </h1>
          {isOwner && (
            <div style={{ display: "flex", gap: "4px" }}>
              {LOCATIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLocation(l)}
                  style={{
                    padding: "7px 14px",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: location === l ? "#CDC9C0" : "rgba(205,201,192,0.06)",
                    color: location === l ? "#0f1d24" : "rgba(205,201,192,0.45)",
                  }}
                >
                  {l === "Corpus Christi" ? "CC" : "SA"}
                </button>
              ))}
            </div>
          )}
          <button onClick={openBookingModal} style={{
            padding: "7px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            borderRadius: "6px", border: "none", cursor: "pointer", backgroundColor: "#CDC9C0", color: "#0f1d24",
          }}>New Appointment</button>
          <button onClick={() => setShowWaitlist(!showWaitlist)} style={{
            padding: "7px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            borderRadius: "6px", border: showWaitlist ? "1px solid #CDC9C0" : "1px solid rgba(205,201,192,0.15)",
            backgroundColor: showWaitlist ? "rgba(205,201,192,0.12)" : "transparent",
            color: showWaitlist ? "#CDC9C0" : "rgba(205,201,192,0.45)", cursor: "pointer",
          }}>Waitlist{waitlist.length > 0 ? ` (${waitlist.length})` : ""}</button>
        </div>

        {/* Date navigator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}>
          <button onClick={() => navigateDate(-1)} style={{
            width: "36px", height: "36px", borderRadius: "8px",
            backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.12)",
            color: "rgba(205,201,192,0.6)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_left</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                padding: "8px 12px",
                backgroundColor: "#1a2a32",
                border: "1px solid rgba(205,201,192,0.15)",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 600,
                outline: "none",
                colorScheme: "dark",
              }}
            />
            {!isToday && (
              <button onClick={goToday} style={{
                padding: "8px 14px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: "6px",
                border: "1px solid rgba(205,201,192,0.15)",
                backgroundColor: "transparent",
                color: "#CDC9C0",
                cursor: "pointer",
              }}>
                Today
              </button>
            )}
          </div>

          <button onClick={() => navigateDate(1)} style={{
            width: "36px", height: "36px", borderRadius: "8px",
            backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.12)",
            color: "rgba(205,201,192,0.6)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
          </button>

          <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(205,201,192,0.55)", marginLeft: "4px" }}>
            {displayDate}
          </span>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: "4px", marginTop: "12px" }}>
          {(["list", "day"] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              style={{
                padding: "7px 14px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                backgroundColor: viewMode === v ? "#CDC9C0" : "rgba(205,201,192,0.06)",
                color: viewMode === v ? "#0f1d24" : "rgba(205,201,192,0.45)",
              }}
            >
              {v === "list" ? "List" : "Day"}
            </button>
          ))}
        </div>

        {/* Stylist filter pills */}
        <div style={{
          display: "flex",
          gap: "6px",
          marginTop: "12px",
          overflowX: "auto",
          paddingBottom: "4px",
          WebkitOverflowScrolling: "touch",
        }}>
          <button
            onClick={() => setStylistFilter("all")}
            style={{
              padding: "6px 12px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              backgroundColor: stylistFilter === "all" ? "#CDC9C0" : "rgba(205,201,192,0.06)",
              color: stylistFilter === "all" ? "#0f1d24" : "rgba(205,201,192,0.45)",
            }}
          >
            All Stylists
          </button>
          {getLocationStylists(location).map(s => (
            <button
              key={s.id}
              onClick={() => setStylistFilter(s.id)}
              style={{
                padding: "6px 12px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                backgroundColor: stylistFilter === s.id ? "#CDC9C0" : "rgba(205,201,192,0.06)",
                color: stylistFilter === s.id ? "#0f1d24" : "rgba(205,201,192,0.45)",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment list / day view */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(205,201,192,0.35)", fontSize: "13px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", display: "block", marginBottom: "8px", opacity: 0.4 }}>hourglass_empty</span>
          Loading appointments...
        </div>
      ) : sorted.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          backgroundColor: "#1a2a32", borderRadius: "12px",
          border: "1px solid rgba(205,201,192,0.08)",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", display: "block", marginBottom: "12px", color: "rgba(205,201,192,0.2)" }}>event_busy</span>
          <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "14px", fontWeight: 600 }}>
            No appointments {isToday ? "today" : "on this day"}
          </div>
          <div style={{ color: "rgba(205,201,192,0.25)", fontSize: "12px", marginTop: "4px" }}>
            {isToday ? "All clear! No bookings scheduled." : "Try selecting a different date."}
          </div>
        </div>
      ) : viewMode === "day" ? (
        /* ── Day View (24-hour timeline) ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "0px", marginTop: "8px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
            {sorted.length} Appointment{sorted.length !== 1 ? "s" : ""} &middot; Day View
          </div>
          {Array.from({ length: 24 }, (_, hour) => {
            const isBusinessHour = hour >= 9 && hour <= 20
            const hourAppts = sorted.filter(a => {
              try { return new Date(a.startTime).getHours() === hour } catch { return false }
            })
            return (
              <div key={hour} style={{
                display: "flex",
                minHeight: hourAppts.length > 0 ? "auto" : "36px",
                borderBottom: "1px solid rgba(205,201,192,0.06)",
                backgroundColor: isBusinessHour ? "rgba(205,201,192,0.02)" : "transparent",
              }}>
                {/* Hour label */}
                <div style={{
                  width: "60px",
                  flexShrink: 0,
                  padding: "8px 8px 8px 0",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: isBusinessHour ? "rgba(205,201,192,0.5)" : "rgba(205,201,192,0.2)",
                  textAlign: "right",
                  borderRight: "1px solid rgba(205,201,192,0.08)",
                }}>
                  {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                </div>
                {/* Appointments in this hour */}
                <div style={{ flex: 1, padding: hourAppts.length > 0 ? "6px 10px" : "0 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {hourAppts.map(appt => {
                    const statusStyle = getStatusStyle(appt.status)
                    return (
                      <div key={appt.id} style={{
                        padding: "8px 12px",
                        backgroundColor: "#1a2a32",
                        border: "1px solid rgba(205,201,192,0.08)",
                        borderLeft: `3px solid ${(appt.teamMemberId && STYLIST_COLORS[appt.teamMemberId]) || statusStyle.border}`,
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#FFFFFF", fontSize: "13px", fontWeight: 700 }}>
                            {appt.customerName}
                          </span>
                          <span style={{
                            fontSize: "8px", fontWeight: 700, padding: "2px 6px", borderRadius: "3px",
                            backgroundColor: statusStyle.bg, color: statusStyle.text,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                          }}>
                            {appt.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "rgba(205,201,192,0.55)", fontWeight: 500 }}>
                          <span>{fmtTime(appt.startTime)}{appt.endTime ? ` - ${fmtTime(appt.endTime)}` : ""}</span>
                          {appt.teamMemberId && (
                            <span>{TEAM_NAMES[appt.teamMemberId] || appt.teamMemberId.slice(0, 8)}</span>
                          )}
                        </div>
                        {appt.services && appt.services.length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {appt.services.map((s, i) => (
                              <span key={i} style={{
                                fontSize: "9px", fontWeight: 600, padding: "2px 6px",
                                borderRadius: "3px", backgroundColor: "rgba(205,201,192,0.06)",
                                color: "rgba(205,201,192,0.5)",
                              }}>
                                {s.serviceName}
                              </span>
                            ))}
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
      ) : (
        /* ── List View ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2px" }}>
            {sorted.length} Appointment{sorted.length !== 1 ? "s" : ""}
          </div>
          {sorted.map((appt) => {
            const isExpanded = expandedId === appt.id
            const statusStyle = getStatusStyle(appt.status)
            return (
              <div key={appt.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : appt.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "16px",
                    backgroundColor: "#1a2a32",
                    border: appt.isCheckedOut ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(205,201,192,0.08)",
                    borderLeft: `3px solid ${(appt.teamMemberId && STYLIST_COLORS[appt.teamMemberId]) || (appt.isCheckedOut ? "rgba(16,185,129,0.3)" : statusStyle.border)}`,
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    opacity: appt.isCheckedOut ? 0.5 : 1,
                  }}
                >
                  {/* Top row: name + status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 700 }}>
                      {appt.customerName}
                    </span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {appt.isCheckedOut && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px",
                          backgroundColor: "rgba(16,185,129,0.12)", color: "#22c55e",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>
                          Checked Out
                        </span>
                      )}
                      <span style={{
                        fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px",
                        backgroundColor: statusStyle.bg, color: statusStyle.text,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {appt.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Time + Stylist row */}
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "rgba(205,201,192,0.55)", fontWeight: 500, alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>schedule</span>
                      {fmtTime(appt.startTime)}
                      {appt.endTime && ` - ${fmtTime(appt.endTime)}`}
                    </span>
                    {appt.teamMemberId && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>person</span>
                        {TEAM_NAMES[appt.teamMemberId] || appt.teamMemberId.slice(0, 8)}
                      </span>
                    )}
                  </div>

                  {/* Services badges + price */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {appt.services && appt.services.length > 0 ? (
                        appt.services.map((s, i) => (
                          <span key={i} style={{
                            fontSize: "10px", fontWeight: 600, padding: "3px 8px",
                            borderRadius: "4px", backgroundColor: "rgba(205,201,192,0.06)",
                            color: "rgba(205,201,192,0.55)",
                          }}>
                            {s.serviceName}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: "10px", color: "rgba(205,201,192,0.3)" }}>No service details</span>
                      )}
                    </div>
                    {appt.totalPrice != null && appt.totalPrice > 0 && (
                      <span style={{ fontSize: "14px", fontWeight: 800, color: "#CDC9C0" }}>
                        {fmtCurrency(appt.totalPrice)}
                      </span>
                    )}
                  </div>

                  {/* Checkout link for confirmed */}
                  {(appt.status === "ACCEPTED" || appt.status === "PENDING") && (
                    <Link
                      href={`/pos`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        fontSize: "10px", fontWeight: 700, color: "#CDC9C0",
                        textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase",
                        marginTop: "2px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>point_of_sale</span>
                      Checkout in POS
                    </Link>
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    margin: "-6px 0 0 3px",
                    padding: "14px 16px",
                    backgroundColor: "rgba(26,42,50,0.7)",
                    border: "1px solid rgba(205,201,192,0.08)",
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}>
                    {/* Service details */}
                    {appt.services && appt.services.length > 0 && (
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
                          Services
                        </div>
                        {appt.services.map((s, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "12px" }}>
                            <span style={{ color: "rgba(205,201,192,0.7)" }}>
                              {s.serviceName} ({s.durationMinutes} min)
                            </span>
                            <span style={{ color: "#CDC9C0", fontWeight: 600 }}>
                              {s.price > 0 ? fmtCurrency(s.price) : "--"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Customer contact */}
                    <div>
                      <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
                        Contact
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)" }}>
                        {appt.customerPhone ? (
                          <div style={{ marginBottom: "2px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px", verticalAlign: "middle", marginRight: "4px" }}>phone</span>
                            {appt.customerPhone}
                          </div>
                        ) : null}
                        {appt.customerEmail ? (
                          <div>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px", verticalAlign: "middle", marginRight: "4px" }}>mail</span>
                            {appt.customerEmail}
                          </div>
                        ) : null}
                        {!appt.customerPhone && !appt.customerEmail && (
                          <span style={{ color: "rgba(205,201,192,0.3)" }}>No contact info</span>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {appt.note && (
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
                          Notes
                        </div>
                        <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", fontStyle: "italic" }}>
                          {appt.note}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Stylist color legend */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px", marginBottom: "12px" }}>
        {getLocationStylists(location).map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "rgba(205,201,192,0.6)" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: STYLIST_COLORS[s.id] || "#666" }} />
            {s.name}
          </div>
        ))}
      </div>

      {/* Waitlist panel */}
      {showWaitlist && (
        <div style={{ marginTop: "16px", backgroundColor: "#1a2a32", borderRadius: "12px", border: "1px solid rgba(205,201,192,0.08)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(205,201,192,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>Waitlist — {location === "Corpus Christi" ? "CC" : "SA"}</span>
          </div>
          {/* Add form */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(205,201,192,0.08)", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>Name</div>
              <input value={wlForm.customerName} onChange={e => setWlForm(p => ({ ...p, customerName: e.target.value }))} style={{ width: "100%", padding: "7px 10px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "6px", color: "#fff", fontSize: "13px", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>Phone</div>
              <input value={wlForm.customerPhone} onChange={e => setWlForm(p => ({ ...p, customerPhone: e.target.value }))} style={{ width: "100%", padding: "7px 10px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "6px", color: "#fff", fontSize: "13px", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: "100px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>Notes</div>
              <input value={wlForm.notes} onChange={e => setWlForm(p => ({ ...p, notes: e.target.value }))} placeholder="Service, stylist..." style={{ width: "100%", padding: "7px 10px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "6px", color: "#fff", fontSize: "13px", outline: "none" }} />
            </div>
            <button onClick={addToWaitlist} disabled={wlSaving || !wlForm.customerName} style={{ padding: "7px 16px", backgroundColor: "#CDC9C0", color: "#0f1d24", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", opacity: !wlForm.customerName ? 0.5 : 1 }}>{wlSaving ? "..." : "Add"}</button>
          </div>
          {/* Entries */}
          {waitlist.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "rgba(205,201,192,0.4)", fontSize: "13px" }}>No one on the waitlist</div>
          ) : waitlist.map(w => (
            <div key={w.id} style={{ padding: "12px 20px", borderBottom: "1px solid rgba(205,201,192,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{w.customerName}</div>
                <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)" }}>{w.customerPhone}{w.notes ? ` — ${w.notes}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => updateWaitlistStatus(w.id, "booked")} style={{ padding: "4px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "4px", backgroundColor: "transparent", color: "#10B981", cursor: "pointer" }}>Booked</button>
                <button onClick={() => updateWaitlistStatus(w.id, "removed")} style={{ padding: "4px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", backgroundColor: "transparent", color: "#EF4444", cursor: "pointer" }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      {showBooking && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "500px", maxHeight: "85vh", overflow: "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "#fff" }}>New Appointment</h2>
              <button onClick={() => setShowBooking(false)} style={{ background: "none", border: "none", color: "rgba(205,201,192,0.5)", cursor: "pointer", fontSize: "20px" }}>&times;</button>
            </div>
            {/* Step indicator */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
              {[1,2,3,4].map(s => <div key={s} style={{ flex: 1, height: "3px", borderRadius: "2px", backgroundColor: bookStep >= s ? "#CDC9C0" : "rgba(205,201,192,0.15)" }} />)}
            </div>

            {/* Step 1 — Client */}
            {bookStep === 1 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "10px" }}>Step 1 — Client</div>
                {!newClient ? (<>
                  <input value={clientSearch} onChange={e => searchClients(e.target.value)} placeholder="Search client by name, phone, or email..." style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", marginBottom: "8px", boxSizing: "border-box" }} />
                  {clientSearching && <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.4)", padding: "8px 0" }}>Searching...</div>}
                  {clientResults.map(c => (
                    <div key={c.id} onClick={() => { setBookClient({ id: c.id, name: `${c.givenName} ${c.familyName}`.trim() }); setBookStep(2) }} style={{ padding: "10px 12px", borderRadius: "8px", cursor: "pointer", marginBottom: "4px", backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(205,201,192,0.08)" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{c.givenName} {c.familyName}</div>
                      <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)" }}>{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
                    </div>
                  ))}
                  <button onClick={() => setNewClient(true)} style={{ marginTop: "8px", padding: "8px 14px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "6px", color: "rgba(205,201,192,0.6)", fontSize: "12px", cursor: "pointer", width: "100%" }}>New Client</button>
                </>) : (<>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input value={newClientForm.givenName} onChange={e => setNewClientForm(p => ({ ...p, givenName: e.target.value }))} placeholder="First name" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <input value={newClientForm.familyName} onChange={e => setNewClientForm(p => ({ ...p, familyName: e.target.value }))} placeholder="Last name" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <input value={newClientForm.phone} onChange={e => setNewClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <input value={newClientForm.email} onChange={e => setNewClientForm(p => ({ ...p, email: e.target.value }))} placeholder="Email (optional)" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setNewClient(false)} style={{ flex: 1, padding: "10px", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
                      <button onClick={createNewClient} disabled={bookSaving || !newClientForm.givenName} style={{ flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px", color: "#0f1d24", fontWeight: 700, cursor: "pointer", opacity: !newClientForm.givenName ? 0.5 : 1 }}>{bookSaving ? "Creating..." : "Create Client"}</button>
                    </div>
                  </div>
                </>)}
              </div>
            )}

            {/* Step 2 — Stylist + Date/Time */}
            {bookStep === 2 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "10px" }}>Step 2 — {bookClient?.name}</div>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Stylist</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {getLocationStylists(location).map(s => (
                      <button key={s.id} onClick={() => setBookStylist(s.id)} style={{ padding: "6px 12px", borderRadius: "6px", border: bookStylist === s.id ? "1px solid #CDC9C0" : "1px solid rgba(205,201,192,0.15)", backgroundColor: bookStylist === s.id ? "rgba(205,201,192,0.12)" : "transparent", color: bookStylist === s.id ? "#fff" : "rgba(205,201,192,0.6)", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: STYLIST_COLORS[s.id] || "#666" }} />{s.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Date</div>
                    <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", colorScheme: "dark", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Time</div>
                    <select value={bookTime} onChange={e => setBookTime(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                      {Array.from({ length: 52 }, (_, i) => { const h = Math.floor(i / 4) + 8; const m = (i % 4) * 15; if (h > 20) return null; const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; const label = new Date(`2026-01-01T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); const busy = bookStylist && appointments.some(a => a.teamMemberId === bookStylist && a.startTime && new Date(a.startTime).toISOString().includes(bookDate) && Math.abs(new Date(a.startTime).getHours() * 60 + new Date(a.startTime).getMinutes() - (h * 60 + m)) < (a.totalDurationMinutes || 60)); return <option key={t} value={t} style={{ color: busy ? "#666" : "#fff" }}>{label}{busy ? " (booked)" : ""}</option> }).filter(Boolean)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setBookStep(1)} style={{ flex: 1, padding: "10px", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
                  <button onClick={() => setBookStep(3)} disabled={!bookStylist} style={{ flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px", color: "#0f1d24", fontWeight: 700, cursor: "pointer", opacity: !bookStylist ? 0.5 : 1 }}>Next</button>
                </div>
              </div>
            )}

            {/* Step 3 — Services */}
            {bookStep === 3 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "10px" }}>Step 3 — Select Services</div>
                <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "12px" }}>
                  {bookServices.length === 0 ? <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "13px", padding: "20px 0", textAlign: "center" }}>Loading services...</div> : bookServices.map((s: { id: string; name: string; price: number; durationMinutes: number; version?: number }) => {
                    const sel = bookSelectedSvcs.some(x => x.id === s.id)
                    return (
                      <div key={s.id} onClick={() => sel ? setBookSelectedSvcs(p => p.filter(x => x.id !== s.id)) : setBookSelectedSvcs(p => [...p, s])} style={{ padding: "10px 12px", borderRadius: "8px", cursor: "pointer", marginBottom: "4px", backgroundColor: sel ? "rgba(205,201,192,0.08)" : "rgba(205,201,192,0.02)", border: sel ? "1px solid rgba(205,201,192,0.25)" : "1px solid rgba(205,201,192,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: sel ? 600 : 400, color: sel ? "#fff" : "rgba(205,201,192,0.7)" }}>{s.name}</div>
                          <div style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)" }}>{s.durationMinutes} min</div>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: sel ? "#CDC9C0" : "rgba(205,201,192,0.5)", fontFamily: "monospace" }}>${s.price.toFixed(2)}</div>
                      </div>
                    )
                  })}
                </div>
                {bookSelectedSvcs.length > 0 && <div style={{ fontSize: "13px", fontWeight: 700, color: "#CDC9C0", textAlign: "right", marginBottom: "12px", fontFamily: "monospace" }}>Total: ${bookSelectedSvcs.reduce((s, sv) => s + sv.price, 0).toFixed(2)}</div>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setBookStep(2)} style={{ flex: 1, padding: "10px", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
                  <button onClick={() => setBookStep(4)} disabled={bookSelectedSvcs.length === 0} style={{ flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px", color: "#0f1d24", fontWeight: 700, cursor: "pointer", opacity: bookSelectedSvcs.length === 0 ? 0.5 : 1 }}>Next</button>
                </div>
              </div>
            )}

            {/* Step 4 — Confirm */}
            {bookStep === 4 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "10px" }}>Step 4 — Confirm</div>
                <div style={{ backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>{bookClient?.name}</div>
                  <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", marginBottom: "4px" }}>{TEAM_NAMES[bookStylist] || "Stylist"} · {location === "Corpus Christi" ? "CC" : "SA"}</div>
                  <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.6)", marginBottom: "8px", fontFamily: "monospace" }}>{new Date(`${bookDate}T${bookTime}:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {new Date(`2026-01-01T${bookTime}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
                  {bookSelectedSvcs.map((s: { id: string; name: string; price: number }) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "12px" }}>
                      <span style={{ color: "rgba(205,201,192,0.7)" }}>{s.name}</span>
                      <span style={{ color: "#CDC9C0", fontFamily: "monospace" }}>${s.price.toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid rgba(205,201,192,0.1)", marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "13px" }}>
                    <span style={{ color: "#fff" }}>Total</span>
                    <span style={{ color: "#CDC9C0", fontFamily: "monospace" }}>${bookSelectedSvcs.reduce((s, sv) => s + sv.price, 0).toFixed(2)}</span>
                  </div>
                </div>
                {bookOverlap && (
                  <div style={{ backgroundColor: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "12px", fontSize: "12px", color: "#FBBF24" }}>
                    {TEAM_NAMES[bookStylist] || "Stylist"} already has an appointment at this time. Book anyway?
                  </div>
                )}
                <textarea value={bookNotes} onChange={e => setBookNotes(e.target.value)} placeholder="Notes (optional)" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", minHeight: "60px", resize: "vertical", marginBottom: "12px", boxSizing: "border-box" }} />
                {bookError && <div style={{ fontSize: "12px", color: "#EF4444", marginBottom: "10px" }}>{bookError}</div>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setBookStep(3); setBookOverlap(false) }} style={{ flex: 1, padding: "10px", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
                  <button onClick={submitBooking} disabled={bookSaving} style={{ flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px", color: "#0f1d24", fontWeight: 700, cursor: "pointer", opacity: bookSaving ? 0.5 : 1 }}>{bookSaving ? "Booking..." : bookOverlap ? "Book Anyway" : "Book Appointment"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div style={{ position: "fixed", bottom: "90px", right: "20px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 20px", color: "#fff", fontSize: "13px", zIndex: 999 }}>{toast}</div>}

      {/* Suppress unused vars */}
      {isManager ? null : null}
    </div>
  )
}
