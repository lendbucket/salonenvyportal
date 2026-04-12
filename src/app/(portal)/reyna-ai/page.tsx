"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

interface Message {
  role: "user" | "assistant"
  content: string
  image?: string
  timestamp: Date
}

const SUGGESTED_PROMPTS = [
  { icon: "palette", text: "Shades EQ formula for level 9 with yellow tones", category: "Color" },
  { icon: "bolt", text: "How do I fix orange brassy hair after bleaching?", category: "Correction" },
  { icon: "auto_fix_high", text: "Best toner for platinum blonde — level 10", category: "Toner" },
  { icon: "trending_up", text: "What should I focus on to grow revenue this week?", category: "Business" },
  { icon: "person", text: "How do I handle a client unhappy with their color?", category: "Client" },
  { icon: "payments", text: "How can I increase my average ticket price?", category: "Revenue" },
  { icon: "science", text: "Going from box dye to natural brown — what is the plan?", category: "Correction" },
  { icon: "today", text: "Give me a daily briefing for today", category: "Operations" },
]

function ReynaAvatar({ size = 36 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: "linear-gradient(135deg, #0a2a2a 0%, #1a4a4a 50%, #0f3535 100%)",
      border: "1px solid rgba(205,201,192,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      <img src="/images/logo-white.png" alt="Reyna" style={{ width: size * 0.75, height: "auto", objectFit: "contain", opacity: 0.9 }} />
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
        return <div key={i} style={{ fontWeight: 700, color: "#FFFFFF", marginBottom: "6px", marginTop: "10px" }}>{line.replace(/\*\*/g, "")}</div>
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
    <div style={{ maxWidth: isMobile ? "100%" : "720px", margin: "0 auto", padding: isMobile ? "24px 16px" : "48px 24px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: isMobile ? "28px" : "48px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <ReynaAvatar size={isMobile ? 56 : 64} />
        </div>
        <h2 style={{
          fontSize: isMobile ? "22px" : "28px",
          fontWeight: 800,
          color: "#FFFFFF",
          margin: "0 0 10px",
          letterSpacing: "-0.03em",
        }}>
          Hey {firstName}, I&apos;m Reyna
        </h2>
        <p style={{
          fontSize: isMobile ? "14px" : "15px",
          color: "rgba(255,255,255,0.45)",
          margin: "0 0 4px",
          lineHeight: 1.6,
          maxWidth: "400px",
          marginInline: "auto",
        }}>
          Salon Envy Intelligence System
        </p>
        <p style={{
          fontSize: isMobile ? "12px" : "13px",
          color: "rgba(255,255,255,0.3)",
          margin: 0,
          lineHeight: 1.5,
          maxWidth: "400px",
          marginInline: "auto",
        }}>
          Color Director &middot; Operations Copilot &middot; Business Coach
        </p>
      </div>
      <div style={{
        display: isMobile ? "flex" : "grid",
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "8px",
      }}>
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => sendMessage(prompt.text)}
            style={{
              padding: isMobile ? "12px 14px" : "14px 16px",
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "12px",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              width: "100%",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#CDC9C0", flexShrink: 0, marginTop: "1px" }}>{prompt.icon}</span>
            <div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>{prompt.category}</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{prompt.text}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  /* ═══════════════════════════════════════════
     SHARED: Messages list
     ═══════════════════════════════════════════ */
  const messagesList = (
    <div style={{ maxWidth: isMobile ? "100%" : "720px", margin: "0 auto", padding: isMobile ? "16px 12px 8px" : "24px 24px 8px" }}>
      {messages.map((message, i) => (
        <div key={i} style={{
          marginBottom: isMobile ? "16px" : "24px",
          display: "flex",
          gap: isMobile ? "8px" : "12px",
          flexDirection: message.role === "user" ? "row-reverse" : "row",
        }}>
          <div style={{
            width: "32px", height: "32px",
            borderRadius: message.role === "assistant" ? "9px" : "50%",
            overflow: "hidden",
            background: message.role === "user" ? "rgba(255,255,255,0.1)" : undefined,
            border: message.role === "user" ? "1px solid rgba(255,255,255,0.15)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, marginTop: "2px",
            fontSize: "11px",
            fontWeight: 800, color: "rgba(255,255,255,0.8)",
          }}>
            {message.role === "assistant" ? <ReynaAvatar size={32} /> : initials}
          </div>
          <div style={{ maxWidth: "85%", flex: 1 }}>
            {message.image && (
              <img src={message.image} alt="Uploaded" style={{ maxWidth: "240px", borderRadius: "10px", marginBottom: "8px", display: "block", border: "1px solid rgba(255,255,255,0.1)" }} />
            )}
            <div style={{
              padding: "12px 16px",
              borderRadius: message.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
              backgroundColor: message.role === "user" ? "rgba(96,110,116,0.15)" : "#0d1117",
              border: message.role === "user" ? "1px solid rgba(205,201,192,0.2)" : "1px solid rgba(255,255,255,0.06)",
              fontSize: "14px", lineHeight: 1.65, color: "rgba(255,255,255,0.88)",
            }}>
              {message.role === "assistant" ? formatContent(message.content) : message.content}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px", textAlign: message.role === "user" ? "right" : "left", paddingInline: "4px" }}>
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      ))}

      {loading && (
        <div style={{ display: "flex", gap: isMobile ? "8px" : "12px", marginBottom: "24px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", overflow: "hidden", flexShrink: 0 }}>
            <ReynaAvatar size={32} />
          </div>
          <div style={{
            padding: "14px 18px",
            borderRadius: "4px 16px 16px 16px",
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: "4px",
          }}>
            {[0, 1, 2].map(j => (
              <div key={j} style={{
                width: "6px", height: "6px", borderRadius: "50%",
                backgroundColor: "#CDC9C0",
                animation: `reyna-pulse 1.4s ease-in-out ${j * 0.2}s infinite`,
              }} />
            ))}
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
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{imageFile?.name}</div>
      </div>
      <button onClick={() => { setUploadedImage(null); setImageFile(null) }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "4px" }}>
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
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backdropFilter: isMobile ? undefined : "blur(12px)",
      backgroundColor: isMobile ? "#0f1d24" : "rgba(15,29,36,0.8)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <ReynaAvatar size={isMobile ? 32 : 36} />
        <div>
          <div style={{ fontSize: isMobile ? "14px" : "15px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Reyna AI</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: "4px" }}>
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
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            color: "rgba(255,255,255,0.4)",
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
        backgroundColor: "#0f1d24",
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "#0f1d24",
          paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        }}>
          {imagePreview}
          <div style={{
            display: "flex",
            gap: "6px",
            alignItems: "flex-end",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
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
                flexShrink: 0, color: uploadedImage ? "#CDC9C0" : "rgba(255,255,255,0.3)",
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
                color: "rgba(255,255,255,0.9)", fontSize: "16px", lineHeight: 1.4,
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
                backgroundColor: (input.trim() || uploadedImage) ? "#CDC9C0" : "rgba(255,255,255,0.06)",
                border: "none",
                cursor: (input.trim() || uploadedImage) ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: "18px",
                color: (input.trim() || uploadedImage) ? "#0f1d24" : "rgba(255,255,255,0.2)",
              }}>arrow_upward</span>
            </button>
          </div>
        </div>

        <style>{`
          @keyframes reyna-pulse {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1); }
          }
          textarea::placeholder { color: rgba(255,255,255,0.25); }
        `}</style>
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     DESKTOP LAYOUT
     ═══════════════════════════════════════════ */
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 52px)",
      backgroundColor: "#0f1d24",
      position: "relative",
      overflow: "hidden",
    }}>
      {hiddenFileInput}

      {/* Ambient teal gradient glow */}
      <div style={{
        position: "absolute",
        top: "-200px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        height: "400px",
        background: "radial-gradient(ellipse, rgba(42,90,90,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Header */}
      {headerBar}

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
        {messages.length === 0 ? welcomeScreen : messagesList}
        {errorBanner}
      </div>

      {/* Input Area */}
      <div style={{
        position: "relative", zIndex: 1,
        padding: "16px 24px 20px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        backgroundColor: "rgba(15,29,36,0.95)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          {imagePreview}

          <div style={{
            display: "flex", gap: "8px", alignItems: "flex-end",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "14px", padding: "10px 12px",
          }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "34px", height: "34px", borderRadius: "8px",
                backgroundColor: uploadedImage ? "rgba(42,90,90,0.3)" : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: uploadedImage ? "#CDC9C0" : "rgba(255,255,255,0.25)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                {uploadedImage ? "image" : "add_photo_alternate"}
              </span>
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about color formulas, client situations, business strategy..."
              rows={1}
              style={{
                flex: 1, backgroundColor: "transparent", border: "none", outline: "none",
                color: "rgba(255,255,255,0.9)", fontSize: "14px", lineHeight: 1.5,
                resize: "none", maxHeight: "120px", overflowY: "auto",
                fontFamily: "inherit", padding: "4px 0",
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 120) + "px"
              }}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={loading || (!input.trim() && !uploadedImage)}
              style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: (input.trim() || uploadedImage) ? "#CDC9C0" : "rgba(255,255,255,0.06)",
                border: "none",
                cursor: (input.trim() || uploadedImage) ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: "16px",
                color: (input.trim() || uploadedImage) ? "#0f1d24" : "rgba(255,255,255,0.2)",
              }}>arrow_upward</span>
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.15)", marginTop: "8px", letterSpacing: "0.02em" }}>
            Enter to send · Shift+Enter for new line · Upload photos for color analysis
          </div>
        </div>
      </div>

      <style>{`
        @keyframes reyna-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
        textarea::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  )
}
