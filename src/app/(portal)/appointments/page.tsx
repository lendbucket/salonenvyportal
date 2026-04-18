"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"
import Link from "next/link"
import { TEAM_NAMES, CC_STYLISTS, SA_STYLISTS } from "@/lib/staff"
function getLocationStylists(loc: string) {
  return loc === "San Antonio" ? SA_STYLISTS : CC_STYLISTS
}

const LOCATIONS = ["Corpus Christi", "San Antonio"]

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CHECKED_OUT: { bg: "rgba(34,197,94,0.1)", text: "#22c55e", border: "#22c55e", label: "Checked Out" },
  IN_PROGRESS: { bg: "rgba(201,168,76,0.1)", text: "#C9A84C", border: "#C9A84C", label: "In Progress" },
  UPCOMING: { bg: "rgba(122,143,150,0.1)", text: "#7a8f96", border: "#7a8f96", label: "Upcoming" },
  ACCEPTED: { bg: "rgba(96,165,250,0.1)", text: "#60a5fa", border: "#60a5fa", label: "Confirmed" },
  PENDING: { bg: "rgba(251,191,36,0.08)", text: "#FBBF24", border: "#FBBF24", label: "Pending" },
  CANCELLED: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444", label: "Cancelled" },
  CANCELLED_BY_SELLER: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444", label: "Cancelled" },
  CANCELLED_BY_CUSTOMER: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444", label: "Cancelled" },
  CANCELLED_BY_BUYER: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444", label: "Cancelled" },
  DECLINED: { bg: "rgba(239,68,68,0.08)", text: "#EF4444", border: "#EF4444", label: "Declined" },
  NO_SHOW: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", border: "#f59e0b", label: "No Show" },
}

const DEFAULT_STATUS = { bg: "rgba(205,201,192,0.06)", text: "rgba(205,201,192,0.5)", border: "rgba(205,201,192,0.3)", label: "Unknown" }

const PALETTE = ['#7a8f96', '#f59e0b', '#22c55e', '#3b82f6', '#e1306c', '#a78bfa', '#fb923c', '#34d399', '#60a5fa', '#f472b6', '#facc15', '#4ade80']

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
  resolvedStatus?: string
  services?: AppointmentService[]
  totalPrice?: number
  totalDurationMinutes?: number
  note?: string | null
  isCheckedOut?: boolean
  orderId?: string
  version?: number
  checkedOutAt?: string
  checkoutDetails?: { total: number; subtotal: number; tips: number; tax: number; paymentMethod: string; closedAt: string; services: { name: string; price: number }[] }
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// CST-explicit date string — always uses America/Chicago timezone
function getCSTDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) // "YYYY-MM-DD"
}

