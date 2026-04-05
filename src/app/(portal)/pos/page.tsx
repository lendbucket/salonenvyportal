"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useUserRole } from "@/hooks/useUserRole"

/* ── Team member name map (hardcoded) ── */
const TEAM_NAMES: Record<string, string> = {
  TMbc13IBzS8Z43AO: "Clarissa",
  TMMJKxeQuMlMW1Dw: "Melissa",
  TMKwAEkzf3NN3Hiu: "Yahaira",
  TMxKBPJq29Wfrl2N: "Jasmine",
  TMr3JMjH29LqXLJp: "Briana",
  TM3eYXBb4hFwcPwA: "Priscilla",
  TMPFXkqFP7vJXRMa: "Christina",
  TM0JKR4Zq4jMNcbE: "Nayelie",
}

interface AppointmentService {
  serviceName: string
  price: number
  durationMinutes: number
  serviceVariationId?: string
}

interface Appointment {
  id: string
  customerId?: string
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
}

interface ServiceVariation {
  id: string
  name: string
  price: number
}

interface CatalogService {
  id: string
  name: string
  variations: ServiceVariation[]
}

interface CartItem {
  variationId: string
  serviceName: string
  variationName: string
  price: number
  qty: number
}

const LOCATIONS = ["Corpus Christi", "San Antonio"]
const TAX_RATE = 0.0825

