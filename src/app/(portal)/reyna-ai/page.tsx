"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Sparkles, Palette, Droplets, User, TrendingUp, DollarSign, Wrench, Settings2, MessageSquare, ArrowUp, Camera } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
  image?: string
  timestamp: Date
}

const SUGGESTED_PROMPTS = [
  { icon: Palette, text: "Shades EQ formula for level 9 with yellow tones", category: "Color" },
  { icon: Wrench, text: "How do I fix orange brassy hair after bleaching?", category: "Correction" },
  { icon: Droplets, text: "Best toner for platinum blonde — level 10", category: "Toner" },
  { icon: TrendingUp, text: "What should I focus on to grow revenue this week?", category: "Business" },
  { icon: User, text: "How do I handle a client unhappy with their color?", category: "Client" },
  { icon: DollarSign, text: "How can I increase my average ticket price?", category: "Revenue" },
  { icon: Wrench, text: "Going from box dye to natural brown — what is the plan?", category: "Correction" },
  { icon: Settings2, text: "Give me a daily briefing for today", category: "Operations" },
]

function ReynaAvatar({ size = 36 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size > 40 ? 16 : 8,
      background: "linear-gradient(135deg, #7a8f96 0%, #606E74 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: size > 40 ? "0 4px 12px rgba(122,143,150,0.25), 0 1px 3px rgba(122,143,150,0.15)" : "none",
    }}>
      <Sparkles size={size * 0.42} color="#FBFBFB" strokeWidth={1.5} />
    </div>
  )
}