function clientShortName(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length <= 1) return name
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export default function AppointmentsPage() {
  const { isOwner, isManager, locationName } = useUserRole()

  const stylistColorMap = useMemo(() => {
    const allIds = Object.keys(TEAM_NAMES)
    const map: Record<string, string> = {}
    allIds.forEach((id, i) => { map[id] = PALETTE[i % PALETTE.length] })
    return map
  }, [])

  const [fetchError, setFetchError] = useState<string | null>(null)
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
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "day" | "week" | "month">("list")
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

  // ── Month view dedicated data ──
  const [monthAppointments, setMonthAppointments] = useState<Appointment[]>([])
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)

  // ── Cancel appointment ──
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<{ id: string; clientName: string; time: string } | null>(null)

  // ── Transactions tab ──
  const [activeTab, setActiveTab] = useState<"appointments" | "transactions" | "clients">("appointments")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientsList, setClientsList] = useState<any[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientsLoadingMore, setClientsLoadingMore] = useState(false)
  const [clientsSearch, setClientsSearch] = useState("")
  const [clientsTotal, setClientsTotal] = useState(0)
  const [clientsPage, setClientsPage] = useState(0)
  const [clientsHasMore, setClientsHasMore] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedClient, setSelectedClient] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientDetail, setClientDetail] = useState<any>(null)
  const [clientDetailLoading, setClientDetailLoading] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formulaList, setFormulaList] = useState<any[]>([])
  const [showFormulaForm, setShowFormulaForm] = useState(false)
  const [formulaForm, setFormulaForm] = useState({ baseColor: "", colorBrand: "", developer: "", developerVolume: "", toner: "", tonerBrand: "", processingTime: "", technique: "", notes: "" })
  const [formulaSaving, setFormulaSaving] = useState(false)
  const [txPeriod, setTxPeriod] = useState("today")
  const [txCustomStart, setTxCustomStart] = useState("")
  const [txCustomEnd, setTxCustomEnd] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [txData, setTxData] = useState<{ summary: any; transactions: any[] } | null>(null)
  const [txLoading, setTxLoading] = useState(false)
  const [txPage, setTxPage] = useState(0)
  const TX_PER_PAGE = 25

  // ── Client history panel ──
  const [historyClientId, setHistoryClientId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [historyData, setHistoryData] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(20)

  // ── Block time modal ──
  const [showBlock, setShowBlock] = useState(false)
  const [blockStylist, setBlockStylist] = useState("")
  const [blockDate, setBlockDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` })
  const [blockStart, setBlockStart] = useState("12:00")
  const [blockEnd, setBlockEnd] = useState("13:00")
  const [blockReason, setBlockReason] = useState("Lunch")
  const [blockNotes, setBlockNotes] = useState("")
  const [blockSaving, setBlockSaving] = useState(false)
  const [blockError, setBlockError] = useState("")

  // ── Send reminder ──
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set())
  const [reminderSending, setReminderSending] = useState<string | null>(null)

  // ── Day view drag/drop ──
  const [dragApptId, setDragApptId] = useState<string | null>(null)
  const [dragGhostTime, setDragGhostTime] = useState<number | null>(null)
  const dayViewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Auto-scroll day view to current time
  useEffect(() => {
    if (viewMode === "day" && !loading && dayViewRef.current) {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const offset = (nowMin - DAY_START_HOUR * 60) * (HOUR_PX / 60) - 100
      if (offset > 0) dayViewRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [viewMode, loading])

  const fetchAppointments = useCallback(async () => {
    // Month view has its own dedicated fetch — skip here to prevent double-fetch
    if (viewMode === "month") { setLoading(false); return }
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams()
      params.set("all", "true")
      if (isOwner && location) params.set("location", location)

      if (viewMode === "week") {
        const d = new Date(date + "T12:00:00")
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        params.set("startDate", formatDateStr(weekStart))
        params.set("endDate", formatDateStr(weekEnd))
      } else {
        params.set("date", date)
      }

      const res = await fetch(`/api/pos/appointments?${params}`)
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch {
      setAppointments([])
      setFetchError("Failed to load appointments")
    } finally {
      setLoading(false)
    }
  }, [date, isOwner, location, viewMode])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  // Dedicated month data fetch — triggers when in month view and month/location changes
  useEffect(() => {
    if (viewMode !== "month") return
    const d = new Date(date + "T12:00:00")
    const year = d.getFullYear()
    const mo = d.getMonth()

    // Full calendar grid range — first Sunday through last Saturday
    const firstOfMonth = new Date(year, mo, 1)
    const lastOfMonth = new Date(year, mo + 1, 0)
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(gridStart.getDate() - gridStart.getDay()) // first Sunday
    const gridEnd = new Date(lastOfMonth)
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())) // last Saturday

    // Use getCSTDateStr for consistency with cell date comparison
    const startDateStr = getCSTDateStr(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate(), 12))
    const endDateStr = getCSTDateStr(new Date(gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate(), 12))
    console.log("[Month range]", { startDateStr, endDateStr, year, mo })

    const fetchMonth = async () => {
      setLoadingMonth(true)
      try {
        const params = new URLSearchParams()
        params.set("all", "true")
        params.set("startDate", startDateStr)
        params.set("endDate", endDateStr)
        params.set("brief", "true")
        if (isOwner && location) {
          params.set("location", location)
        }
        const url = `/api/pos/appointments?${params}`
        console.log("[Month fetch]", url)
        const res = await fetch(url)
        const data = await res.json()
        const appts = Array.isArray(data) ? data : (data.appointments || data.bookings || [])
        console.log("[Month fetch] received:", appts.length, "appointments")
        if (appts.length > 0) console.log("[Month fetch] first apt:", { startTime: appts[0].startTime, customerName: appts[0].customerName, teamMemberId: appts[0].teamMemberId, status: appts[0].status })
        setMonthAppointments(appts)
      } catch (err) {
        console.error("[Month fetch] error:", err)
        setMonthAppointments([])
      } finally {
        setLoadingMonth(false)
      }
    }
    fetchMonth()
  }, [viewMode, date, location, isOwner])

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

  const [bookSuccess, setBookSuccess] = useState(false)
  const [sendCardSMS, setSendCardSMS] = useState(true)
  const [cardPhone, setCardPhone] = useState("")

  async function submitBooking() {
    if (!bookClient || !bookStylist || bookSelectedSvcs.length === 0) return
    if (!bookOverlap && checkOverlap()) { setBookOverlap(true); return }
    setBookSaving(true); setBookError("")
    const localDate = new Date(`${bookDate}T${bookTime}:00`)
    const utcISO = localDate.toISOString()
    try {
      const payload = { locationId: location === "San Antonio" ? "SA" : "CC", customerId: bookClient.id, stylistId: bookStylist, startAt: utcISO, services: bookSelectedSvcs, notes: bookNotes }
      console.log("[booking] Submitting:", JSON.stringify(payload))
      const r = await fetch("/api/bookings/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const d = await r.json()
      console.log("[booking] Response:", r.status, JSON.stringify(d).substring(0, 500))

      const isSuccess = r.ok || d.booking || d.success || d.id
      if (!isSuccess) {
        setBookError(d.error || d.message || JSON.stringify(d.errors || d) || `Booking failed (status ${r.status})`)
        setBookSaving(false)
        return
      }

      // Success — send card request if enabled
      if (sendCardSMS && cardPhone) {
        try {
          const locId = location === "San Antonio" ? "LXJYXDXWR0XZF" : "LTJSA6QR1HGW6"
          await fetch("/api/card-on-file/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName: bookClient.name, clientPhone: cardPhone, squareBookingId: d.booking?.id || "", locationId: locId }) })
          console.log("[booking] Card request sent to:", cardPhone)
        } catch (cardErr) { console.log("[booking] Card request failed (non-fatal):", cardErr) }
      }
      setBookSuccess(true)
      setBookStep(5)
      fetchAppointments()
    } catch (e: unknown) {
      console.error("[booking] Catch error:", e)
      setBookError(e instanceof Error ? e.message : "Network error — please try again")
    }
    setBookSaving(false)
  }

  function resetBooking() { setBookStep(1); setBookClient(null); setBookStylist(""); setBookDate(date); setBookTime("10:00"); setBookSelectedSvcs([]); setBookNotes(""); setBookError(""); setBookOverlap(false); setBookSuccess(false); setClientSearch(""); setClientResults([]); setNewClient(false); setNewClientForm({ givenName: "", familyName: "", phone: "", email: "" }) }

  async function handleCancelAppointment(bookingId: string) {
    setCancellingId(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Cancelled by salon" }) })
      const data = await res.json()
      if (!res.ok) { setToast(data.error || "Failed to cancel"); setTimeout(() => setToast(null), 4000); return }
      fetchAppointments()
      setCancelConfirm(null)
      setToast("Appointment cancelled"); setTimeout(() => setToast(null), 3000)
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to cancel"); setTimeout(() => setToast(null), 4000)
    } finally { setCancellingId(null) }
  }

  function openBookingModal() { resetBooking(); setShowBooking(true) }

  // ── Block time ──
  function openBlockModal() {
    setBlockStylist("")
    setBlockDate(date)
    setBlockStart("12:00")
    setBlockEnd("13:00")
    setBlockReason("Lunch")
    setBlockNotes("")
    setBlockError("")
    setShowBlock(true)
  }

  async function submitBlock() {
    if (!blockStylist) return
    const startParts = blockStart.split(":").map(Number)
    const endParts = blockEnd.split(":").map(Number)
    const durationMinutes = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1])
    if (durationMinutes <= 0) { setBlockError("End time must be after start time"); return }
    setBlockSaving(true); setBlockError("")
    const startAt = new Date(`${blockDate}T${blockStart}:00`).toISOString()
    try {
      const r = await fetch("/api/bookings/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location === "San Antonio" ? "SA" : "CC", stylistId: blockStylist, startAt, durationMinutes, reason: blockReason, notes: blockNotes }),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || "Block failed")
      setShowBlock(false); fetchAppointments()
      setToast("Time blocked successfully"); setTimeout(() => setToast(null), 3000)
    } catch (e: unknown) { setBlockError(e instanceof Error ? e.message : "Failed") }
    setBlockSaving(false)
  }

  // ── Send reminder ──
  async function sendReminder(apptId: string) {
    setReminderSending(apptId)
    try {
      const r = await fetch(`/api/appointments/${apptId}/reminder`, { method: "POST" })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || "Send failed")
      setReminderSent(prev => new Set(prev).add(apptId))
      setToast("Reminder sent"); setTimeout(() => setToast(null), 3000)
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to send reminder"); setTimeout(() => setToast(null), 3000)
    }
    setReminderSending(null)
  }

  // ── Client history ──
  async function openClientHistory(customerId: string) {
    if (!customerId) return
    setHistoryClientId(customerId)
    setHistoryLoading(true)
    setHistoryData(null)
    setHistoryLimit(20)
    try {
      const r = await fetch(`/api/customers/${customerId}/history`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setHistoryData(d)
    } catch { setHistoryData(null) }
    setHistoryLoading(false)
  }

  // ── Day view drag/drop reschedule ──
  const HOUR_PX = 80
  const DAY_START_HOUR = 8
  const DAY_END_HOUR = 22

  async function handleDrop(apptId: string, newMinuteOffset: number) {
    const totalMinutes = DAY_START_HOUR * 60 + newMinuteOffset
    const newHour = Math.floor(totalMinutes / 60)
    const newMin = Math.round((totalMinutes % 60) / 15) * 15
    const appt = appointments.find(a => a.id === apptId)
    if (!appt) return

    // Optimistic update
    const newStartLocal = new Date(`${date}T${String(newHour).padStart(2, "0")}:${String(newMin).padStart(2, "0")}:00`)
    const oldStart = appt.startTime
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, startTime: newStartLocal.toISOString() } : a))

    try {
      const r = await fetch(`/api/bookings/${apptId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: newStartLocal.toISOString(), version: appt.version }),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || "Reschedule failed")
      setToast("Appointment rescheduled"); setTimeout(() => setToast(null), 3000)
      fetchAppointments()
    } catch (e: unknown) {
      // Revert
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, startTime: oldStart } : a))
      setToast(e instanceof Error ? e.message : "Reschedule failed"); setTimeout(() => setToast(null), 3000)
    }
    setDragApptId(null)
    setDragGhostTime(null)
  }

  // ── Transactions helpers ──
  const getTxDateRange = useCallback((): { start: string; end: string } => {
    const now = new Date()
    const cst = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "America/Chicago" }))
    const today = cst(now)
    const y = today.getFullYear(), m = today.getMonth(), day = today.getDate()
    const dayOfWeek = today.getDay()

    const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r }
    const endOfDay = (d: Date) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r }
    const toISO = (d: Date) => d.toISOString()

    switch (txPeriod) {
      case "today": return { start: toISO(startOfDay(today)), end: toISO(endOfDay(today)) }
      case "yesterday": { const yd = new Date(y, m, day - 1); return { start: toISO(startOfDay(yd)), end: toISO(endOfDay(yd)) } }
      case "last7": { const d7 = new Date(y, m, day - 6); return { start: toISO(startOfDay(d7)), end: toISO(endOfDay(today)) } }
      case "thisWeek": { const ws = new Date(y, m, day - dayOfWeek); return { start: toISO(startOfDay(ws)), end: toISO(endOfDay(today)) } }
      case "lastWeek": { const lws = new Date(y, m, day - dayOfWeek - 7); const lwe = new Date(y, m, day - dayOfWeek - 1); return { start: toISO(startOfDay(lws)), end: toISO(endOfDay(lwe)) } }
      case "thisMonth": return { start: toISO(new Date(y, m, 1)), end: toISO(endOfDay(today)) }
      case "last30": { const d30 = new Date(y, m, day - 29); return { start: toISO(startOfDay(d30)), end: toISO(endOfDay(today)) } }
      case "last90": { const d90 = new Date(y, m, day - 89); return { start: toISO(startOfDay(d90)), end: toISO(endOfDay(today)) } }
      case "lastMonth": return { start: toISO(new Date(y, m - 1, 1)), end: toISO(new Date(y, m, 0, 23, 59, 59, 999)) }
      case "ytd": return { start: toISO(new Date(y, 0, 1)), end: toISO(endOfDay(today)) }
      case "custom": {
        if (txCustomStart && txCustomEnd) return { start: new Date(txCustomStart + "T00:00:00").toISOString(), end: new Date(txCustomEnd + "T23:59:59").toISOString() }
        return { start: toISO(startOfDay(today)), end: toISO(endOfDay(today)) }
      }
      default: return { start: toISO(startOfDay(today)), end: toISO(endOfDay(today)) }
    }
  }, [txPeriod, txCustomStart, txCustomEnd])

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const { start, end } = getTxDateRange()
      const locId = location === "San Antonio" ? "SA" : "CC"
      const res = await fetch(`/api/transactions?locationId=${locId}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`)
      const data = await res.json()
      setTxData(data.error ? null : data)
      setTxPage(0)
    } catch { setTxData(null) }
    setTxLoading(false)
  }, [getTxDateRange, location])

  useEffect(() => { if (activeTab === "transactions") fetchTransactions() }, [activeTab, fetchTransactions])

  // Clients tab fetch with pagination
  const fetchClientsPage = useCallback(async (page: number, append = false) => {
    if (page === 0 && !append) setClientsLoading(true)
    else setClientsLoadingMore(true)
    try {
      const q = clientsSearch ? `&q=${encodeURIComponent(clientsSearch)}` : ""
      const res = await fetch(`/api/clients?page=${page}${q}`)
      const data = await res.json()
      if (append) {
        setClientsList(prev => [...prev, ...(data.clients || [])])
      } else {
        setClientsList(data.clients || [])
      }
      setClientsTotal(data.total || 0)
      setClientsPage(page)
      setClientsHasMore(data.hasMore || false)
    } catch { if (!append) setClientsList([]) }
    setClientsLoading(false)
    setClientsLoadingMore(false)
  }, [clientsSearch])

  // Debounced search
  useEffect(() => {
    if (activeTab !== "clients") return
    const timer = setTimeout(() => { fetchClientsPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [activeTab, clientsSearch, fetchClientsPage])

  const openClientDetail = async (client: typeof clientsList[0]) => {
    setSelectedClient(client)
    setClientDetail(null)
    setClientDetailLoading(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`)
      const data = await res.json()
      setClientDetail(data)
      setFormulaList(data.formulas || [])
    } catch {
      setClientDetail(null)
      setFormulaList([])
    }
    setClientDetailLoading(false)
  }

  const saveFormula = async () => {
    if (!selectedClient) return
    setFormulaSaving(true)
    try {
      await fetch(`/api/clients/${selectedClient.id}/formula`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulaForm),
      })
      // Refresh detail data which includes formulas
      const res = await fetch(`/api/clients/${selectedClient.id}`)
      const data = await res.json()
      if (data.formulas) setFormulaList(data.formulas)
      if (data.client) setClientDetail(data)
      setShowFormulaForm(false)
      setFormulaForm({ baseColor: "", colorBrand: "", developer: "", developerVolume: "", toner: "", tonerBrand: "", processingTime: "", technique: "", notes: "" })
    } catch { /* skip */ }
    setFormulaSaving(false)
  }

  const txPageData = useMemo(() => {
    if (!txData?.transactions) return []
    return txData.transactions.slice(txPage * TX_PER_PAGE, (txPage + 1) * TX_PER_PAGE)
  }, [txData, txPage, TX_PER_PAGE])

  const txTotalPages = txData?.transactions ? Math.ceil(txData.transactions.length / TX_PER_PAGE) : 0

  function getTxFileDates(): string {
    const { start, end } = getTxDateRange()
    const s = new Date(start).toISOString().slice(0, 10)
    const e = new Date(end).toISOString().slice(0, 10)
    return `${s}_to_${e}`
  }

  function exportTxCsv() {
    if (!txData?.transactions?.length) return
    const rows = [["Date", "Time", "Client", "Stylist", "Services", "Payment Method", "Subtotal", "Tips", "Tax", "Total"]]
    for (const tx of txData.transactions) {
      const d = new Date(tx.closedAt)
      rows.push([
        d.toLocaleDateString("en-US", { timeZone: "America/Chicago" }),
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }),
        tx.customerName,
        tx.stylistName,
        tx.services.join("; "),
        tx.paymentMethod,
        tx.subtotal.toFixed(2),
        tx.tips.toFixed(2),
        tx.tax.toFixed(2),
        tx.total.toFixed(2),
      ])
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const locLabel = location === "San Antonio" ? "SA" : "CC"
    const a = document.createElement("a"); a.href = url; a.download = `transactions_${locLabel}_${getTxFileDates()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function downloadTxReport() {
    if (!txData?.transactions?.length || !txData.summary) return
    const locLabel = location === "Corpus Christi" ? "Salon Envy Corpus Christi" : "Salon Envy San Antonio"
    const dateRange = getTxFileDates().replace(/_to_/, " to ")
    const s = txData.summary
    const rows = txData.transactions.map((tx: { closedAt: string; customerName: string; stylistName: string; services: string[]; paymentMethod: string; subtotal: number; tips: number; tax: number; total: number }) => {
      const d = new Date(tx.closedAt)
      return [
        d.toLocaleDateString("en-US", { timeZone: "America/Chicago" }),
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }),
        tx.customerName, tx.stylistName, tx.services.join("; "), tx.paymentMethod,
        tx.subtotal.toFixed(2), tx.tips.toFixed(2), tx.tax.toFixed(2), tx.total.toFixed(2),
      ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")
    })
    const csv = [
      `"${locLabel} — Transaction Report — ${dateRange}"`,
      "",
      `"Total Revenue","Total Tips","Total Tax","Total Collected","# Transactions","Avg Ticket"`,
      `"$${s.revenue.toFixed(2)}","$${s.tips.toFixed(2)}","$${s.tax.toFixed(2)}","$${s.total.toFixed(2)}","${s.count}","$${s.avgTicket.toFixed(2)}"`,
      "",
      `"Date","Time","Client","Stylist","Services","Payment","Subtotal","Tips","Tax","Total"`,
      ...rows,
      "",
      `"Generated ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CST"`,
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `report_${location === "San Antonio" ? "SA" : "CC"}_${getTxFileDates()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const TX_PERIODS = [
    { key: "today", label: "Today" }, { key: "yesterday", label: "Yesterday" },
    { key: "last7", label: "Last 7 Days" }, { key: "thisWeek", label: "This Week" },
    { key: "lastWeek", label: "Last Week" }, { key: "thisMonth", label: "This Month" },
    { key: "last30", label: "Last 30 Days" }, { key: "last90", label: "Last 90 Days" },
    { key: "lastMonth", label: "Last Month" }, { key: "ytd", label: "Year to Date" },
    { key: "custom", label: "Custom Range" },
  ]

  const CARD_BRANDS: Record<string, { color: string; abbr: string }> = {
    VISA: { color: "#1A1F71", abbr: "V" }, MASTERCARD: { color: "#EB001B", abbr: "MC" },
    AMEX: { color: "#006FCF", abbr: "AX" }, DISCOVER: { color: "#FF6600", abbr: "D" },
    AMERICAN_EXPRESS: { color: "#006FCF", abbr: "AX" },
  }

  function paymentBadge(method: string) {
    const badgeBase = { fontFamily: "'Fira Code', monospace", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", whiteSpace: "nowrap" as const }
    if (method === "Cash") return <span style={{ ...badgeBase, backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e" }}>CASH</span>
    if (method === "Apple Pay") return <span style={{ ...badgeBase, backgroundColor: "rgba(255,255,255,0.08)", color: "#fff" }}>Apple Pay</span>
    const parts = method.split(" ")
    const brand = parts[0]?.toUpperCase().replace(/ /g, "_") || ""
    const last4 = parts.slice(1).join(" ")
    if (brand.includes("VISA")) return <span style={{ ...badgeBase, backgroundColor: "rgba(26,115,232,0.1)", color: "#60a5fa" }}>VISA {last4}</span>
    if (brand.includes("MASTER")) return <span style={{ ...badgeBase, backgroundColor: "rgba(235,95,52,0.1)", color: "#fb923c" }}>MC {last4}</span>
    if (brand.includes("AMEX") || brand.includes("AMERICAN")) return <span style={{ ...badgeBase, backgroundColor: "rgba(0,114,206,0.1)", color: "#60a5fa" }}>AMEX {last4}</span>
    if (brand.includes("DISCOVER")) return <span style={{ ...badgeBase, backgroundColor: "rgba(255,102,0,0.1)", color: "#fb923c" }}>DISC {last4}</span>
    return <span style={{ ...badgeBase, backgroundColor: "rgba(96,110,116,0.1)", color: "#7a8f96" }}>{method}</span>
  }

  // Filter by stylist + status and sort by startTime
  const sorted = useMemo(() => {
    let filtered = stylistFilter === "all"
      ? appointments
      : appointments.filter(a => a.teamMemberId === stylistFilter)
    if (statusFilter !== "all") {
      filtered = filtered.filter(a => (a.resolvedStatus || a.status) === statusFilter)
    }
    return [...filtered].sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })
  }, [appointments, stylistFilter, statusFilter])

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of appointments) {
      const s = a.resolvedStatus || a.status
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [appointments])

  const STATUS_LABELS: Record<string, string> = {
    CHECKED_OUT: "Checked Out", IN_PROGRESS: "In Progress", UPCOMING: "Upcoming",
    ACCEPTED: "Confirmed", PENDING: "Pending", CANCELLED: "Cancelled",
    CANCELLED_BY_CUSTOMER: "Client Cancelled", CANCELLED_BY_SELLER: "Salon Cancelled",
    NO_SHOW: "No Show",
  }

  const navigateDate = (delta: number) => {
    const d = new Date(date + "T12:00:00")
    if (viewMode === "week") {
      d.setDate(d.getDate() + delta * 7)
    } else if (viewMode === "month") {
      d.setMonth(d.getMonth() + delta)
    } else {
      d.setDate(d.getDate() + delta)
    }
    setDate(formatDateStr(d))
  }

  const goToday = () => {
    const d = new Date()
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
  }

  const displayDate = useMemo(() => {
    const d = new Date(date + "T12:00:00")
    if (viewMode === "week") {
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}`
    }
    if (viewMode === "month") {
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
    }
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  }, [date, viewMode])

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

  const getStatusStyle = (appt: Appointment) => {
    const key = appt.resolvedStatus || appt.status
    return STATUS_COLORS[key] || DEFAULT_STATUS
  }

  const BLOCK_REASONS = ["Lunch", "Break", "Personal", "Training", "Other"]
  const isBlockedTime = (appt: Appointment) => {
    if (!appt.customerId && appt.note) {
      return BLOCK_REASONS.some(r => appt.note?.startsWith(r + ":") || appt.note === r)
    }
    if (!appt.customerId && (!appt.customerName || appt.customerName === "Walk-in" || appt.customerName === "Client")) {
      return !appt.services?.length || appt.services.every(s => !s.serviceVariationId)
    }
    return false
  }
  const getBlockReason = (appt: Appointment) => appt.note || "Blocked"

  return (
    <div style={{ padding: isMobile ? "16px" : "24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: isMobile ? "22px" : "24px", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
              {activeTab === "appointments" ? "Appointments" : activeTab === "transactions" ? "Transactions" : "Clients"}
            </h1>
            <div style={{ display: "flex", gap: "2px", backgroundColor: "rgba(205,201,192,0.06)", borderRadius: "8px", padding: "3px" }}>
              {(["appointments", "transactions", "clients"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "6px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  borderRadius: "6px", border: "none", cursor: "pointer",
                  backgroundColor: activeTab === tab ? "#CDC9C0" : "transparent",
                  color: activeTab === tab ? "#0f1d24" : "rgba(205,201,192,0.45)",
                  transition: "all 0.15s",
                }}>{tab === "appointments" ? "Appts" : tab === "transactions" ? "Transactions" : "Clients"}</button>
              ))}
            </div>
          </div>
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
          {activeTab === "appointments" && <>
            <button onClick={openBookingModal} style={{
              padding: isMobile ? "7px 10px" : "7px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              borderRadius: "6px", border: "none", cursor: "pointer", backgroundColor: "#CDC9C0", color: "#0f1d24",
              display: "flex", alignItems: "center", gap: "4px",
            }}><span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>{!isMobile && "New Appointment"}</button>
            {!isMobile && <button onClick={openBlockModal} style={{
              padding: "7px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
              backgroundColor: "transparent", color: "rgba(205,201,192,0.6)",
            }}>Block Time</button>}
            <button onClick={() => setShowWaitlist(!showWaitlist)} style={{
              padding: "7px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              borderRadius: "6px", border: showWaitlist ? "1px solid #CDC9C0" : "1px solid rgba(255,255,255,0.08)",
              backgroundColor: showWaitlist ? "rgba(255,255,255,0.06)" : "transparent",
              color: showWaitlist ? "#CDC9C0" : "rgba(205,201,192,0.45)", cursor: "pointer",
            }}>{isMobile ? `WL${waitlist.length > 0 ? ` (${waitlist.length})` : ""}` : `Waitlist${waitlist.length > 0 ? ` (${waitlist.length})` : ""}`}</button>
          </>}
        </div>

        {activeTab === "appointments" && <>
        {/* Date navigator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}>
          <button onClick={() => navigateDate(-1)} style={{
            width: "36px", height: "36px", borderRadius: "8px",
            backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.06)",
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
                backgroundColor: "#0d1117",
                border: "1px solid rgba(255,255,255,0.08)",
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
                border: "1px solid rgba(255,255,255,0.08)",
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
            backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(205,201,192,0.6)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
          </button>

          <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(205,201,192,0.55)", marginLeft: "4px" }}>
            {isMobile && (viewMode === "list" || viewMode === "day") ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : displayDate}
          </span>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: "4px", marginTop: "12px" }}>
          {(["list", "day", "week", "month"] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                borderRadius: "8px",
                border: viewMode === v ? "1px solid #7a8f96" : "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
                backgroundColor: viewMode === v ? "rgba(122,143,150,0.15)" : "transparent",
                color: viewMode === v ? "#ffffff" : "#606E74",
                transition: "all 0.15s",
              }}
            >
              {v === "list" ? "List" : v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
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
          alignItems: "center",
        }}>
          {(() => {
            const allCount = appointments.filter(a => !isBlockedTime(a)).length
            const stylistCounts: Record<string, number> = {}
            for (const a of appointments) {
              if (a.teamMemberId && !isBlockedTime(a)) {
                stylistCounts[a.teamMemberId] = (stylistCounts[a.teamMemberId] || 0) + 1
              }
            }
            return (
              <>
                <button
                  onClick={() => setStylistFilter("all")}
                  style={{
                    padding: "6px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
                    borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    border: stylistFilter === "all" ? "1px solid rgba(122,143,150,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    backgroundColor: stylistFilter === "all" ? "rgba(122,143,150,0.1)" : "transparent",
                    color: stylistFilter === "all" ? "#ffffff" : "rgba(205,201,192,0.45)",
                  }}
                >
                  All ({allCount})
                </button>
                {getLocationStylists(location).map(s => {
                  const cnt = stylistCounts[s.id] || 0
                  const clr = stylistColorMap[s.id] || "#607D8B"
                  return (
                    <button
                      key={s.id}
                      onClick={() => setStylistFilter(s.id)}
                      style={{
                        padding: "6px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
                        borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                        display: "flex", alignItems: "center", gap: "5px",
                        border: stylistFilter === s.id ? `1px solid ${clr}50` : "1px solid rgba(255,255,255,0.06)",
                        backgroundColor: stylistFilter === s.id ? `${clr}1A` : "transparent",
                        color: stylistFilter === s.id ? "#ffffff" : "rgba(205,201,192,0.45)",
                      }}
                    >
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: clr, flexShrink: 0 }} />
                      {s.name.split(" ")[0]} ({cnt})
                    </button>
                  )
                })}
              </>
            )
          })()}
        </div>

        {/* Analytics strip */}
        {!loading && appointments.length > 0 && (
          <div style={{
            display: isMobile ? "grid" : "flex",
            gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : undefined,
            gap: isMobile ? "1px" : "32px",
            padding: isMobile ? "0" : "10px 0",
            marginTop: "12px",
            borderTop: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
            borderBottom: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
            backgroundColor: isMobile ? "rgba(255,255,255,0.04)" : "transparent",
            borderRadius: isMobile ? "8px" : "0",
            overflow: "hidden",
          }}>
            {[
              { label: "Total", value: String(appointments.filter(a => !isBlockedTime(a)).length), color: "#ffffff" },
              { label: "Checked", value: String(appointments.filter(a => a.resolvedStatus === "CHECKED_OUT" || a.isCheckedOut).length), color: "#22c55e" },
              { label: "Confirmed", value: String(appointments.filter(a => (a.resolvedStatus === "ACCEPTED" || a.resolvedStatus === "UPCOMING" || a.resolvedStatus === "IN_PROGRESS") && !a.isCheckedOut).length), color: "#60a5fa" },
              { label: "Pending", value: String(appointments.filter(a => a.status === "PENDING").length), color: "#FBBF24" },
              { label: "Cancel", value: String(appointments.filter(a => a.resolvedStatus === "CANCELLED" || a.status?.startsWith("CANCELLED")).length), color: "#EF4444" },
              { label: "Revenue", value: fmtCurrency(appointments.filter(a => a.isCheckedOut && a.checkoutDetails?.total).reduce((s, a) => s + (a.checkoutDetails?.total || 0), 0)), color: "#ffffff" },
            ].map(stat => (
              <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "center" : "flex-start", padding: isMobile ? "10px 8px" : "0", backgroundColor: isMobile ? "#0d1117" : "transparent" }}>
                <div style={{ fontSize: isMobile ? "20px" : "16px", fontWeight: isMobile ? 700 : 800, color: stat.color, fontFamily: "'Fira Code', monospace" }}>{stat.value}</div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "#606E74", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Status filter pills */}
        {!loading && appointments.length > 0 && Object.keys(statusCounts).length > 0 && (
          <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
            <button onClick={() => setStatusFilter("all")} style={{
              padding: "4px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
              background: statusFilter === "all" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
              borderWidth: "1px", borderStyle: "solid",
              borderColor: statusFilter === "all" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
            }}>
              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "11px", color: statusFilter === "all" ? "#fff" : "#7a8f96" }}>
                {appointments.filter(a => !isBlockedTime(a)).length}
              </span>
              <span style={{ fontSize: "11px", color: "#606E74", marginLeft: "4px" }}>all</span>
            </button>
            {Object.entries(statusCounts).map(([status, count]) => {
              const sc = STATUS_COLORS[status] || DEFAULT_STATUS
              return (
                <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "all" : status)} style={{
                  padding: "4px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
                  background: statusFilter === status ? sc.bg : "rgba(255,255,255,0.02)",
                  borderWidth: "1px", borderStyle: "solid",
                  borderColor: statusFilter === status ? sc.border : "rgba(255,255,255,0.06)",
                }}>
                  <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "11px", color: statusFilter === status ? sc.text : "#fff" }}>
                    {count}
                  </span>
                  <span style={{ fontSize: "11px", color: statusFilter === status ? sc.text : "#7a8f96", marginLeft: "4px" }}>
                    {STATUS_LABELS[status] || status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        </>}
      </div>

      {activeTab === "appointments" && <>
      {/* Error state */}
      {fetchError && !loading && (
        <div style={{ background: '#0d1117', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 20, textAlign: 'center', margin: '20px 0' }}>
          <div style={{ color: '#ef4444', fontSize: 14, fontFamily: 'Plus Jakarta Sans, sans-serif', marginBottom: 8 }}>{fetchError}</div>
          <button onClick={() => { setFetchError(null); fetchAppointments() }} style={{ background: 'transparent', border: '1px solid #606E74', color: '#7a8f96', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Retry</button>
        </div>
      )}
      {/* Appointment list / day view */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 80, background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      ) : viewMode === "week" ? (
        /* ── Week View Calendar ── */
        (() => {
          const WEEK_HOUR_PX = 64
          const WEEK_START = 8
          const WEEK_END = 21
          const totalHours = WEEK_END - WEEK_START
          const d = new Date(date + "T12:00:00")
          const weekStart = new Date(d)
          weekStart.setDate(d.getDate() - d.getDay())
          const days = Array.from({ length: 7 }, (_, i) => {
            const day = new Date(weekStart)
            day.setDate(weekStart.getDate() + i)
            return day
          })
          const todayStr = (() => { const n = new Date(); return formatDateStr(n) })()
          const now = new Date()
          const nowMin = now.getHours() * 60 + now.getMinutes()
          const nowOffset = (nowMin - WEEK_START * 60) * (WEEK_HOUR_PX / 60)
          const showNowLine = nowMin >= WEEK_START * 60 && nowMin <= WEEK_END * 60
          const todayDayStr = formatDateStr(now)

          return (
            <div style={{ marginTop: "8px", overflowX: "auto" }}>
              <div style={{ display: "flex", minWidth: "800px" }}>
                {/* Time column */}
                <div style={{ width: "56px", flexShrink: 0, paddingTop: "52px", position: "relative" }}>
                  {Array.from({ length: totalHours + 1 }, (_, i) => {
                    const hour = WEEK_START + i
                    return (
                      <div key={hour} style={{ height: i < totalHours ? `${WEEK_HOUR_PX}px` : "0", position: "relative" }}>
                        <span style={{ position: "absolute", top: "-7px", right: "8px", fontSize: "11px", fontWeight: 600, color: "#606E74", fontFamily: "'Fira Code', monospace" }}>
                          {hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Day columns */}
                {days.map((day, di) => {
                  const dayStr = formatDateStr(day)
                  const isCurrentDay = dayStr === todayStr
                  const dayAppts = sorted.filter(a => {
                    if (!a.startTime) return false
                    return formatDateStr(new Date(a.startTime)) === dayStr
                  })
                  return (
                    <div key={di} style={{ flex: 1, minWidth: "100px", borderLeft: "1px solid rgba(255,255,255,0.06)", position: "relative", backgroundColor: isCurrentDay ? "rgba(122,143,150,0.04)" : "transparent" }}>
                      {/* Day header — name + number */}
                      <div style={{ padding: "6px 4px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", height: "52px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: isCurrentDay ? "#7a8f96" : "#606E74", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          {day.toLocaleDateString("en-US", { weekday: "short" })}
                        </span>
                        <span style={{
                          fontSize: "18px", fontWeight: 700, fontFamily: "'Fira Code', monospace",
                          color: isCurrentDay ? "#0d1117" : "#7a8f96",
                          ...(isCurrentDay ? { backgroundColor: "#7a8f96", width: "28px", height: "28px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" } : {}),
                        }}>
                          {day.getDate()}
                        </span>
                      </div>
                      {/* Hour grid */}
                      <div style={{ position: "relative", height: `${totalHours * WEEK_HOUR_PX}px` }}>
                        {Array.from({ length: totalHours + 1 }, (_, i) => (
                          <div key={i} style={{ position: "absolute", top: `${i * WEEK_HOUR_PX}px`, left: 0, right: 0, height: "1px", backgroundColor: "rgba(255,255,255,0.05)" }} />
                        ))}
                        {/* Half-hour lines */}
                        {Array.from({ length: totalHours }, (_, i) => (
                          <div key={`hh${i}`} style={{ position: "absolute", top: `${i * WEEK_HOUR_PX + WEEK_HOUR_PX / 2}px`, left: 0, right: 0, height: "1px", backgroundColor: "rgba(255,255,255,0.02)" }} />
                        ))}
                        {/* Current time line */}
                        {isCurrentDay && showNowLine && (
                          <div style={{ position: "absolute", top: `${nowOffset}px`, left: "-4px", right: 0, zIndex: 10, display: "flex", alignItems: "center" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444", flexShrink: 0, boxShadow: "0 0 6px rgba(239,68,68,0.5)" }} />
                            <div style={{ flex: 1, height: "2px", backgroundColor: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.5)" }} />
                          </div>
                        )}
                        {/* Appointment blocks */}
                        {dayAppts.filter(a => !isBlockedTime(a)).map(appt => {
                          const s = new Date(appt.startTime)
                          const startMin = s.getHours() * 60 + s.getMinutes()
                          const dur = appt.totalDurationMinutes || 60
                          const top = (startMin - WEEK_START * 60) * (WEEK_HOUR_PX / 60)
                          const height = Math.max(dur * (WEEK_HOUR_PX / 60), 40)
                          const color = (appt.teamMemberId && stylistColorMap[appt.teamMemberId]) || "#607D8B"
                          const isCancelled = appt.resolvedStatus === "CANCELLED" || appt.status?.startsWith("CANCELLED")
                          return (
                            <div
                              key={appt.id}
                              onClick={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                              style={{
                                position: "absolute", top: `${top}px`, left: "4px", right: "4px", height: `${height}px`,
                                backgroundColor: `${color}33`, borderLeft: `3px solid ${appt.isCheckedOut ? "#22c55e" : color}`,
                                borderRadius: "6px", padding: "6px 8px", cursor: "pointer", overflow: "hidden",
                                opacity: isCancelled ? 0.4 : 1, zIndex: 2,
                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                              }}
                            >
                              <div style={{ fontSize: "12px", fontWeight: 600, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: isCancelled ? "line-through" : "none" }}>
                                {appt.customerName}
                              </div>
                              {height >= 60 && appt.services?.[0] && (
                                <div style={{ fontSize: "11px", color: "#7a8f96", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "1px" }}>
                                  {appt.services.map(sv => sv.serviceName).join(", ")}
                                </div>
                              )}
                              {height >= 60 && (
                                <div style={{ fontSize: "10px", color: "#606E74", fontFamily: "'Fira Code', monospace", marginTop: "1px" }}>
                                  {fmtTime(appt.startTime)}{appt.endTime ? ` – ${fmtTime(appt.endTime)}` : ""}
                                </div>
                              )}
                              {appt.isCheckedOut && height >= 60 && (
                                <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
                                  <span style={{ fontSize: "10px", color: "#22c55e" }}>Checked out</span>
                                </div>
                              )}
                              {appt.isCheckedOut && height < 60 && (
                                <div style={{ position: "absolute", top: "4px", right: "4px", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()
      ) : viewMode === "month" ? (
        /* ── Month View Calendar ── */
        (() => {
          const d = new Date(date + "T12:00:00")
          const year = d.getFullYear()
          const month = d.getMonth()
          const firstOfMonth = new Date(year, month, 1)
          const lastOfMonth = new Date(year, month + 1, 0)
          const calStart = new Date(firstOfMonth)
          calStart.setDate(1 - firstOfMonth.getDay())
          const totalDays = Math.ceil((lastOfMonth.getTime() - calStart.getTime()) / (86400000)) + (7 - lastOfMonth.getDay())
          const weeks = Math.ceil(totalDays / 7)
          const cells: Date[] = []
          for (let i = 0; i < weeks * 7; i++) {
            // Use noon to avoid midnight timezone boundary issues
            const day = new Date(calStart.getFullYear(), calStart.getMonth(), calStart.getDate() + i, 12)
            cells.push(day)
          }
          const todayStr = getCSTDateStr(new Date())
          // Use dedicated monthAppointments data (not single-day appointments)
          const monthData = monthAppointments.length > 0 ? monthAppointments : appointments
          console.log("[Month render] monthAppointments:", monthAppointments.length, "monthData:", monthData.length)
          const monthFirstStr = getCSTDateStr(new Date(year, month, 1, 12))
          const monthLastStr = getCSTDateStr(new Date(year, month + 1, 0, 12))
          const totalMonthAppts = monthData.filter(a => {
            if (!a.startTime || isBlockedTime(a)) return false
            const ad = getCSTDateStr(new Date(a.startTime))
            return ad >= monthFirstStr && ad <= monthLastStr
          }).length

          return (
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", color: "#7a8f96", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
                  {totalMonthAppts} appointment{totalMonthAppts !== 1 ? "s" : ""} this month
                  {loadingMonth && <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#7a8f96", animation: "spin 1s linear infinite" }}>sync</span>}
                </span>
              </div>
              {/* Day of week headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", marginBottom: "1px" }}>
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(dn => (
                  <div key={dn} style={{ padding: "8px 0", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#606E74", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{dn}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", opacity: loadingMonth ? 0.4 : 1, transition: "opacity 0.2s" }}>
                {cells.map((day, i) => {
                  const dayStr = getCSTDateStr(day)
                  const isCurrentMonth = day.getMonth() === month
                  const isDayToday = dayStr === todayStr
                  // Filter from monthData using CST date comparison
                  const dayAppts = monthData.filter(a => {
                    if (!a.startTime || isBlockedTime(a)) return false
                    if (stylistFilter !== "all" && a.teamMemberId !== stylistFilter) return false
                    return getCSTDateStr(new Date(a.startTime)) === dayStr
                  })
                  // Debug: log one specific day
                  if (day.getDate() === 12 && day.getMonth() === month) {
                    console.log("[Month cell Apr 12]", { dayStr, dayAppts: dayAppts.length, monthDataLen: monthData.length, sampleAptDates: monthData.slice(0, 3).map(a => ({ raw: a.startTime, cst: getCSTDateStr(new Date(a.startTime)) })) })
                  }
                  const MAX_PILLS = 4
                  return (
                    <div
                      key={i}
                      onClick={() => { setDate(dayStr); setViewMode("day") }}
                      style={{
                        minHeight: isMobile ? "80px" : "110px", padding: "6px",
                        border: isDayToday ? "1px solid #7a8f96" : "1px solid rgba(255,255,255,0.05)",
                        borderRadius: "4px",
                        backgroundColor: isDayToday ? "rgba(122,143,150,0.05)" : isCurrentMonth ? "#0d1117" : "rgba(255,255,255,0.01)",
                        opacity: isCurrentMonth ? 1 : 0.3,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { if (isCurrentMonth) e.currentTarget.style.backgroundColor = isDayToday ? "rgba(122,143,150,0.08)" : "rgba(255,255,255,0.02)" }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = isDayToday ? "rgba(122,143,150,0.05)" : isCurrentMonth ? "#0d1117" : "rgba(255,255,255,0.01)" }}
                    >
                      {/* Day header row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        {dayAppts.length > 0 ? (
                          <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "'Fira Code', monospace", padding: "1px 5px", borderRadius: "4px", backgroundColor: "rgba(96,110,116,0.15)", color: "#7a8f96" }}>{dayAppts.length}</span>
                        ) : <span />}
                        <span style={{
                          fontSize: "13px", fontWeight: isDayToday ? 700 : 600, fontFamily: "'Fira Code', monospace",
                          color: isDayToday ? "#ffffff" : isCurrentMonth ? "#7a8f96" : "rgba(255,255,255,0.2)",
                          ...(isDayToday ? { backgroundColor: "#7a8f96", width: "22px", height: "22px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0d1117" } : {}),
                        }}>
                          {day.getDate()}
                        </span>
                      </div>
                      {/* Appointment pills */}
                      {dayAppts.slice(0, MAX_PILLS).map(appt => {
                        const color = (appt.teamMemberId && stylistColorMap[appt.teamMemberId]) || "#607D8B"
                        const isCancelled = appt.resolvedStatus === "CANCELLED" || appt.status?.startsWith("CANCELLED")
                        return (
                          <div
                            key={appt.id}
                            onClick={e => { e.stopPropagation(); setExpandedId(expandedId === appt.id ? null : appt.id) }}
                            style={{
                              width: "100%", height: "22px", borderRadius: "4px", marginBottom: "2px",
                              backgroundColor: `${color}2E`, borderLeft: `2px solid ${color}`,
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              paddingLeft: "5px", paddingRight: "4px", overflow: "hidden",
                              opacity: isCancelled ? 0.4 : 1,
                            }}
                          >
                            <span style={{ fontSize: "11px", color: isCancelled ? "#606E74" : "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: isCancelled ? "line-through" : "none" }}>
                              {clientShortName(appt.customerName)}
                            </span>
                            {appt.isCheckedOut && !isCancelled && (
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#22c55e", flexShrink: 0, marginLeft: "3px" }} />
                            )}
                          </div>
                        )
                      })}
                      {dayAppts.length > MAX_PILLS && (
                        <div onClick={e => { e.stopPropagation(); setDate(dayStr); setViewMode("day") }} style={{ fontSize: "11px", color: "#606E74", marginTop: "1px", cursor: "pointer" }}>
                          +{dayAppts.length - MAX_PILLS} more
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()
      ) : sorted.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          backgroundColor: "#0d1117", borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.06)",
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
        /* ── Day View Calendar ── */
        (() => {
          const totalHours = DAY_END_HOUR - DAY_START_HOUR
          const totalHeight = totalHours * HOUR_PX
          // Current time indicator
          const now = new Date()
          const nowMinutes = now.getHours() * 60 + now.getMinutes()
          const nowOffset = (nowMinutes - DAY_START_HOUR * 60) * (HOUR_PX / 60)
          const showNowLine = isToday && nowMinutes >= DAY_START_HOUR * 60 && nowMinutes <= DAY_END_HOUR * 60

          // Group overlapping appointments by stylist for side-by-side
          const stylistColumns: Record<string, Appointment[]> = {}
          for (const a of sorted) {
            const key = a.teamMemberId || "_none"
            if (!stylistColumns[key]) stylistColumns[key] = []
            stylistColumns[key].push(a)
          }

          return (
            <div ref={dayViewRef} style={{ position: "relative", marginTop: "8px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
                {sorted.length} Appointment{sorted.length !== 1 ? "s" : ""} &middot; Day View
              </div>
              <div style={{ display: "flex", position: "relative", minHeight: `${totalHeight}px` }}
                onDragOver={e => {
                  e.preventDefault()
                  if (!dragApptId || !dayViewRef.current) return
                  const rect = dayViewRef.current.getBoundingClientRect()
                  const offsetY = e.clientY - rect.top - 40 // account for header
                  const minutes = Math.max(0, Math.round(offsetY / (HOUR_PX / 60) / 15) * 15)
                  setDragGhostTime(minutes)
                }}
                onDrop={e => {
                  e.preventDefault()
                  if (dragApptId && dragGhostTime !== null) handleDrop(dragApptId, dragGhostTime)
                }}
              >
                {/* Time labels */}
                <div style={{ width: "56px", flexShrink: 0, position: "relative" }}>
                  {Array.from({ length: totalHours + 1 }, (_, i) => {
                    const hour = DAY_START_HOUR + i
                    return (
                      <div key={hour} style={{
                        position: "absolute", top: `${i * HOUR_PX - 7}px`, right: "8px",
                        fontSize: "10px", fontWeight: 600, color: "rgba(205,201,192,0.4)",
                        lineHeight: "14px",
                      }}>
                        {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                      </div>
                    )
                  })}
                </div>

                {/* Grid + appointments */}
                <div style={{ flex: 1, position: "relative", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Hour grid lines */}
                  {Array.from({ length: totalHours + 1 }, (_, i) => (
                    <div key={i} style={{ position: "absolute", top: `${i * HOUR_PX}px`, left: 0, right: 0, height: "1px", backgroundColor: "rgba(205,201,192,0.06)" }} />
                  ))}
                  {/* Half-hour grid lines */}
                  {Array.from({ length: totalHours }, (_, i) => (
                    <div key={`h${i}`} style={{ position: "absolute", top: `${i * HOUR_PX + HOUR_PX / 2}px`, left: 0, right: 0, height: "1px", backgroundColor: "rgba(205,201,192,0.03)" }} />
                  ))}

                  {/* Current time line */}
                  {showNowLine && (
                    <div style={{ position: "absolute", top: `${nowOffset}px`, left: "-4px", right: 0, zIndex: 10, display: "flex", alignItems: "center" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#EF4444", flexShrink: 0 }} />
                      <div style={{ flex: 1, height: "2px", backgroundColor: "#EF4444" }} />
                    </div>
                  )}

                  {/* Drag ghost preview */}
                  {dragApptId && dragGhostTime !== null && (
                    <div style={{
                      position: "absolute", top: `${dragGhostTime * (HOUR_PX / 60)}px`, left: "4px", right: "4px",
                      height: "40px", backgroundColor: "rgba(255,255,255,0.06)", border: "2px dashed rgba(205,201,192,0.3)",
                      borderRadius: "6px", zIndex: 5, pointerEvents: "none",
                    }} />
                  )}

                  {/* Appointment blocks */}
                  {sorted.map(appt => {
                    const startDate = new Date(appt.startTime)
                    const startMin = startDate.getHours() * 60 + startDate.getMinutes()
                    const duration = appt.totalDurationMinutes || 60
                    const topPx = (startMin - DAY_START_HOUR * 60) * (HOUR_PX / 60)
                    const heightPx = Math.max(duration * (HOUR_PX / 60), 30)
                    const blocked = isBlockedTime(appt)
                    const color = blocked ? "#3a3f47" : ((appt.teamMemberId && stylistColorMap[appt.teamMemberId]) || "#607D8B")

                    // Detect overlaps for same stylist → offset side by side
                    const sameStylists = stylistColumns[appt.teamMemberId || "_none"] || []
                    const overlapping = sameStylists.filter(o => {
                      if (o.id === appt.id) return false
                      const oStart = new Date(o.startTime).getHours() * 60 + new Date(o.startTime).getMinutes()
                      const oEnd = oStart + (o.totalDurationMinutes || 60)
                      return startMin < oEnd && (startMin + duration) > oStart
                    })
                    const overlapIdx = overlapping.length > 0 ? sameStylists.filter(o => {
                      const oStart = new Date(o.startTime).getHours() * 60 + new Date(o.startTime).getMinutes()
                      const oEnd = oStart + (o.totalDurationMinutes || 60)
                      return startMin < oEnd && (startMin + duration) > oStart
                    }).findIndex(o => o.id === appt.id) : 0
                    const overlapTotal = overlapping.length > 0 ? overlapping.length + 1 : 1
                    const widthPct = 100 / overlapTotal
                    const leftPct = overlapIdx * widthPct

                    // Is in progress?
                    const isInProgress = !blocked && isToday && appt.resolvedStatus === "IN_PROGRESS"

                    return (
                      <div
                        key={appt.id}
                        draggable={!blocked}
                        onDragStart={() => { if (!blocked) setDragApptId(appt.id) }}
                        onDragEnd={() => { setDragApptId(null); setDragGhostTime(null) }}
                        onClick={() => { if (!blocked) setExpandedId(expandedId === appt.id ? null : appt.id) }}
                        style={{
                          position: "absolute",
                          top: `${topPx}px`,
                          left: `calc(${leftPct}% + 4px)`,
                          width: `calc(${widthPct}% - 8px)`,
                          height: `${heightPx}px`,
                          backgroundColor: blocked ? "rgba(58,63,71,0.7)" : `${color}CC`,
                          borderRadius: "6px",
                          padding: "6px 8px",
                          cursor: blocked ? "default" : "grab",
                          overflow: "hidden",
                          zIndex: dragApptId === appt.id ? 20 : 2,
                          opacity: dragApptId === appt.id ? 0.5 : appt.isCheckedOut ? 0.4 : 1,
                          border: blocked ? "1px dashed rgba(205,201,192,0.2)" : expandedId === appt.id ? "2px solid #fff" : "1px solid rgba(0,0,0,0.2)",
                          transition: "opacity 0.15s",
                        }}
                      >
                        {blocked ? (
                          <>
                            <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              BLOCKED — {getBlockReason(appt)}
                            </div>
                            {heightPx > 40 && appt.teamMemberId && (
                              <div style={{ fontSize: "9px", color: "rgba(205,201,192,0.35)", marginTop: "2px" }}>
                                {TEAM_NAMES[appt.teamMemberId] || ""}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              {isInProgress && (
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                              )}
                              <span
                                onClick={e => { e.stopPropagation(); if (appt.customerId) openClientHistory(appt.customerId) }}
                                style={{ color: "#fff", fontSize: "11px", fontWeight: 700, cursor: appt.customerId ? "pointer" : "default", textDecoration: appt.customerId ? "underline" : "none", textDecorationColor: "rgba(255,255,255,0.3)" }}
                              >
                                {appt.customerName}
                              </span>
                            </div>
                            {heightPx > 40 && appt.services?.[0] && (
                              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {appt.services.map(s => s.serviceName).join(", ")}
                              </div>
                            )}
                            {heightPx > 55 && appt.teamMemberId && (
                              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", marginTop: "1px" }}>
                                {TEAM_NAMES[appt.teamMemberId] || ""}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            </div>
          )
        })()
      ) : (
        /* ── List View ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(() => {
            const timeGroups = [
              { label: "Morning", items: sorted.filter(a => new Date(a.startTime).getHours() < 12) },
              { label: "Afternoon", items: sorted.filter(a => { const h = new Date(a.startTime).getHours(); return h >= 12 && h < 17 }) },
              { label: "Evening", items: sorted.filter(a => new Date(a.startTime).getHours() >= 17) },
            ].filter(g => g.items.length > 0)
            return timeGroups.map(group => (
              <div key={group.label}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#606E74", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", marginBottom: "8px" }}>
                  {group.label} &middot; {group.items.length} appointment{group.items.length !== 1 ? "s" : ""}
                </div>
                {group.items.map((appt) => {
            const isExpanded = expandedId === appt.id
            const statusStyle = getStatusStyle(appt)
            const blocked = isBlockedTime(appt)

            if (blocked) {
              return (
                <div key={appt.id} style={{
                  padding: "14px 16px",
                  backgroundColor: "rgba(205,201,192,0.03)",
                  border: "1px solid rgba(205,201,192,0.06)",
                  borderLeft: "3px solid rgba(205,201,192,0.25)",
                  borderRadius: "10px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "rgba(205,201,192,0.35)" }}>block</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(205,201,192,0.55)" }}>
                        {appt.teamMemberId ? (TEAM_NAMES[appt.teamMemberId] || "") : ""} — Blocked: {getBlockReason(appt)}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.35)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>schedule</span>
                      {fmtTime(appt.startTime)}{appt.endTime ? ` - ${fmtTime(appt.endTime)}` : appt.totalDurationMinutes ? ` (${appt.totalDurationMinutes} min)` : ""}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "8px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px",
                    backgroundColor: "rgba(205,201,192,0.06)", color: "rgba(205,201,192,0.4)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>BLOCKED</span>
                </div>
              )
            }

            return (
              <div key={appt.id}>
                <button
                  onClick={() => { setExpandedId(isExpanded ? null : appt.id); if (isMobile) setSelectedAppt(appt) }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "16px",
                    backgroundColor: "#0d1117",
                    border: appt.isCheckedOut ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `3px solid ${(appt.teamMemberId && stylistColorMap[appt.teamMemberId]) || (appt.isCheckedOut ? "rgba(16,185,129,0.3)" : statusStyle.border)}`,
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
                    <span
                      onClick={e => { if (appt.customerId) { e.stopPropagation(); openClientHistory(appt.customerId) } }}
                      style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 700, cursor: appt.customerId ? "pointer" : "default", textDecoration: appt.customerId ? "underline" : "none", textDecorationColor: "rgba(255,255,255,0.2)" }}
                    >
                      {appt.customerName}
                    </span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {appt.isCheckedOut && appt.checkoutDetails && (
                        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "12px", fontWeight: 700, color: "#22c55e" }}>
                          ${appt.checkoutDetails.total.toFixed(2)}
                        </span>
                      )}
                      <span style={{
                        fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px",
                        backgroundColor: statusStyle.bg, color: statusStyle.text,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        display: "flex", alignItems: "center", gap: "3px",
                      }}>
                        {appt.isCheckedOut && <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>check_circle</span>}
                        {statusStyle.label}
                      </span>
                    </div>
                  </div>

                  {/* Time + Stylist row */}
                  <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "rgba(205,201,192,0.55)", fontWeight: 500, alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>schedule</span>
                      <span style={{ fontFamily: "'Fira Code', monospace", color: "#ffffff", fontWeight: 600 }}>{fmtTime(appt.startTime)}{appt.endTime ? ` - ${fmtTime(appt.endTime)}` : ""}</span>
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

                  {/* Actions based on resolved status */}
                  {appt.isCheckedOut && appt.checkoutDetails && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px", fontSize: "11px", color: "rgba(205,201,192,0.45)" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "13px", color: "#22c55e" }}>check_circle</span>
                      <span style={{ fontFamily: "'Fira Code', monospace", color: "rgba(205,201,192,0.5)" }}>{appt.checkoutDetails.paymentMethod}</span>
                      {appt.checkoutDetails.closedAt && (
                        <span style={{ fontFamily: "'Fira Code', monospace", color: "rgba(205,201,192,0.35)" }}>
                          {new Date(appt.checkoutDetails.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}
                        </span>
                      )}
                    </div>
                  )}
                  {!appt.isCheckedOut && (appt.resolvedStatus === "ACCEPTED" || appt.resolvedStatus === "UPCOMING" || appt.resolvedStatus === "IN_PROGRESS" || appt.status === "ACCEPTED" || appt.status === "PENDING") && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                      <Link
                        href={`/pos?appointmentId=${appt.id}&location=${encodeURIComponent(location)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", flex: 1,
                          fontSize: "10px", fontWeight: 700, color: "#CDC9C0",
                          textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase",
                          padding: "10px 0",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>point_of_sale</span>
                        Checkout
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCancelConfirm({ id: appt.id, clientName: appt.customerName, time: fmtTime(appt.startTime) }) }}
                        style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
                      >Cancel</button>
                    </div>
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    margin: "-6px 0 0 3px",
                    padding: "14px 16px",
                    backgroundColor: "rgba(26,42,50,0.7)",
                    border: "1px solid rgba(255,255,255,0.06)",
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

                    {/* Send Reminder */}
                    {(appt.resolvedStatus === "ACCEPTED" || appt.resolvedStatus === "UPCOMING") && !appt.isCheckedOut && (
                      <button
                        onClick={() => sendReminder(appt.id)}
                        disabled={reminderSent.has(appt.id) || reminderSending === appt.id}
                        style={{
                          padding: "8px 14px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                          borderRadius: "6px", border: "none", cursor: reminderSent.has(appt.id) ? "default" : "pointer",
                          backgroundColor: reminderSent.has(appt.id) ? "rgba(16,185,129,0.12)" : "rgba(79,142,247,0.12)",
                          color: reminderSent.has(appt.id) ? "#10B981" : "#4F8EF7",
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          opacity: reminderSending === appt.id ? 0.6 : 1,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                          {reminderSent.has(appt.id) ? "check_circle" : "send"}
                        </span>
                        {reminderSending === appt.id ? "Sending..." : reminderSent.has(appt.id) ? "Reminder Sent" : "Send Reminder"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
                })}
              </div>
            ))
          })()}
        </div>
      )}

      {/* Stylist color legend */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px", marginBottom: "12px" }}>
        {getLocationStylists(location).map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "rgba(205,201,192,0.6)" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: stylistColorMap[s.id] || "#666" }} />
            {s.name}
          </div>
        ))}
      </div>

      {/* Waitlist panel */}
      {showWaitlist && (
        <div style={{ marginTop: "16px", backgroundColor: "#0d1117", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>Waitlist — {location === "Corpus Christi" ? "CC" : "SA"}</span>
          </div>
          {/* Add form */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>Name</div>
              <input value={wlForm.customerName} onChange={e => setWlForm(p => ({ ...p, customerName: e.target.value }))} style={{ width: "100%", padding: "7px 10px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#fff", fontSize: "13px", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>Phone</div>
              <input value={wlForm.customerPhone} onChange={e => setWlForm(p => ({ ...p, customerPhone: e.target.value }))} style={{ width: "100%", padding: "7px 10px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#fff", fontSize: "13px", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: "100px" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>Notes</div>
              <input value={wlForm.notes} onChange={e => setWlForm(p => ({ ...p, notes: e.target.value }))} placeholder="Service, stylist..." style={{ width: "100%", padding: "7px 10px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#fff", fontSize: "13px", outline: "none" }} />
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

      {/* Block Time Modal */}
      {showBlock && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "#fff" }}>Block Time</h2>
              <button onClick={() => setShowBlock(false)} style={{ background: "none", border: "none", color: "rgba(205,201,192,0.5)", cursor: "pointer", fontSize: "20px" }}>&times;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Stylist */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Stylist</div>
                <select value={blockStylist} onChange={e => setBlockStylist(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                  <option value="">Select stylist...</option>
                  {getLocationStylists(location).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Date</div>
                <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", colorScheme: "dark", boxSizing: "border-box" }} />
              </div>

              {/* Start / End time */}
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Start</div>
                  <select value={blockStart} onChange={e => setBlockStart(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                    {Array.from({ length: 53 }, (_, i) => { const h = Math.floor(i / 4) + 8; const m = (i % 4) * 15; if (h > 21) return null; const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; const label = new Date(`2026-01-01T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); return <option key={t} value={t}>{label}</option> }).filter(Boolean)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>End</div>
                  <select value={blockEnd} onChange={e => setBlockEnd(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                    {Array.from({ length: 53 }, (_, i) => { const h = Math.floor(i / 4) + 8; const m = (i % 4) * 15; if (h > 21) return null; const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; const label = new Date(`2026-01-01T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); return <option key={t} value={t}>{label}</option> }).filter(Boolean)}
                  </select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Reason</div>
                <select value={blockReason} onChange={e => setBlockReason(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                  {["Lunch", "Break", "Personal", "Training", "Other"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Notes (optional)</div>
                <input value={blockNotes} onChange={e => setBlockNotes(e.target.value)} placeholder="Additional details..." style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
              </div>

              {blockError && <div style={{ fontSize: "12px", color: "#EF4444" }}>{blockError}</div>}

              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button onClick={() => setShowBlock(false)} style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Cancel</button>
                <button onClick={submitBlock} disabled={blockSaving || !blockStylist} style={{ flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px", color: "#0f1d24", fontWeight: 700, cursor: "pointer", opacity: !blockStylist || blockSaving ? 0.5 : 1 }}>{blockSaving ? "Blocking..." : "Block Time"}</button>
              </div>
            </div>
          </div>
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
              {[1,2,3,4,5].map(s => <div key={s} style={{ flex: 1, height: "3px", borderRadius: "2px", backgroundColor: bookStep >= s ? (s === 5 ? "#22c55e" : "#CDC9C0") : "rgba(255,255,255,0.08)" }} />)}
            </div>

            {/* Step 1 — Client */}
            {bookStep === 1 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "10px" }}>Step 1 — Client</div>
                {!newClient ? (<>
                  <input value={clientSearch} onChange={e => searchClients(e.target.value)} placeholder="Search client by name, phone, or email..." style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", marginBottom: "8px", boxSizing: "border-box" }} />
                  {clientSearching && <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.4)", padding: "8px 0" }}>Searching...</div>}
                  {clientResults.map(c => (
                    <div key={c.id} onClick={() => { setBookClient({ id: c.id, name: `${c.givenName} ${c.familyName}`.trim() }); setBookStep(2) }} style={{ padding: "10px 12px", borderRadius: "8px", cursor: "pointer", marginBottom: "4px", backgroundColor: "rgba(205,201,192,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{c.givenName} {c.familyName}</div>
                      <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)" }}>{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
                    </div>
                  ))}
                  <button onClick={() => setNewClient(true)} style={{ marginTop: "8px", padding: "8px 14px", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "rgba(205,201,192,0.6)", fontSize: "12px", cursor: "pointer", width: "100%" }}>New Client</button>
                </>) : (<>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input value={newClientForm.givenName} onChange={e => setNewClientForm(p => ({ ...p, givenName: e.target.value }))} placeholder="First name" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <input value={newClientForm.familyName} onChange={e => setNewClientForm(p => ({ ...p, familyName: e.target.value }))} placeholder="Last name" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <input value={newClientForm.phone} onChange={e => setNewClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <input value={newClientForm.email} onChange={e => setNewClientForm(p => ({ ...p, email: e.target.value }))} placeholder="Email (optional)" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setNewClient(false)} style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
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
                      <button key={s.id} onClick={() => setBookStylist(s.id)} style={{ padding: "6px 12px", borderRadius: "6px", border: bookStylist === s.id ? "1px solid #CDC9C0" : "1px solid rgba(255,255,255,0.08)", backgroundColor: bookStylist === s.id ? "rgba(255,255,255,0.06)" : "transparent", color: bookStylist === s.id ? "#fff" : "rgba(205,201,192,0.6)", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: stylistColorMap[s.id] || "#666" }} />{s.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Date</div>
                    <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", colorScheme: "dark", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "6px" }}>Time</div>
                    <select value={bookTime} onChange={e => setBookTime(e.target.value)} style={{ width: "100%", padding: "10px 14px", backgroundColor: "#06080d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#ffffff", fontSize: "14px", outline: "none", boxSizing: "border-box" as const }}>
                      {Array.from({ length: 52 }, (_, i) => { const h = Math.floor(i / 4) + 8; const m = (i % 4) * 15; if (h > 20) return null; const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; const label = new Date(`2026-01-01T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); const busy = bookStylist && appointments.some(a => a.teamMemberId === bookStylist && a.startTime && new Date(a.startTime).toISOString().includes(bookDate) && Math.abs(new Date(a.startTime).getHours() * 60 + new Date(a.startTime).getMinutes() - (h * 60 + m)) < (a.totalDurationMinutes || 60)); return <option key={t} value={t} style={{ backgroundColor: "#0d1117", color: busy ? "#606E74" : "#ffffff" }}>{label}{busy ? " (booked)" : ""}</option> }).filter(Boolean)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setBookStep(1)} style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
                  <button onClick={() => setBookStep(3)} disabled={!bookStylist} style={{ flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px", color: "#0f1d24", fontWeight: 700, cursor: "pointer", opacity: !bookStylist ? 0.5 : 1 }}>Next</button>
                </div>
              </div>
            )}

            {/* Step 3 — Services */}
            {bookStep === 3 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "10px" }}>Step 3 — Select Services</div>
                {/* Service search */}
                <input
                  placeholder="Search services..."
                  onChange={e => { const q = e.target.value.toLowerCase(); e.currentTarget.dataset.q = q }}
                  onInput={e => { const el = e.currentTarget; el.parentElement?.querySelectorAll("[data-svc]").forEach(d => { const n = d.getAttribute("data-svc") || ""; (d as HTMLElement).style.display = n.toLowerCase().includes(el.value.toLowerCase()) || !el.value ? "" : "none" }) }}
                  style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", marginBottom: "12px", boxSizing: "border-box" as const }}
                />
                <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "12px" }}>
                  {bookServices.length === 0 ? <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "13px", padding: "20px 0", textAlign: "center" }}>Loading services...</div> : (() => {
                    const POPULAR = ["Envy Cut", "Full Highlight", "Partial Highlight", "Envy Color", "Color Touch Up", "Full Highlight & Base Color", "Partial Highlight & Base Color", "Envy Dry Cut", "Toner", "Brazilian Blowout", "Blonde Touch Up", "Envy Blonde"]
                    const sorted = [...bookServices].sort((a, b) => {
                      const ai = POPULAR.findIndex(p => a.name.includes(p))
                      const bi = POPULAR.findIndex(p => b.name.includes(p))
                      if (ai >= 0 && bi >= 0) return ai - bi
                      if (ai >= 0) return -1
                      if (bi >= 0) return 1
                      return a.name.localeCompare(b.name)
                    })
                    return sorted.map((s: { id: string; name: string; price: number; durationMinutes: number; version?: number }) => {
                      const sel = bookSelectedSvcs.some(x => x.id === s.id)
                      return (
                        <div key={s.id} data-svc={s.name} onClick={() => sel ? setBookSelectedSvcs(p => p.filter(x => x.id !== s.id)) : setBookSelectedSvcs(p => [...p, s])} style={{ padding: "14px", borderRadius: "10px", cursor: "pointer", marginBottom: "4px", backgroundColor: sel ? "rgba(122,143,150,0.08)" : "#0d1117", border: sel ? "1px solid #7a8f96" : "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: sel ? 600 : 400, color: sel ? "#fff" : "rgba(205,201,192,0.7)" }}>{s.name}</div>
                            <div style={{ fontSize: "11px", color: "#606E74", fontFamily: "'Fira Code', monospace" }}>{s.durationMinutes} min</div>
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: sel ? "#22c55e" : "rgba(205,201,192,0.5)", fontFamily: "'Fira Code', monospace" }}>${s.price.toFixed(2)}</div>
                        </div>
                      )
                    })
                  })()}
                </div>
                {bookSelectedSvcs.length > 0 && <div style={{ fontSize: "13px", fontWeight: 700, color: "#22c55e", textAlign: "right", marginBottom: "12px", fontFamily: "'Fira Code', monospace" }}>Total: ${bookSelectedSvcs.reduce((s, sv) => s + sv.price, 0).toFixed(2)}</div>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setBookStep(2)} style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
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
                <textarea value={bookNotes} onChange={e => setBookNotes(e.target.value)} placeholder="Notes (optional)" style={{ width: "100%", padding: "10px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none", minHeight: "60px", resize: "vertical" as const, marginBottom: "12px", boxSizing: "border-box" as const }} />

                {/* Card on File */}
                <div style={{ marginBottom: 12, background: "rgba(122,143,150,0.06)", border: "1px solid rgba(122,143,150,0.2)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7a8f96", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>Card on File Request</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <input type="checkbox" id="sendCardSMS" checked={sendCardSMS} onChange={e => setSendCardSMS(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#7a8f96", cursor: "pointer" }} />
                    <label htmlFor="sendCardSMS" style={{ fontSize: 13, color: "#ffffff", cursor: "pointer" }}>Send secure card link to client after booking</label>
                  </div>
                  {sendCardSMS && (
                    <div>
                      <input type="tel" placeholder="Client phone number" value={cardPhone} onChange={e => setCardPhone(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", color: "#ffffff", fontSize: 14, boxSizing: "border-box" as const, outline: "none" }} />
                      <div style={{ fontSize: 11, color: "#606E74", marginTop: 6 }}>Client receives: &quot;Add a card to secure your appointment&quot; with a secure link.</div>
                    </div>
                  )}
                </div>

                {bookError && <div style={{ fontSize: "13px", color: "#EF4444", marginBottom: "10px", padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", lineHeight: 1.5, wordBreak: "break-word" as const }}>{bookError}</div>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setBookStep(3); setBookOverlap(false) }} style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", backgroundColor: "transparent", color: "rgba(205,201,192,0.6)", cursor: "pointer" }}>Back</button>
                  <button onClick={submitBooking} disabled={bookSaving} style={{ flex: 2, padding: "10px", backgroundColor: "#CDC9C0", border: "none", borderRadius: "8px", color: "#0f1d24", fontWeight: 700, cursor: "pointer", opacity: bookSaving ? 0.5 : 1 }}>{bookSaving ? "Booking..." : bookOverlap ? "Book Anyway" : "Book Appointment"}</button>
                </div>
              </div>
            )}

            {/* Step 5 — Success */}
            {bookStep === 5 && bookSuccess && (
              <div style={{ textAlign: "center", padding: "32px 20px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, color: "#22c55e" }}>&#10003;</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>Appointment Booked!</div>
                <div style={{ fontSize: 14, color: "#7a8f96", marginBottom: 16 }}>
                  {bookClient?.name} is confirmed for {new Date(`${bookDate}T${bookTime}:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {new Date(`2026-01-01T${bookTime}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} with {TEAM_NAMES[bookStylist] || "stylist"}
                </div>
                {sendCardSMS && cardPhone && (
                  <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#22c55e" }}>
                    Card request sent to {cardPhone}
                  </div>
                )}
                <button
                  onClick={() => { setShowBooking(false); resetBooking(); setBookSuccess(false); setSendCardSMS(true); setCardPhone("") }}
                  style={{ width: "100%", height: 48, background: "rgba(122,143,150,0.15)", border: "1px solid #7a8f96", borderRadius: 10, color: "#ffffff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      </>}

      {/* ══════════ TRANSACTIONS TAB ══════════ */}
      {activeTab === "transactions" && (
        <div>
          {/* Period selector */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
            {TX_PERIODS.map(p => (
              <button key={p.key} onClick={() => setTxPeriod(p.key)} style={{
                padding: "6px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
                borderRadius: "20px", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                backgroundColor: txPeriod === p.key ? "#CDC9C0" : "rgba(205,201,192,0.06)",
                color: txPeriod === p.key ? "#0f1d24" : "rgba(205,201,192,0.45)",
              }}>{p.label}</button>
            ))}
          </div>

          {/* Custom range inputs */}
          {txPeriod === "custom" && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>Start</div>
                <input type="date" value={txCustomStart} onChange={e => setTxCustomStart(e.target.value)} style={{ padding: "8px 12px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "13px", outline: "none", colorScheme: "dark" }} />
              </div>
              <div>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "4px" }}>End</div>
                <input type="date" value={txCustomEnd} onChange={e => setTxCustomEnd(e.target.value)} style={{ padding: "8px 12px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "13px", outline: "none", colorScheme: "dark" }} />
              </div>
              <button onClick={fetchTransactions} style={{ padding: "8px 16px", backgroundColor: "#CDC9C0", color: "#0f1d24", border: "none", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Apply</button>
            </div>
          )}

          {/* Summary cards */}
          {txData?.summary && !txLoading && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Total Revenue", value: fmtCurrency(txData.summary.revenue), icon: "attach_money" },
                { label: "Total Tips", value: fmtCurrency(txData.summary.tips), icon: "volunteer_activism" },
                { label: "Total Tax", value: fmtCurrency(txData.summary.tax), icon: "receipt_long" },
                { label: "Total Collected", value: fmtCurrency(txData.summary.total), icon: "account_balance_wallet" },
                { label: "# Transactions", value: String(txData.summary.count), icon: "receipt" },
                { label: "Avg Ticket", value: fmtCurrency(txData.summary.avgTicket), icon: "analytics" },
              ].map(c => (
                <div key={c.label} style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "20px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "rgba(205,201,192,0.35)" }}>{c.icon}</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#606E74" }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 600, color: "#ffffff", fontFamily: "'Fira Code', monospace" }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Export buttons */}
          {txData?.transactions && txData.transactions.length > 0 && !txLoading && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "12px" }}>
              <button onClick={exportTxCsv} style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                borderRadius: "8px", border: "1px solid #606E74", backgroundColor: "transparent",
                color: "#7a8f96", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
                Export CSV
              </button>
              <button onClick={downloadTxReport} style={{
                padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                borderRadius: "8px", border: "1px solid #606E74", backgroundColor: "transparent",
                color: "#7a8f96", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>summarize</span>
                Download Report
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {txLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} style={{ height: "48px", backgroundColor: "rgba(205,201,192,0.04)", borderRadius: "8px", animation: "pulse 1.5s ease-in-out infinite", opacity: 1 - i * 0.08 }} />
              ))}
              <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.8 } }`}</style>
            </div>
          )}

          {/* Empty state */}
          {!txLoading && txData && txData.transactions.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#0d1117", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", display: "block", marginBottom: "12px", color: "rgba(205,201,192,0.2)" }}>receipt_long</span>
              <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "14px", fontWeight: 600 }}>No transactions found for this period.</div>
            </div>
          )}

          {/* Transaction table */}
          {!txLoading && txData && txData.transactions.length > 0 && (
            <>
              <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "rgba(205,201,192,0.04)" }}>
                      {["Time", "Client", "Stylist", "Services", "Payment", "Subtotal", "Tips", "Tax", "Total"].map(h => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: h === "Subtotal" || h === "Tips" || h === "Tax" || h === "Total" ? "right" : "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#606E74", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txPageData.map((tx, idx) => (
                      <tr key={tx.id} style={{ cursor: "pointer", transition: "background 0.15s", backgroundColor: idx % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent")}
                      >
                        <td style={{ padding: "14px", fontSize: "12px", color: "#606E74", fontWeight: 600, fontFamily: "'Fira Code', monospace", borderBottom: "1px solid rgba(205,201,192,0.04)", whiteSpace: "nowrap" }}>
                          {new Date(tx.closedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}
                        </td>
                        <td style={{ padding: "14px", fontSize: "14px", color: "#ffffff", fontWeight: 600, borderBottom: "1px solid rgba(205,201,192,0.04)" }}>{tx.customerName}</td>
                        <td style={{ padding: "14px", fontSize: "13px", color: "#7a8f96", borderBottom: "1px solid rgba(205,201,192,0.04)" }}>
                          {tx.stylistName}
                          {tx.stylistLocation && (
                            <span style={{ marginLeft: "6px", fontSize: "10px", fontWeight: 700, fontFamily: "'Fira Code', monospace", padding: "1px 6px", borderRadius: "4px", backgroundColor: tx.stylistLocation === "CC" ? "rgba(59,130,246,0.1)" : "rgba(168,85,247,0.1)", color: tx.stylistLocation === "CC" ? "#60a5fa" : "#a78bfa" }}>{tx.stylistLocation}</span>
                          )}
                        </td>
                        <td style={{ padding: "14px", fontSize: "12px", color: "#606E74", borderBottom: "1px solid rgba(205,201,192,0.04)", maxWidth: "200px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden", maxHeight: "36px" }}>
                            {tx.services.slice(0, 2).map((s: string, i: number) => <span key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</span>)}
                            {tx.services.length > 2 && <span style={{ color: "rgba(96,110,116,0.6)" }}>+{tx.services.length - 2} more</span>}
                          </div>
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid rgba(205,201,192,0.04)" }}>{paymentBadge(tx.paymentMethod)}</td>
                        <td style={{ padding: "14px", fontSize: "12px", color: "#ffffff", fontFamily: "'Fira Code', monospace", borderBottom: "1px solid rgba(205,201,192,0.04)", textAlign: "right" }}>{fmtCurrency(tx.subtotal)}</td>
                        <td style={{ padding: "14px", fontSize: "12px", color: tx.tips > 0 ? "#22c55e" : "#606E74", fontFamily: "'Fira Code', monospace", borderBottom: "1px solid rgba(205,201,192,0.04)", textAlign: "right" }}>{tx.tips > 0 ? fmtCurrency(tx.tips) : "\u2014"}</td>
                        <td style={{ padding: "14px", fontSize: "12px", color: "#606E74", fontFamily: "'Fira Code', monospace", borderBottom: "1px solid rgba(205,201,192,0.04)", textAlign: "right" }}>{fmtCurrency(tx.tax)}</td>
                        <td style={{ padding: "14px", fontSize: "12px", color: "#ffffff", fontWeight: 700, fontFamily: "'Fira Code', monospace", borderBottom: "1px solid rgba(205,201,192,0.04)", textAlign: "right" }}>{fmtCurrency(tx.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", padding: "0 4px" }}>
                <span style={{ fontSize: "11px", color: "rgba(205,201,192,0.4)" }}>
                  Showing {txPage * TX_PER_PAGE + 1}–{Math.min((txPage + 1) * TX_PER_PAGE, txData.transactions.length)} of {txData.transactions.length}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0} style={{
                    padding: "6px 12px", fontSize: "10px", fontWeight: 700, borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "transparent",
                    color: txPage === 0 ? "rgba(205,201,192,0.2)" : "rgba(205,201,192,0.6)",
                    cursor: txPage === 0 ? "default" : "pointer",
                  }}>Prev</button>
                  <button onClick={() => setTxPage(p => Math.min(txTotalPages - 1, p + 1))} disabled={txPage >= txTotalPages - 1} style={{
                    padding: "6px 12px", fontSize: "10px", fontWeight: 700, borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "transparent",
                    color: txPage >= txTotalPages - 1 ? "rgba(205,201,192,0.2)" : "rgba(205,201,192,0.6)",
                    cursor: txPage >= txTotalPages - 1 ? "default" : "pointer",
                  }}>Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════ CLIENTS TAB ══════════ */}
      {activeTab === "clients" && (
        <div>
          {/* Search + Stats */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span className="material-symbols-outlined" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#606E74" }}>search</span>
              <input
                value={clientsSearch}
                onChange={e => setClientsSearch(e.target.value)}
                placeholder="Search by name, phone, or email..."
                style={{ width: "100%", padding: "10px 12px 10px 36px", backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#ffffff", fontSize: "13px", outline: "none", boxSizing: "border-box" as const }}
              />
              {clientsSearch && (
                <button onClick={() => setClientsSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#606E74", fontSize: "16px", lineHeight: 1 }}>&times;</button>
              )}
            </div>
            {isOwner && (
              <button onClick={() => { fetch("/api/clients/sync", { method: "POST" }).then(() => fetchClientsPage(0)) }} style={{ padding: "9px 14px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", backgroundColor: "transparent", color: "#7a8f96", fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                Sync
              </button>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
            {[
              { label: "Total Clients", value: clientsTotal.toLocaleString(), color: "#ffffff" },
              { label: "With Formula", value: String(clientsList.filter(c => c.hasFormula).length), color: "#C9A84C" },
              { label: "Showing", value: String(clientsList.length), color: "#7a8f96" },
            ].map(s => (
              <div key={s.label} style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "20px", fontWeight: 700, color: s.color, fontFamily: "'Fira Code', monospace" }}>{s.value}</div>
                <div style={{ fontSize: "9px", fontWeight: 700, color: "#606E74", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Client list */}
          {clientsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: "140px", height: "14px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "4px", marginBottom: "6px", animation: "pulse 1.5s infinite" }} />
                    <div style={{ width: "100px", height: "11px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : clientsList.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "rgba(205,201,192,0.2)", display: "block", marginBottom: "10px" }}>group</span>
              <div style={{ color: "#606E74", fontSize: "14px" }}>{clientsSearch ? `No clients found for "${clientsSearch}"` : "No clients yet"}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {clientsList.map(c => {
                const avatarColors = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626", "#0891b2", "#7c2d12"]
                const colorIdx = (`${c.firstName || ""}${c.lastName || ""}`).charCodeAt(0) % avatarColors.length
                const initials = `${(c.firstName || "?")[0]}${(c.lastName || "")[0] || ""}`.toUpperCase()
                return (
                  <div key={c.id} onClick={() => openClientDetail(c)} style={{
                    display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px",
                    backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#141b22"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#0d1117"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)" }}
                  >
                    <div style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: avatarColors[colorIdx], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{initials}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.firstName} {c.lastName}</div>
                      <div style={{ fontSize: "11px", color: "#606E74", fontFamily: "'Fira Code', monospace", marginTop: "2px" }}>
                        {c.phone || c.email || "No contact"}{c.lastVisitAt ? ` · ${new Date(c.lastVisitAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                      {(c.totalVisits || 0) > 0 && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'Fira Code', monospace", fontSize: "15px", fontWeight: 700, color: "#fff" }}>{c.totalVisits}</div>
                          <div style={{ fontSize: "9px", color: "#606E74", textTransform: "uppercase" as const }}>visits</div>
                        </div>
                      )}
                      {c.hasFormula && (
                        <span style={{ fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "12px", backgroundColor: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", color: "#C9A84C", letterSpacing: "0.04em" }}>FORMULA</span>
                      )}
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#606E74" }}>chevron_right</span>
                    </div>
                  </div>
                )
              })}
              {/* Load more */}
              {clientsHasMore && (
                <button onClick={() => fetchClientsPage(clientsPage + 1, true)} disabled={clientsLoadingMore} style={{
                  width: "100%", padding: "14px", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#7a8f96", fontSize: "13px", cursor: "pointer", marginTop: "6px",
                  opacity: clientsLoadingMore ? 0.5 : 1,
                }}>
                  {clientsLoadingMore ? "Loading..." : `Load More (${clientsTotal - clientsList.length} remaining)`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ CLIENT DETAIL SLIDE-IN PANEL ══════════ */}
      {selectedClient && (
        <>
          <div onClick={() => { setSelectedClient(null); setClientDetail(null); setShowFormulaForm(false) }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 299 }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 95vw)", backgroundColor: "#0d1117", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 300, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {(() => { const avatarColors = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626", "#0891b2", "#7c2d12"]; const ci = (`${selectedClient.firstName || ""}${selectedClient.lastName || ""}`).charCodeAt(0) % avatarColors.length; const initials = `${(selectedClient.firstName || "?")[0]}${(selectedClient.lastName || "")[0] || ""}`.toUpperCase(); return (
                  <div style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: avatarColors[ci], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{initials}</span>
                  </div>
                ) })()}
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{selectedClient.firstName} {selectedClient.lastName}</div>
                  <div style={{ fontSize: "12px", color: "#7a8f96", marginTop: "1px" }}>Client Profile</div>
                </div>
              </div>
              <button onClick={() => { setSelectedClient(null); setClientDetail(null); setShowFormulaForm(false) }} style={{ background: "none", border: "none", color: "#7a8f96", cursor: "pointer", fontSize: "22px", lineHeight: 1 }}>&times;</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
              {clientDetailLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ height: "60px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />)}
                </div>
              ) : clientDetail ? (
                <>
                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "20px" }}>
                    {[
                      { label: "Visits", value: String(clientDetail.stats.totalVisits || 0), color: "#fff" },
                      { label: "Total Spend", value: `$${(clientDetail.stats.totalSpend || 0).toFixed(0)}`, color: "#22c55e" },
                      { label: "Avg Ticket", value: `$${(clientDetail.stats.avgTicket || 0).toFixed(0)}`, color: "#C9A84C" },
                    ].map(s => (
                      <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'Fira Code', monospace", fontSize: "18px", fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "#606E74", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: "3px" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Contact */}
                  <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px", marginBottom: "20px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "10px" }}>Contact</div>
                    {clientDetail.client.phone && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#7a8f96" }}>phone</span>
                        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "13px", color: "#fff" }}>{clientDetail.client.phone}</span>
                      </div>
                    )}
                    {clientDetail.client.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#7a8f96" }}>mail</span>
                        <span style={{ fontSize: "13px", color: "#fff" }}>{clientDetail.client.email}</span>
                      </div>
                    )}
                    {!clientDetail.client.phone && !clientDetail.client.email && (
                      <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.3)" }}>No contact info</div>
                    )}
                  </div>

                  {/* Last visit */}
                  {clientDetail.stats.lastVisit && (
                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "6px" }}>Last Visit</div>
                      <div style={{ fontSize: "13px", color: "#fff" }}>{new Date(clientDetail.stats.lastVisit).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}</div>
                    </div>
                  )}

                  {/* Formula Book */}
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Formula Book ({formulaList.length})</div>
                      <button onClick={() => setShowFormulaForm(!showFormulaForm)} style={{ fontSize: "11px", color: "#7a8f96", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" }}>
                        {showFormulaForm ? "Cancel" : "+ Add"}
                      </button>
                    </div>

                    {showFormulaForm && (
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px", marginBottom: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          {[
                            { key: "baseColor", label: "Base Color", type: "input" },
                            { key: "colorBrand", label: "Brand", type: "select", options: ["Redken", "Wella", "Kenra", "Pravana", "Olaplex", "Matrix", "Other"] },
                            { key: "developer", label: "Developer", type: "select", options: ["10", "20", "30", "40"] },
                            { key: "toner", label: "Toner", type: "input" },
                            { key: "technique", label: "Technique", type: "select", options: ["Full Highlight", "Partial Highlight", "Balayage", "Ombre", "Single Process", "Toner Only", "Other"] },
                            { key: "processingTime", label: "Process Time", type: "input" },
                          ].map(field => (
                            <div key={field.key}>
                              <label style={{ fontSize: "9px", fontWeight: 600, color: "#606E74", textTransform: "uppercase" as const, display: "block", marginBottom: "3px" }}>{field.label}</label>
                              {field.type === "select" ? (
                                <select value={formulaForm[field.key as keyof typeof formulaForm]} onChange={e => setFormulaForm(f => ({ ...f, [field.key]: e.target.value }))} style={{ width: "100%", padding: "7px 8px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#fff", fontSize: "12px", outline: "none", boxSizing: "border-box" as const }}>
                                  <option value="">...</option>
                                  {field.options?.map(o => <option key={o} value={o}>{o}{field.key === "developer" ? "%" : ""}</option>)}
                                </select>
                              ) : (
                                <input value={formulaForm[field.key as keyof typeof formulaForm]} onChange={e => setFormulaForm(f => ({ ...f, [field.key]: e.target.value }))} style={{ width: "100%", padding: "7px 8px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#fff", fontSize: "12px", outline: "none", boxSizing: "border-box" as const }} />
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: "8px" }}>
                          <label style={{ fontSize: "9px", fontWeight: 600, color: "#606E74", textTransform: "uppercase" as const, display: "block", marginBottom: "3px" }}>Notes</label>
                          <textarea value={formulaForm.notes} onChange={e => setFormulaForm(f => ({ ...f, notes: e.target.value }))} style={{ width: "100%", padding: "7px 8px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#fff", fontSize: "12px", outline: "none", minHeight: "50px", resize: "vertical" as const, boxSizing: "border-box" as const }} />
                        </div>
                        <button onClick={saveFormula} disabled={formulaSaving} style={{ width: "100%", marginTop: "10px", padding: "10px", background: "rgba(122,143,150,0.15)", border: "1px solid #7a8f96", borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", opacity: formulaSaving ? 0.5 : 1 }}>
                          {formulaSaving ? "Saving..." : "Save Formula"}
                        </button>
                      </div>
                    )}

                    {formulaList.length === 0 && !showFormulaForm ? (
                      <div style={{ padding: "16px 0", textAlign: "center", color: "#606E74", fontSize: "12px" }}>No formulas saved yet</div>
                    ) : formulaList.map((f, fi) => (
                      <div key={f.id} style={{ background: fi === 0 ? "rgba(201,168,76,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${fi === 0 ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.06)"}`, borderRadius: "8px", padding: "12px", marginBottom: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "11px", color: fi === 0 ? "#C9A84C" : "#7a8f96", fontWeight: 600 }}>{fi === 0 ? "Latest" : new Date(f.createdAt).toLocaleDateString()}</span>
                          {f.technique && <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", backgroundColor: "rgba(122,143,150,0.1)", color: "#7a8f96" }}>{f.technique}</span>}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                          {[
                            { label: "Base", value: f.baseColor },
                            { label: "Brand", value: f.colorBrand },
                            { label: "Dev", value: f.developer ? `${f.developer}%` : null },
                            { label: "Toner", value: f.toner },
                          ].filter(r => r.value).map(r => (
                            <div key={r.label}>
                              <div style={{ fontSize: "9px", color: "#606E74", textTransform: "uppercase" as const }}>{r.label}</div>
                              <div style={{ fontSize: "12px", color: "#fff", fontFamily: "'Fira Code', monospace" }}>{r.value}</div>
                            </div>
                          ))}
                        </div>
                        {f.notes && <div style={{ marginTop: "6px", fontSize: "11px", color: "#7a8f96", fontStyle: "italic" }}>{f.notes}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Visit History */}
                  {clientDetail.visits && clientDetail.visits.length > 0 && (
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#606E74", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "10px" }}>Visit History ({clientDetail.visits.length})</div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {clientDetail.visits.map((v: any) => (
                        <div key={v.orderId} style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", marginBottom: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                              {new Date(v.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px", backgroundColor: v.location === "CC" ? "rgba(99,102,241,0.1)" : "rgba(16,185,129,0.1)", color: v.location === "CC" ? "#818CF8" : "#10B981" }}>{v.location}</span>
                              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "13px", fontWeight: 700, color: "#22c55e" }}>${v.total.toFixed(2)}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: "11px", color: "#606E74" }}>
                            {v.services.map((s: { name: string }) => s.name).join(", ")}
                          </div>
                          {v.tips > 0 && <div style={{ fontSize: "10px", color: "#7a8f96", marginTop: "2px", fontFamily: "'Fira Code', monospace" }}>Tip: ${v.tips.toFixed(2)}</div>}
                          {v.tenders?.[0] && (
                            <div style={{ marginTop: "3px" }}>
                              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "10px", color: v.tenders[0].type === "CASH" ? "#22c55e" : "#60a5fa" }}>
                                {v.tenders[0].type === "CASH" ? "CASH" : `${(v.tenders[0].brand || "CARD").replace(/_/g, " ")} ····${v.tenders[0].last4 || "****"}`}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#606E74", fontSize: "13px" }}>
                  {/* Contact-only fallback when detail fails to load */}
                  <div style={{ marginBottom: "12px" }}>
                    {selectedClient.phone && <div style={{ fontSize: "13px", color: "#7a8f96" }}>{selectedClient.phone}</div>}
                    {selectedClient.email && <div style={{ fontSize: "13px", color: "#7a8f96" }}>{selectedClient.email}</div>}
                  </div>
                  <div>Unable to load full profile</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════ CLIENT HISTORY SLIDE-OVER ══════════ */}
      {historyClientId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={() => setHistoryClientId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
          <div style={{
            position: "relative", width: isMobile ? "100%" : "420px", maxWidth: "100%",
            background: "#0d1117", borderLeft: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Close button */}
            <button onClick={() => setHistoryClientId(null)} style={{
              position: "absolute", top: "16px", right: "16px", zIndex: 2,
              background: "none", border: "none", color: "rgba(205,201,192,0.5)", cursor: "pointer", fontSize: "22px",
            }}>&times;</button>

            {historyLoading ? (
              <div style={{ padding: "60px 20px", textAlign: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "rgba(205,201,192,0.3)", display: "block", marginBottom: "8px" }}>hourglass_empty</span>
                <div style={{ color: "rgba(205,201,192,0.4)", fontSize: "13px" }}>Loading client history...</div>
              </div>
            ) : !historyData ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "rgba(205,201,192,0.4)", fontSize: "13px" }}>Failed to load client data</div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>{historyData.customer.name}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "10px" }}>
                    {historyData.customer.phone && (
                      <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.55)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>phone</span>
                        {historyData.customer.phone}
                      </div>
                    )}
                    {historyData.customer.email && (
                      <div style={{ fontSize: "12px", color: "rgba(205,201,192,0.55)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>mail</span>
                        {historyData.customer.email}
                      </div>
                    )}
                    {historyData.customer.createdAt && (
                      <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.35)", marginTop: "2px" }}>
                        Customer since {new Date(historyData.customer.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Chicago" })}
                      </div>
                    )}
                  </div>
                  {/* Stat pills */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ padding: "5px 12px", borderRadius: "20px", backgroundColor: "rgba(79,142,247,0.12)", color: "#4F8EF7", fontSize: "11px", fontWeight: 700 }}>
                      {historyData.stats.totalVisits} visits
                    </span>
                    <span style={{ padding: "5px 12px", borderRadius: "20px", backgroundColor: "rgba(16,185,129,0.12)", color: "#10B981", fontSize: "11px", fontWeight: 700, fontFamily: "'Fira Code', monospace" }}>
                      Total {fmtCurrency(historyData.stats.totalSpend)}
                    </span>
                    <span style={{ padding: "5px 12px", borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(205,201,192,0.7)", fontSize: "11px", fontWeight: 700, fontFamily: "'Fira Code', monospace" }}>
                      Avg {fmtCurrency(historyData.stats.avgTicket)}
                    </span>
                  </div>
                </div>

                {/* Visit history */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(205,201,192,0.4)", marginBottom: "10px" }}>
                    Visit History
                  </div>
                  {historyData.visits.length === 0 ? (
                    <div style={{ padding: "30px 0", textAlign: "center", color: "rgba(205,201,192,0.3)", fontSize: "13px" }}>No visit history</div>
                  ) : (
                    <>
                      {historyData.visits.slice(0, historyLimit).map((v: { date: string; stylist: string; services: string[]; amount: number; tips: number; status: string }, i: number) => (
                        <div key={i} style={{
                          padding: "12px 14px", marginBottom: "6px",
                          backgroundColor: "rgba(205,201,192,0.03)", border: "1px solid rgba(205,201,192,0.06)",
                          borderRadius: "8px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(205,201,192,0.7)" }}>
                              {new Date(v.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}
                            </span>
                            <span style={{
                              fontSize: "8px", fontWeight: 700, padding: "2px 6px", borderRadius: "3px",
                              backgroundColor: (STATUS_COLORS[v.status] || DEFAULT_STATUS).bg,
                              color: (STATUS_COLORS[v.status] || DEFAULT_STATUS).text,
                              textTransform: "uppercase", letterSpacing: "0.06em",
                            }}>
                              {(STATUS_COLORS[v.status] || DEFAULT_STATUS).label}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "rgba(205,201,192,0.5)", marginBottom: "4px" }}>
                            {v.stylist}
                          </div>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                            {v.services.map((s: string, j: number) => (
                              <span key={j} style={{
                                fontSize: "9px", fontWeight: 600, padding: "2px 6px",
                                borderRadius: "3px", backgroundColor: "rgba(205,201,192,0.06)",
                                color: "rgba(205,201,192,0.5)",
                              }}>{s}</span>
                            ))}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                            <span style={{ color: "#CDC9C0", fontWeight: 700, fontFamily: "'Fira Code', monospace" }}>{fmtCurrency(v.amount)}</span>
                            {v.tips > 0 && <span style={{ color: "#10B981", fontFamily: "'Fira Code', monospace" }}>+{fmtCurrency(v.tips)} tip</span>}
                          </div>
                        </div>
                      ))}
                      {historyData.visits.length > historyLimit && (
                        <button onClick={() => setHistoryLimit(l => l + 20)} style={{
                          width: "100%", padding: "10px", marginTop: "8px",
                          backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: "8px", color: "rgba(205,201,192,0.6)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        }}>
                          Load more ({historyData.visits.length - historyLimit} remaining)
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Appointment detail bottom sheet */}
      {selectedAppt && (
        <>
          <div onClick={() => setSelectedAppt(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 199 }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
            background: "#0d1117", borderTop: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}>
            {/* Handle */}
            <div style={{ width: "40px", height: "4px", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "12px auto" }} />
            <div style={{ padding: "0 20px 16px" }}>
              {/* Client + status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>{selectedAppt.customerName}</div>
                <span style={{ fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", backgroundColor: (STATUS_COLORS[selectedAppt.resolvedStatus || selectedAppt.status] || DEFAULT_STATUS).bg, color: (STATUS_COLORS[selectedAppt.resolvedStatus || selectedAppt.status] || DEFAULT_STATUS).text, textTransform: "uppercase", letterSpacing: "0.06em" }}>{(STATUS_COLORS[selectedAppt.resolvedStatus || selectedAppt.status] || DEFAULT_STATUS).label}</span>
              </div>
              {/* Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#7a8f96" }}>schedule</span>
                  <span style={{ fontSize: "14px", color: "#7a8f96", fontFamily: "'Fira Code', monospace" }}>{fmtTime(selectedAppt.startTime)}{selectedAppt.endTime ? ` – ${fmtTime(selectedAppt.endTime)}` : ""}</span>
                </div>
                {selectedAppt.teamMemberId && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#7a8f96" }}>person</span>
                    <span style={{ fontSize: "14px", color: "#ffffff" }}>{TEAM_NAMES[selectedAppt.teamMemberId] || ""}</span>
                  </div>
                )}
                {selectedAppt.totalDurationMinutes && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#606E74" }}>timer</span>
                    <span style={{ fontSize: "13px", color: "#606E74", fontFamily: "'Fira Code', monospace" }}>{selectedAppt.totalDurationMinutes} min</span>
                  </div>
                )}
              </div>
              {/* Services */}
              {selectedAppt.services && selectedAppt.services.length > 0 && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#606E74", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Services</div>
                  {selectedAppt.services.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", marginBottom: "8px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}>
                      <span style={{ fontSize: "14px", color: "#ffffff" }}>{s.serviceName}</span>
                      <span style={{ fontSize: "14px", color: "#7a8f96", fontFamily: "'Fira Code', monospace" }}>{fmtCurrency(s.price)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Total */}
              {(selectedAppt.totalPrice ?? 0) > 0 && (
                <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#606E74", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total</span>
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", fontFamily: "'Fira Code', monospace" }}>{fmtCurrency(selectedAppt.totalPrice || 0)}</span>
                </div>
              )}
            </div>
            {/* Action buttons */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0d1117" }}>
              {!selectedAppt.isCheckedOut && (
                <Link href={`/pos?appointmentId=${selectedAppt.id}&location=${encodeURIComponent(location)}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "52px",
                  backgroundColor: "#7a8f96", color: "#06080d", fontWeight: 700, fontSize: "15px", borderRadius: "12px",
                  textDecoration: "none", cursor: "pointer",
                }}>Checkout in POS</Link>
              )}
              {selectedAppt.isCheckedOut && selectedAppt.checkoutDetails && (
                <div style={{ textAlign: "center", padding: "12px", color: "#22c55e", fontSize: "14px", fontWeight: 600 }}>
                  Checked out — {fmtCurrency(selectedAppt.checkoutDetails.total)}
                </div>
              )}
              <button onClick={() => setSelectedAppt(null)} style={{
                width: "100%", height: "44px", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "#7a8f96", borderRadius: "12px", marginTop: "8px", cursor: "pointer", fontSize: "14px",
              }}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* Cancel confirmation modal */}
      {cancelConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} onClick={() => setCancelConfirm(null)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(420px, calc(100vw - 32px))", background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.8)", zIndex: 401 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, color: "#ffffff", fontWeight: 700, marginBottom: 8 }}>Cancel Appointment</div>
              <div style={{ fontSize: 14, color: "#7a8f96" }}>Are you sure you want to cancel {cancelConfirm.clientName}&apos;s appointment?</div>
              <div style={{ fontSize: 12, color: "#606E74", fontFamily: "'Fira Code', monospace", marginTop: 6 }}>{cancelConfirm.time}</div>
            </div>
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#ef4444" }}>
              This will cancel the appointment in Square and notify the client via SMS.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCancelConfirm(null)} style={{ flex: 1, height: 44, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#7a8f96", fontSize: 14, cursor: "pointer" }}>Keep</button>
              <button onClick={() => handleCancelAppointment(cancelConfirm.id)} disabled={cancellingId === cancelConfirm.id} style={{ flex: 1, height: 44, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, color: "#ef4444", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: cancellingId === cancelConfirm.id ? 0.5 : 1 }}>
                {cancellingId === cancelConfirm.id ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
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