export default function POSPage() {
  const { isOwner, isStylist, locationName } = useUserRole()

  const [isMobile, setIsMobile] = useState(false)
  const [mobileTab, setMobileTab] = useState<"appointments" | "checkout">("appointments")

  const [location, setLocation] = useState(locationName || "Corpus Christi")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [loadingAppts, setLoadingAppts] = useState(true)
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [tipPercent, setTipPercent] = useState<number | null>(20)
  const [customTip, setCustomTip] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [squareCard, setSquareCard] = useState<unknown>(null)
  const [squareReady, setSquareReady] = useState(false)
  const [squareInitError, setSquareInitError] = useState<string | null>(null)
  const squareInitialized = useRef(false)
  const [charging, setCharging] = useState(false)
  const [chargeError, setChargeError] = useState<string | null>(null)

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card")
  const [cashReceived, setCashReceived] = useState("")

  // Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Load Square Web Payments SDK script (once)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (document.querySelector('script[src*="squarecdn"]')) return
    const script = document.createElement("script")
    script.src = "https://web.squarecdn.com/v1/square.js"
    script.async = true
    document.head.appendChild(script)
  }, [])

  // Initialize Square card form when paymentMethod is "card"
  useEffect(() => {
    if (paymentMethod !== "card") return
    if (squareInitialized.current) return

    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID
    if (!appId || appId.includes("placeholder")) {
      setSquareInitError("Square App ID not configured")
      return
    }

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout>

    const tryInit = async (attempt: number) => {
      if (cancelled || squareInitialized.current) return

      const container = document.getElementById("sq-card-container")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sq = (window as any).Square as { payments: (appId: string, locId: string) => Promise<unknown> } | undefined

      if (!container || !sq) {
        if (attempt < 20) {
          retryTimer = setTimeout(() => tryInit(attempt + 1), 300)
        } else {
          setSquareInitError("Square SDK failed to load. Please refresh.")
        }
        return
      }

      try {
        const locId = location === "San Antonio" ? "LXJYXDXWR0XZF" : "LTJSA6QR1HGW6"
        const payments = await sq.payments(appId, locId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const card = await (payments as any).card({
          style: {
            ".input-container": { borderColor: "rgba(205,201,192,0.2)", borderRadius: "6px" },
            ".input-container.is-focus": { borderColor: "#CDC9C0" },
            input: { backgroundColor: "rgba(15,29,36,1)", color: "#FFFFFF", fontFamily: "inherit" },
            "input::placeholder": { color: "rgba(205,201,192,0.35)" },
            ".message-text": { color: "rgba(205,201,192,0.5)" },
            ".message-icon": { color: "rgba(205,201,192,0.5)" },
            ".message-text.is-error": { color: "#fca5a5" },
            ".message-icon.is-error": { color: "#fca5a5" },
          },
        })
        if (cancelled) return
        await card.attach("#sq-card-container")
        if (cancelled) return
        squareInitialized.current = true
        setSquareCard(card)
        setSquareReady(true)
        setSquareInitError(null)
      } catch (e) {
        console.warn("Square SDK init failed:", e)
        if (!cancelled) setSquareInitError("Card form failed to load. Please refresh.")
      }
    }

    tryInit(0)
    return () => { cancelled = true; clearTimeout(retryTimer) }
  }, [paymentMethod, location])

  // Reset Square state on location change
  useEffect(() => {
    squareInitialized.current = false
    setSquareCard(null)
    setSquareReady(false)
    setSquareInitError(null)
  }, [location])

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    setLoadingAppts(true)
    try {
      const params = new URLSearchParams()
      if (isOwner && location) params.set("location", location)
      const res = await fetch(`/api/pos/appointments?${params}`)
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch {
      setAppointments([])
    } finally {
      setLoadingAppts(false)
    }
  }, [isOwner, location])

  // Fetch catalog
  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    try {
      const res = await fetch("/api/pos/catalog")
      const data = await res.json()
      setCatalog(data.services || [])
    } catch {
      setCatalog([])
    } finally {
      setLoadingCatalog(false)
    }
  }, [])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])
  useEffect(() => { fetchCatalog() }, [fetchCatalog])

  // Auto-populate cart when appointment is selected with services
  const selectAppointment = useCallback((appt: Appointment) => {
    setSelectedAppt(appt)
    // Auto-populate cart if appointment has services with prices
    if (appt.services && appt.services.length > 0) {
      const hasServicePrices = appt.services.some(s => s.price > 0)
      if (hasServicePrices) {
        const newCart: CartItem[] = appt.services
          .filter(s => s.price > 0)
          .map(s => ({
            variationId: s.serviceVariationId || `appt-svc-${Math.random().toString(36).slice(2)}`,
            serviceName: s.serviceName,
            variationName: "Regular",
            price: s.price,
            qty: 1,
          }))
        setCart(newCart)
      }
    }
    if (isMobile) setMobileTab("checkout")
  }, [isMobile])

  // Cart helpers
  const addToCart = (service: CatalogService, variation: ServiceVariation) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.variationId === variation.id)
      if (existing) {
        return prev.map((c) =>
          c.variationId === variation.id ? { ...c, qty: c.qty + 1 } : c
        )
      }
      return [
        ...prev,
        {
          variationId: variation.id,
          serviceName: service.name,
          variationName: variation.name,
          price: variation.price,
          qty: 1,
        },
      ]
    })
  }

  const updateQty = (variationId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.variationId === variationId ? { ...c, qty: c.qty + delta } : c
        )
        .filter((c) => c.qty > 0)
    )
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const taxAmount = subtotal * TAX_RATE
  const tipAmount =
    tipPercent !== null ? subtotal * (tipPercent / 100) : Number(customTip) || 0
  const total = subtotal + taxAmount + tipAmount

  // Cash change calculation
  const cashReceivedNum = Number(cashReceived) || 0
  const changeDue = cashReceivedNum > total ? cashReceivedNum - total : 0

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog
    const q = searchQuery.toLowerCase()
    return catalog.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.variations.some((v) => v.name.toLowerCase().includes(q))
    )
  }, [catalog, searchQuery])

  const handleCharge = async () => {
    if (cart.length === 0) return
    setCharging(true)
    setChargeError(null)

    const isCash = paymentMethod === "cash"
    let sourceId = "CASH"

    if (!isCash) {
      if (!squareCard || !squareReady) {
        setChargeError("Card form not ready. Please wait or refresh.")
        setCharging(false)
        return
      }
      try {
        const result = await (squareCard as { tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }> }).tokenize()
        if (result.status === "OK" && result.token) {
          sourceId = result.token
        } else {
          setChargeError(result.errors?.[0]?.message || "Card tokenization failed. Please try again.")
          setCharging(false)
          return
        }
      } catch {
        setChargeError("Card processing error. Please try again.")
        setCharging(false)
        return
      }
    }

    try {
      const locId = location === "San Antonio" ? "LXJYXDXWR0XZF" : "LTJSA6QR1HGW6"
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: locId,
          customerId: selectedAppt?.customerId || undefined,
          lineItems: cart.map(item => ({
            name: `${item.serviceName}${item.variationName && item.variationName !== "Regular" ? ` (${item.variationName})` : ""}`,
            price: item.price,
            catalogObjectId: item.variationId,
          })),
          tipAmount,
          taxAmount,
          sourceId,
          bookingId: selectedAppt?.id,
          note: `Checkout for ${selectedAppt?.customerName || "Walk-in"}`,
          paymentMethod: isCash ? "cash" : "card",
          cashReceived: isCash ? cashReceivedNum : undefined,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setChargeError(data.error)
      } else {
        setShowSuccess(true)
      }
    } catch {
      setChargeError("Payment failed. Please try again.")
    }
    setCharging(false)
  }

  const resetCheckout = () => {
    setCart([])
    setSelectedAppt(null)
    setTipPercent(20)
    setCustomTip("")
    setShowSuccess(false)
    setSearchQuery("")
    setPaymentMethod("card")
    setCashReceived("")
    if (isMobile) setMobileTab("appointments")
  }

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n)

  /* ── Shared UI blocks ── */

  function AppointmentCard({ appt }: { appt: Appointment }) {
    const isSelected = selectedAppt?.id === appt.id
    return (
      <button
        onClick={() => selectAppointment(appt)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          backgroundColor: isSelected ? "rgba(205,201,192,0.1)" : "#1a2a32",
          border: isSelected
            ? "1px solid rgba(205,201,192,0.3)"
            : "1px solid rgba(205,201,192,0.08)",
          borderRadius: "10px",
          cursor: "pointer",
          transition: "all 0.15s",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700 }}
          >
            {appt.customerName}
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: "4px",
              backgroundColor:
                appt.status === "ACCEPTED"
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(205,201,192,0.08)",
              color:
                appt.status === "ACCEPTED" ? "#10B981" : "rgba(205,201,192,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {appt.status}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "12px",
            fontSize: "11px",
            color: "rgba(205,201,192,0.55)",
            fontWeight: 500,
          }}
        >
          <span>{fmtTime(appt.startTime)}{appt.endTime ? ` - ${fmtTime(appt.endTime)}` : ""}</span>
          {appt.teamMemberId && (
            <span>
              {TEAM_NAMES[appt.teamMemberId] || appt.teamMemberId.slice(0, 6)}
            </span>
          )}
        </div>
        {appt.services && appt.services.length > 0 && (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
            {appt.services.map((s, i) => (
              <span key={i} style={{
                fontSize: "9px",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "3px",
                backgroundColor: "rgba(205,201,192,0.06)",
                color: "rgba(205,201,192,0.5)",
              }}>
                {s.serviceName}
              </span>
            ))}
          </div>
        )}
        {appt.totalPrice != null && appt.totalPrice > 0 && (
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#CDC9C0" }}>
            {fmtCurrency(appt.totalPrice)}
          </div>
        )}
      </button>
    )
  }

  function CatalogGrid() {
    return (
      <div>
        {/* Search */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              backgroundColor: "rgba(205,201,192,0.04)",
              border: "1px solid rgba(205,201,192,0.1)",
              borderRadius: "8px",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "18px", color: "rgba(205,201,192,0.35)" }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                color: "#FFFFFF",
                fontSize: "13px",
              }}
            />
          </div>
        </div>
        {loadingCatalog ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "rgba(205,201,192,0.35)",
              fontSize: "12px",
            }}
          >
            Loading catalog...
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "rgba(205,201,192,0.35)",
              fontSize: "12px",
            }}
          >
            No services found
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "10px",
            }}
          >
            {filteredCatalog.map((service) =>
              service.variations.map((v) => (
                <button
                  key={v.id}
                  onClick={() => addToCart(service, v)}
                  style={{
                    padding: "14px 12px",
                    backgroundColor: "#1a2a32",
                    border: "1px solid rgba(205,201,192,0.08)",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 600,
                      lineHeight: 1.3,
                    }}
                  >
                    {service.name}
                  </span>
                  {service.variations.length > 1 && (
                    <span
                      style={{
                        color: "rgba(205,201,192,0.45)",
                        fontSize: "10px",
                        fontWeight: 500,
                      }}
                    >
                      {v.name}
                    </span>
                  )}
                  <span
                    style={{
                      color: "#CDC9C0",
                      fontSize: "14px",
                      fontWeight: 800,
                    }}
                  >
                    {fmtCurrency(v.price)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  function CartPanel() {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Selected appointment info */}
        {selectedAppt && (
          <div
            style={{
              padding: "14px 16px",
              backgroundColor: "rgba(205,201,192,0.04)",
              border: "1px solid rgba(205,201,192,0.08)",
              borderRadius: "10px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "rgba(205,201,192,0.4)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Client
            </div>
            <div style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 700 }}>
              {selectedAppt.customerName}
            </div>
            <div
              style={{
                color: "rgba(205,201,192,0.5)",
                fontSize: "11px",
                marginTop: "2px",
              }}
            >
              {fmtTime(selectedAppt.startTime)}
              {selectedAppt.teamMemberId &&
                ` \u00b7 ${TEAM_NAMES[selectedAppt.teamMemberId] || "Stylist"}`}
            </div>
          </div>
        )}

        {/* Cart items */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "14px",
          }}
        >
          {cart.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "30px 0",
                color: "rgba(205,201,192,0.3)",
                fontSize: "12px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}
              >
                shopping_cart
              </span>
              Add services to cart
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.variationId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  backgroundColor: "#1a2a32",
                  border: "1px solid rgba(205,201,192,0.08)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.serviceName}
                  </div>
                  <div
                    style={{
                      color: "rgba(205,201,192,0.45)",
                      fontSize: "10px",
                    }}
                  >
                    {item.variationName} &middot; {fmtCurrency(item.price)}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <button
                    onClick={() => updateQty(item.variationId, -1)}
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(205,201,192,0.08)",
                      border: "1px solid rgba(205,201,192,0.15)",
                      color: "#CDC9C0",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    -
                  </button>
                  <span
                    style={{
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 700,
                      minWidth: "18px",
                      textAlign: "center",
                    }}
                  >
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateQty(item.variationId, 1)}
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(205,201,192,0.08)",
                      border: "1px solid rgba(205,201,192,0.15)",
                      color: "#CDC9C0",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    +
                  </button>
                </div>
                <span
                  style={{
                    color: "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: 700,
                    minWidth: "60px",
                    textAlign: "right",
                  }}
                >
                  {fmtCurrency(item.price * item.qty)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Tip selector */}
        {cart.length > 0 && (
          <>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "rgba(205,201,192,0.4)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Tip
            </div>
            <div
              style={{
                display: "flex",
                gap: "6px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              {[0, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    setTipPercent(pct)
                    setCustomTip("")
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "7px",
                    border:
                      tipPercent === pct
                        ? "1px solid #CDC9C0"
                        : "1px solid rgba(205,201,192,0.15)",
                    backgroundColor:
                      tipPercent === pct ? "rgba(205,201,192,0.12)" : "transparent",
                    color: tipPercent === pct ? "#CDC9C0" : "rgba(205,201,192,0.5)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {pct}%
                </button>
              ))}
              <input
                type="text"
                placeholder="Custom $"
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value)
                  setTipPercent(null)
                }}
                style={{
                  width: "80px",
                  padding: "8px 10px",
                  borderRadius: "7px",
                  border: "1px solid rgba(205,201,192,0.15)",
                  backgroundColor: "transparent",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            </div>
          </>
        )}

        {/* Totals */}
        {cart.length > 0 && (
          <div
            style={{
              borderTop: "1px solid rgba(205,201,192,0.1)",
              paddingTop: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "rgba(205,201,192,0.55)",
              }}
            >
              <span>Subtotal</span>
              <span>{fmtCurrency(subtotal)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "rgba(205,201,192,0.55)",
              }}
            >
              <span>Tax (8.25%)</span>
              <span>{fmtCurrency(taxAmount)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "rgba(205,201,192,0.55)",
              }}
            >
              <span>Tip</span>
              <span>{fmtCurrency(tipAmount)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "18px",
                fontWeight: 800,
                color: "#FFFFFF",
                paddingTop: "6px",
                borderTop: "1px solid rgba(205,201,192,0.1)",
              }}
            >
              <span>Total</span>
              <span>{fmtCurrency(total)}</span>
            </div>

            {/* Payment method toggle */}
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
                Payment Method
              </div>
              <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
                {(["card", "cash"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      borderRadius: "7px",
                      border: paymentMethod === method ? "1px solid #CDC9C0" : "1px solid rgba(205,201,192,0.15)",
                      cursor: "pointer",
                      backgroundColor: paymentMethod === method ? "rgba(205,201,192,0.12)" : "transparent",
                      color: paymentMethod === method ? "#CDC9C0" : "rgba(205,201,192,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      {method === "card" ? "credit_card" : "payments"}
                    </span>
                    {method === "card" ? "Card" : "Cash"}
                  </button>
                ))}
              </div>
            </div>

            {/* Card payment form */}
            {paymentMethod === "card" && (
              <div>
                <div id="sq-card-container" style={{ minHeight: "89px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)", overflow: "hidden", display: squareReady ? "block" : "none" }} />
                {!squareReady && !squareInitError && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "11px", color: "rgba(205,201,192,0.4)", textAlign: "center", padding: "20px 12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                    <div style={{ width: "16px", height: "16px", border: "2px solid rgba(205,201,192,0.2)", borderTopColor: "#CDC9C0", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Loading card form...
                  </div>
                )}
                {squareInitError && (
                  <div style={{ fontSize: "11px", color: "#fca5a5", textAlign: "center", padding: "12px", backgroundColor: "rgba(239,68,68,0.06)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.15)" }}>
                    {squareInitError}
                  </div>
                )}
              </div>
            )}

            {/* Cash payment form */}
            {paymentMethod === "cash" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(205,201,192,0.55)", whiteSpace: "nowrap" }}>Cash Received:</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "7px",
                      border: "1px solid rgba(205,201,192,0.15)",
                      backgroundColor: "rgba(255,255,255,0.03)",
                      color: "#FFFFFF",
                      fontSize: "16px",
                      fontWeight: 700,
                      outline: "none",
                      textAlign: "right",
                    }}
                  />
                </div>
                {cashReceivedNum > 0 && (
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    backgroundColor: changeDue > 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                    border: `1px solid ${changeDue > 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: changeDue > 0 ? "#10B981" : cashReceivedNum >= total ? "#10B981" : "#fca5a5",
                  }}>
                    <span>Change Due</span>
                    <span>{fmtCurrency(changeDue)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Charge error */}
            {chargeError && (
              <div style={{ marginTop: "8px", padding: "10px 12px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "12px", color: "#fca5a5" }}>
                {chargeError}
              </div>
            )}

            {/* Charge button */}
            <button
              onClick={handleCharge}
              disabled={charging || cart.length === 0 || (paymentMethod === "cash" && cashReceivedNum < total)}
              style={{
                marginTop: "10px",
                padding: "16px",
                backgroundColor: (charging || (paymentMethod === "cash" && cashReceivedNum < total)) ? "rgba(205,201,192,0.5)" : "#CDC9C0",
                border: "none",
                borderRadius: "10px",
                color: "#0f1d24",
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: (charging || (paymentMethod === "cash" && cashReceivedNum < total)) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                opacity: (charging || (paymentMethod === "cash" && cashReceivedNum < total)) ? 0.7 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                {charging ? "sync" : paymentMethod === "cash" ? "payments" : "credit_card"}
              </span>
              {charging ? "Processing..." : `${paymentMethod === "cash" ? "Complete Cash" : "Charge"} ${fmtCurrency(total)}`}
            </button>
          </div>
        )}
      </div>
    )
  }

  function SuccessOverlay() {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15,29,36,0.95)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200,
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            backgroundColor: "rgba(16,185,129,0.12)",
            border: "2px solid #10B981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "40px", color: "#10B981" }}
          >
            check_circle
          </span>
        </div>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: "24px",
            fontWeight: 800,
          }}
        >
          Payment Successful
        </div>
        <div style={{ color: "rgba(205,201,192,0.5)", fontSize: "14px" }}>
          {fmtCurrency(total)} charged
          {selectedAppt ? ` for ${selectedAppt.customerName}` : ""}
        </div>
        <button
          onClick={resetCheckout}
          style={{
            marginTop: "20px",
            padding: "14px 32px",
            backgroundColor: "#CDC9C0",
            border: "none",
            borderRadius: "10px",
            color: "#0f1d24",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          New Transaction
        </button>
      </div>
    )
  }

  /* ═════════════════════════════════════
     SUCCESS OVERLAY
     ═════════════════════════════════════ */
  if (showSuccess) {
    return <SuccessOverlay />
  }

  /* ═════════════════════════════════════
     MOBILE LAYOUT
     ═════════════════════════════════════ */
  if (isMobile) {
    return (
      <div style={{ padding: "16px", minHeight: "calc(100vh - 130px)" }}>
        {/* Header */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#FFFFFF",
                margin: 0,
              }}
            >
              POS Terminal
            </h1>
            {isOwner && (
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  padding: "6px 10px",
                  backgroundColor: "#1a2a32",
                  border: "1px solid rgba(205,201,192,0.15)",
                  borderRadius: "6px",
                  color: "#CDC9C0",
                  fontSize: "11px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "rgba(205,201,192,0.4)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {dateStr}
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: "2px",
            backgroundColor: "#1a2a32",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid rgba(205,201,192,0.08)",
            marginBottom: "16px",
          }}
        >
          {(["appointments", "checkout"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              style={{
                flex: 1,
                padding: "10px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  mobileTab === tab ? "#CDC9C0" : "transparent",
                color:
                  mobileTab === tab ? "#0f1d24" : "rgba(205,201,192,0.45)",
                transition: "all 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {mobileTab === "appointments" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {loadingAppts ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "rgba(205,201,192,0.35)",
                  fontSize: "12px",
                }}
              >
                Loading appointments...
              </div>
            ) : appointments.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "rgba(205,201,192,0.35)",
                  fontSize: "12px",
                }}
              >
                No appointments today
              </div>
            ) : (
              appointments.map((appt) => (
                <AppointmentCard key={appt.id} appt={appt} />
              ))
            )}
          </div>
        ) : (
          <div>
            <CartPanel />
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "rgba(205,201,192,0.4)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Add Services
              </div>
              <CatalogGrid />
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ═════════════════════════════════════
     DESKTOP LAYOUT — 3 columns
     ═════════════════════════════════════ */
  return (
    <div style={{ height: "calc(100vh - 52px)", display: "flex", flexDirection: "column" }}>
      {/* Header bar */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid rgba(205,201,192,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#FFFFFF",
              margin: "0 0 2px",
            }}
          >
            POS Terminal
          </h1>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "rgba(205,201,192,0.4)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {dateStr}
          </div>
        </div>
        {isOwner && (
          <div style={{ display: "flex", gap: "4px" }}>
            {LOCATIONS.map((l) => (
              <button
                key={l}
                onClick={() => setLocation(l)}
                style={{
                  padding: "7px 16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    location === l ? "#CDC9C0" : "rgba(205,201,192,0.06)",
                  color:
                    location === l ? "#0f1d24" : "rgba(205,201,192,0.45)",
                  transition: "all 0.15s",
                }}
              >
                {l === "Corpus Christi" ? "CC" : "SA"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3-column grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "300px 1fr 340px",
          overflow: "hidden",
        }}
      >
        {/* LEFT — Appointments */}
        <div
          style={{
            borderRight: "1px solid rgba(205,201,192,0.08)",
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "rgba(205,201,192,0.4)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            Today&apos;s Appointments ({appointments.length})
          </div>
          {loadingAppts ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "rgba(205,201,192,0.35)",
                fontSize: "12px",
              }}
            >
              Loading...
            </div>
          ) : appointments.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "rgba(205,201,192,0.35)",
                fontSize: "12px",
              }}
            >
              No appointments today
            </div>
          ) : (
            appointments.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))
          )}
        </div>

        {/* CENTER — Catalog */}
        <div
          style={{
            borderRight: "1px solid rgba(205,201,192,0.08)",
            overflowY: "auto",
            padding: "16px",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "rgba(205,201,192,0.4)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Service Catalog
          </div>
          <CatalogGrid />
        </div>

        {/* RIGHT — Cart */}
        <div
          style={{
            overflowY: "auto",
            padding: "16px",
            backgroundColor: "#0f1d24",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "rgba(205,201,192,0.4)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Cart
          </div>
          <CartPanel />
        </div>
      </div>

      {/* Suppress unused var */}
      {isStylist ? null : null}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