export default function ReynaAIPage() {
  const { data: session } = useSession()
  const user = session?.user as Record<string, unknown> | undefined
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if ((!content.trim() && !uploadedImage) || loading) return
    setError(null)

    const messageContent = content.trim() || "I uploaded a photo — please analyze it."
    const userMessage: Message = {
      role: "user",
      content: messageContent,
      image: uploadedImage || undefined,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setUploadedImage(null)
    setImageFile(null)
    setLoading(true)

    try {
      const res = await fetch("/api/reyna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
            image: m.image,
          })),
        }),
      })

      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || data.response || "I couldn't generate a response.",
        timestamp: new Date(),
      }])
    } catch {
      setError("Connection error. Please try again.")
    }
    setLoading(false)
  }, [messages, uploadedImage, loading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const firstName = (user?.name as string)?.split(" ")[0] || "there"
  const initials = (user?.name as string)?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "U"

  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("• ") || line.startsWith("- ")) {
        return <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
          <span style={{ color: "#CDC9C0", flexShrink: 0 }}>{"•"}</span>
          <span>{line.replace(/^[•\-] /, "")}</span>
        </div>
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <div key={i} style={{ fontWeight: 700, color: "#1A1313", marginBottom: "6px", marginTop: "10px" }}>{line.replace(/\*\*/g, "")}</div>
      }
      if (line === "") return <div key={i} style={{ height: "8px" }} />
      return <div key={i} style={{ marginBottom: "2px" }}>{line}</div>
    })
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  /* ═══════════════════════════════════════════
     SHARED: Welcome screen
     ═══════════════════════════════════════════ */
  const welcomeScreen = (
    <div style={{
      display: "flex", flexDirection: "column" as const, alignItems: "center",
      paddingTop: isMobile ? 24 : 64, paddingBottom: isMobile ? 28 : 48,
      textAlign: "center" as const,
      width: "100%", maxWidth: isMobile ? "100%" : 760, margin: "0 auto",
      padding: isMobile ? "24px 16px" : "64px 24px 48px",
    }}>
      <ReynaAvatar size={56} />
      <h2 style={{
        fontFamily: "Inter", fontSize: isMobile ? 22 : 28, fontWeight: 700,
        color: "#1A1313", letterSpacing: "-0.31px", lineHeight: 1.2,
        marginTop: 24, marginBottom: 8,
      }}>
        Hey {firstName}, I&apos;m Reyna
      </h2>
      <p style={{
        fontFamily: "Inter", fontSize: 15, fontWeight: 400,
        color: "rgba(26,19,19,0.5)", letterSpacing: "-0.31px",
        lineHeight: 1.5, maxWidth: 420, margin: "0 auto 32px",
      }}>
        Your Salon Envy intelligence system. Ask me about color formulas, business strategy, client situations, or operations.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
        gap: 12, width: "100%", maxWidth: 640,
      }}>
        {SUGGESTED_PROMPTS.map((prompt, i) => {
          const Icon = prompt.icon
          return (
            <button
              key={i}
              onClick={() => sendMessage(prompt.text)}
              style={{
                background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)",
                borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                transition: "all 0.15s ease", display: "flex", flexDirection: "column" as const,
                gap: 6, textAlign: "left" as const, width: "100%",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(122,143,150,0.25)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(-1px)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(26,19,19,0.07)"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "translateY(0)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <Icon size={13} color="rgba(26,19,19,0.3)" strokeWidth={1.5} />
                <span style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "rgba(26,19,19,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                  {prompt.category}
                </span>
              </div>
              <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: "rgba(26,19,19,0.75)", letterSpacing: "-0.31px", lineHeight: 1.4 }}>
                {prompt.text}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  /* ═══════════════════════════════════════════
     SHARED: Messages list
     ═══════════════════════════════════════════ */
  const messagesList = (
    <div style={{ maxWidth: isMobile ? "100%" : 760, margin: "0 auto", padding: isMobile ? "16px 12px 8px" : "32px 24px 24px", display: "flex", flexDirection: "column" as const, gap: 24 }}>
      {messages.map((message, i) => (
        message.role === "user" ? (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
            <div style={{ maxWidth: "70%" }}>
              {message.image && (
                <img src={message.image} alt="Uploaded" style={{ maxWidth: "240px", borderRadius: "10px", marginBottom: "8px", display: "block", border: "1px solid rgba(26,19,19,0.1)", marginLeft: "auto" }} />
              )}
              <div style={{
                background: "#7a8f96", color: "#FBFBFB",
                borderRadius: "16px 16px 4px 16px", padding: "12px 16px",
                fontFamily: "Inter", fontSize: 14, fontWeight: 400,
                letterSpacing: "-0.31px", lineHeight: 1.5,
              }}>
                {message.content}
              </div>
              <div style={{ fontSize: 10, color: "rgba(26,19,19,0.2)", marginTop: 4, textAlign: "right" as const, paddingRight: 4 }}>
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ) : (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%" }}>
            <div style={{ marginTop: 2, flexShrink: 0 }}>
              <ReynaAvatar size={28} />
            </div>
            <div style={{ maxWidth: "80%" }}>
              {message.image && (
                <img src={message.image} alt="Uploaded" style={{ maxWidth: "240px", borderRadius: "10px", marginBottom: "8px", display: "block", border: "1px solid rgba(26,19,19,0.1)" }} />
              )}
              <div style={{
                background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)",
                borderRadius: "4px 16px 16px 16px", padding: "14px 18px",
                fontFamily: "Inter", fontSize: 14, fontWeight: 400,
                color: "#1A1313", letterSpacing: "-0.31px", lineHeight: 1.65,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03)",
              }}>
                {formatContent(message.content)}
              </div>
              <div style={{ fontSize: 10, color: "rgba(26,19,19,0.2)", marginTop: 4, textAlign: "left" as const, paddingLeft: 4 }}>
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        )
      ))}

      {loading && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ marginTop: 2, flexShrink: 0 }}>
            <ReynaAvatar size={28} />
          </div>
          <div style={{
            background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)",
            borderRadius: "4px 16px 16px 16px", padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 4,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03)",
          }}>
            <div className="reyna-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(26,19,19,0.25)" }} />
            <div className="reyna-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(26,19,19,0.25)" }} />
            <div className="reyna-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(26,19,19,0.25)" }} />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )

  /* ═══════════════════════════════════════════
     SHARED: Error banner
     ═══════════════════════════════════════════ */
  const errorBanner = error ? (
    <div style={{ maxWidth: isMobile ? "100%" : "720px", margin: "0 auto 16px", padding: "0 16px" }}>
      <div style={{ padding: "12px 16px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", fontSize: "13px", color: "#fca5a5" }}>{error}</div>
    </div>
  ) : null

  /* ═══════════════════════════════════════════
     SHARED: Image preview
     ═══════════════════════════════════════════ */
  const imagePreview = uploadedImage ? (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "8px 12px",
      backgroundColor: "rgba(42,90,90,0.15)",
      border: "1px solid rgba(42,90,90,0.3)",
      borderRadius: "10px", marginBottom: "8px",
    }}>
      <img src={uploadedImage} alt="Preview" style={{ height: "48px", width: "auto", borderRadius: "6px" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "12px", color: "#CDC9C0", fontWeight: 600 }}>Photo attached</div>
        <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.4)" }}>{imageFile?.name}</div>
      </div>
      <button onClick={() => { setUploadedImage(null); setImageFile(null) }} style={{ background: "none", border: "none", color: "rgba(26,19,19,0.3)", cursor: "pointer", padding: "4px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
      </button>
    </div>
  ) : null

  /* ═══════════════════════════════════════════
     SHARED: Hidden file input
     ═══════════════════════════════════════════ */
  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      style={{ display: "none" }}
      onChange={handleFileUpload}
    />
  )

  /* ═══════════════════════════════════════════
     SHARED: Header bar
     ═══════════════════════════════════════════ */
  const headerBar = (
    <div style={{
      position: "relative",
      zIndex: 1,
      padding: isMobile ? "10px 14px" : "16px 24px",
      borderBottom: "1px solid rgba(26,19,19,0.06)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backdropFilter: isMobile ? undefined : "blur(12px)",
      backgroundColor: isMobile ? "#F4F5F7" : "rgba(244,245,247,0.9)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <ReynaAvatar size={isMobile ? 32 : 36} />
        <div>
          <div style={{ fontSize: isMobile ? "14px" : "15px", fontWeight: 700, color: "#1A1313", letterSpacing: "-0.01em" }}>Reyna AI</div>
          <div style={{ fontSize: "11px", color: "rgba(26,19,19,0.4)", display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#10B981" }} />
            Salon Envy Intelligence
          </div>
        </div>
      </div>
      {messages.length > 0 && (
        <button
          onClick={clearChat}
          style={{
            padding: "6px 14px",
            backgroundColor: "rgba(26,19,19,0.04)",
            border: "1px solid rgba(26,19,19,0.08)",
            borderRadius: "8px",
            color: "rgba(26,19,19,0.4)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          Clear
        </button>
      )}
    </div>
  )

  /* ═══════════════════════════════════════════
     MOBILE LAYOUT
     ═══════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div style={{
        position: "fixed",
        top: "calc(52px + env(safe-area-inset-top, 0px))",
        left: 0,
        right: 0,
        bottom: "60px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#F4F5F7",
        zIndex: 10,
      }}>
        {hiddenFileInput}

        {/* Header */}
        {headerBar}

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}>
          {messages.length === 0 ? welcomeScreen : messagesList}
          {errorBanner}
        </div>

        {/* Input Area */}
        <div style={{
          padding: "8px 12px",
          borderTop: "1px solid rgba(26,19,19,0.06)",
          backgroundColor: "#F4F5F7",
          paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        }}>
          {imagePreview}
          <div style={{
            display: "flex",
            gap: "6px",
            alignItems: "flex-end",
            backgroundColor: "rgba(26,19,19,0.05)",
            border: "1px solid rgba(26,19,19,0.1)",
            borderRadius: "24px",
            padding: "6px 8px",
          }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: uploadedImage ? "rgba(42,90,90,0.3)" : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: uploadedImage ? "#CDC9C0" : "rgba(26,19,19,0.3)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>photo_camera</span>
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Reyna anything..."
              rows={1}
              style={{
                flex: 1, backgroundColor: "transparent", border: "none", outline: "none",
                color: "rgba(26,19,19,0.9)", fontSize: "16px", lineHeight: 1.4,
                resize: "none", maxHeight: "100px", overflowY: "auto",
                fontFamily: "inherit", padding: "6px 0",
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 100) + "px"
              }}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && !uploadedImage)}
              style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: (input.trim() || uploadedImage) ? "#CDC9C0" : "rgba(26,19,19,0.06)",
                border: "none",
                cursor: (input.trim() || uploadedImage) ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: "18px",
                color: (input.trim() || uploadedImage) ? "#F4F5F7" : "rgba(26,19,19,0.2)",
              }}>arrow_upward</span>
            </button>
          </div>
        </div>

        <style>{`
          @keyframes reyna-pulse {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1); }
          }
          textarea::placeholder { color: rgba(26,19,19,0.25); }
        `}</style>
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     DESKTOP LAYOUT
     ═══════════════════════════════════════════ */
  return (
    <div style={{
      minHeight: "calc(100vh - 56px)", background: "#F4F5F7",
      display: "flex", flexDirection: "column" as const, alignItems: "center",
      position: "relative",
    }}>
      {hiddenFileInput}

      {/* Main content — scrollable */}
      <div style={{
        width: "100%", maxWidth: 760, flex: 1,
        display: "flex", flexDirection: "column" as const,
        padding: "0 24px", paddingBottom: 120,
        overflowY: "auto",
      }}>
        {/* Header bar when messages exist */}
        {messages.length > 0 && (
          <div style={{
            position: "sticky" as const, top: 0, zIndex: 5,
            padding: "12px 0", display: "flex", justifyContent: "space-between",
            alignItems: "center", background: "#F4F5F7",
            borderBottom: "1px solid rgba(26,19,19,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ReynaAvatar size={28} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>Reyna AI</div>
                <div style={{ fontSize: 11, color: "rgba(26,19,19,0.4)", display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#10B981" }} />
                  Salon Envy Intelligence
                </div>
              </div>
            </div>
            <button onClick={clearChat} style={{
              padding: "6px 14px", background: "rgba(26,19,19,0.04)",
              border: "1px solid rgba(26,19,19,0.08)", borderRadius: 8,
              color: "rgba(26,19,19,0.4)", fontSize: 11, fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.04em",
            }}>
              Clear
            </button>
          </div>
        )}

        {messages.length === 0 ? welcomeScreen : messagesList}
        {errorBanner}
      </div>

      {/* Fixed input bar at bottom */}
      <div style={{
        position: "fixed" as const, bottom: 0, left: 220, right: 0,
        background: "linear-gradient(to top, #F4F5F7 80%, transparent)",
        padding: "16px 0 24px", display: "flex", justifyContent: "center",
        zIndex: 30,
      }}>
        <div style={{ width: "100%", maxWidth: 760, padding: "0 24px" }}>
          {imagePreview}

          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            background: "#FBFBFB", border: "1px solid rgba(26,19,19,0.1)",
            borderRadius: 16, padding: "10px 10px 10px 16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)",
            transition: "all 0.15s ease",
          }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 34, height: 34, borderRadius: 8,
                backgroundColor: uploadedImage ? "rgba(122,143,150,0.15)" : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: uploadedImage ? "#7a8f96" : "rgba(26,19,19,0.25)",
                transition: "all 0.15s ease",
              }}
            >
              <Camera size={18} />
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Reyna about color formulas, business strategy, or operations..."
              rows={1}
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontFamily: "Inter", fontSize: 14, fontWeight: 400,
                color: "#1A1313", letterSpacing: "-0.31px", lineHeight: 1.5,
                resize: "none", minHeight: 24, maxHeight: 160, padding: 0,
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 160) + "px"
              }}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && !uploadedImage)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: (input.trim() || uploadedImage) ? "#7a8f96" : "rgba(26,19,19,0.08)",
                border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: (input.trim() || uploadedImage) ? "pointer" : "not-allowed",
                flexShrink: 0, transition: "all 0.15s ease",
                boxShadow: (input.trim() || uploadedImage) ? "0 1px 3px rgba(122,143,150,0.3)" : "none",
              }}
            >
              <ArrowUp size={16} color={(input.trim() || uploadedImage) ? "#FBFBFB" : "rgba(26,19,19,0.3)"} />
            </button>
          </div>

          <div style={{ fontFamily: "Inter", fontSize: 11, color: "rgba(26,19,19,0.3)", letterSpacing: "-0.31px", textAlign: "center" as const, marginTop: 8 }}>
            Enter to send &middot; Shift+Enter for new line
          </div>
        </div>
      </div>

      <style>{`textarea::placeholder { color: rgba(26,19,19,0.35); }`}</style>
    </div>
  )
}
