"use client"
import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"

interface Message {
  role: "user" | "assistant"
  content: string
  image?: string
  timestamp: Date
}

const SUGGESTED_PROMPTS = [
  { icon: "\uD83C\uDFA8", text: "Shades EQ formula for level 9 with yellow tones", category: "Color" },
  { icon: "\u26A1", text: "How do I fix orange brassy hair after bleaching?", category: "Correction" },
  { icon: "\u2728", text: "Best toner for platinum blonde \u2014 level 10", category: "Toner" },
  { icon: "\uD83D\uDCCA", text: "What should I focus on to grow revenue this week?", category: "Business" },
  { icon: "\uD83D\uDC65", text: "How do I handle a client unhappy with their color?", category: "Client" },
  { icon: "\uD83D\uDCB0", text: "How can I increase my average ticket price?", category: "Revenue" },
  { icon: "\uD83D\uDD2C", text: "Going from box dye to natural brown \u2014 what's the plan?", category: "Correction" },
  { icon: "\uD83D\uDCC5", text: "Give me a daily briefing for today", category: "Operations" },
]

export default function ReynaAIPage() {
  const { data: session } = useSession()
  const user = session?.user as Record<string, unknown> | undefined
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (content: string) => {
    if ((!content.trim() && !uploadedImage) || loading) return
    setError(null)

    const messageContent = content.trim() || "I uploaded a photo \u2014 please analyze it."
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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const firstName = (user?.name as string)?.split(" ")[0] || "there"
  const initials = (user?.name as string)?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "R"

  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("\u2022 ") || line.startsWith("- ")) {
        return <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
          <span style={{ color: "#a78bfa", flexShrink: 0 }}>{"\u2022"}</span>
          <span>{line.replace(/^[\u2022\-] /, "")}</span>
        </div>
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <div key={i} style={{ fontWeight: 700, color: "#FFFFFF", marginBottom: "6px", marginTop: "10px" }}>{line.replace(/\*\*/g, "")}</div>
      }
      if (line === "") return <div key={i} style={{ height: "8px" }} />
      return <div key={i} style={{ marginBottom: "2px" }}>{line}</div>
    })
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 56px)",
      backgroundColor: "#0d1b2a",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: "absolute",
        top: "-200px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        height: "400px",
        background: "radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        position: "relative",
        zIndex: 1,
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backdropFilter: "blur(12px)",
        backgroundColor: "rgba(13,27,42,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(139,92,246,0.4)",
            fontSize: "16px",
          }}>{"\u2726"}</div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Reyna AI</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#10B981" }} />
              Color Director · Operations Copilot
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
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
            New chat
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
        {messages.length === 0 ? (
          <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "18px",
                background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 0 40px rgba(139,92,246,0.3)",
                fontSize: "28px",
              }}>{"\u2726"}</div>
              <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 10px", letterSpacing: "-0.03em" }}>
                Hey {firstName}, I'm Reyna
              </h2>
              <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6, maxWidth: "400px", marginInline: "auto" }}>
                Your color director, operations copilot, and business coach — all in one.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt.text)}
                  style={{
                    padding: "14px 16px",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "12px",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{prompt.icon}</span>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#a78bfa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>{prompt.category}</div>
                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{prompt.text}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 24px 8px" }}>
            {messages.map((message, i) => (
              <div key={i} style={{ marginBottom: "24px", display: "flex", gap: "12px", flexDirection: message.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  width: "32px", height: "32px",
                  borderRadius: message.role === "assistant" ? "9px" : "50%",
                  background: message.role === "assistant" ? "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)" : "rgba(255,255,255,0.1)",
                  border: message.role === "user" ? "1px solid rgba(255,255,255,0.15)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: "2px",
                  fontSize: message.role === "assistant" ? "14px" : "11px",
                  fontWeight: 800, color: "rgba(255,255,255,0.8)",
                  boxShadow: message.role === "assistant" ? "0 0 12px rgba(139,92,246,0.3)" : "none",
                }}>
                  {message.role === "assistant" ? "\u2726" : initials}
                </div>
                <div style={{ maxWidth: "85%", flex: 1 }}>
                  {message.image && (
                    <img src={message.image} alt="Uploaded" style={{ maxWidth: "240px", borderRadius: "10px", marginBottom: "8px", display: "block", border: "1px solid rgba(255,255,255,0.1)" }} />
                  )}
                  <div style={{
                    padding: "12px 16px",
                    borderRadius: message.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    backgroundColor: message.role === "user" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                    border: message.role === "user" ? "1px solid rgba(139,92,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
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
              <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "9px",
                  background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: "14px",
                  boxShadow: "0 0 12px rgba(139,92,246,0.3)",
                }}>{"\u2726"}</div>
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
                      backgroundColor: "#a78bfa",
                      animation: `reyna-pulse 1.4s ease-in-out ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div style={{ maxWidth: "720px", margin: "0 auto 16px", padding: "0 24px" }}>
            <div style={{ padding: "12px 16px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", fontSize: "13px", color: "#fca5a5" }}>{error}</div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{
        position: "relative", zIndex: 1,
        padding: "16px 24px 20px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        backgroundColor: "rgba(13,27,42,0.95)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          {uploadedImage && (
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "8px 12px",
              backgroundColor: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: "10px", marginBottom: "8px",
            }}>
              <img src={uploadedImage} alt="Preview" style={{ height: "48px", width: "auto", borderRadius: "6px" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 600 }}>Photo attached</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{imageFile?.name}</div>
              </div>
              <button onClick={() => { setUploadedImage(null); setImageFile(null) }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px", padding: "4px" }}>{"\u2715"}</button>
            </div>
          )}

          <div style={{
            display: "flex", gap: "8px", alignItems: "flex-end",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "14px", padding: "10px 12px",
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setImageFile(file)
                const reader = new FileReader()
                reader.onload = (ev) => setUploadedImage(ev.target?.result as string)
                reader.readAsDataURL(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "34px", height: "34px", borderRadius: "8px",
                backgroundColor: uploadedImage ? "rgba(139,92,246,0.2)" : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: uploadedImage ? "#a78bfa" : "rgba(255,255,255,0.25)",
              }}
              title="Upload photo"
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
                width: "34px", height: "34px", borderRadius: "8px",
                background: input.trim() || uploadedImage
                  ? "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)"
                  : "rgba(255,255,255,0.06)",
                border: "none",
                cursor: input.trim() || uploadedImage ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: input.trim() || uploadedImage ? "0 0 16px rgba(139,92,246,0.4)" : "none",
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: "16px",
                color: input.trim() || uploadedImage ? "#FFFFFF" : "rgba(255,255,255,0.2)",
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
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />
    </div>
  )
}
