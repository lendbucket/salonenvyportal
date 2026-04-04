"use client"

import { useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_PROMPTS = [
  "What inventory is running low?",
  "How can I improve client retention?",
  "Help me write a staff schedule",
  "What should I focus on today?",
  "How do I fix warmth on a blonde?",
  "Help me respond to a negative review",
];

export default function ReynaAIPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setShowSuggestions(false);
    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/reyna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationHistory,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        updatedHistory?: { role: "user" | "assistant"; content: string }[];
        error?: string;
      };

      if (!res.ok) {
        const errText =
          typeof data.error === "string" && data.error
            ? data.error
            : res.status === 401
              ? "Please sign in again to use Reyna AI."
              : "I ran into an issue. Please try again.";
        setMessages((prev) => [...prev, { role: "assistant", content: errText }]);
        return;
      }

      const replyText = data.reply?.trim();
      if (replyText) {
        setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
        setConversationHistory(data.updatedHistory ?? []);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I ran into an issue. Please try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const userName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div
      style={{
        height: "calc(100vh - 56px)",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0d0d0d",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid #2a2a2a",
          backgroundColor: "#161616",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "#C9A84C22",
              border: "1px solid #C9A84C44",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
            }}
          >
            ✨
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.1rem",
                fontWeight: "700",
                color: "#f5f5f5",
                margin: 0,
              }}
            >
              Reyna AI
            </h1>
            <p style={{ fontSize: "0.75rem", color: "#C9A84C", margin: 0 }}>
              Your Salon Intelligence Assistant
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {/* Welcome */}
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: "2rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✨</div>
            <h2
              style={{
                color: "#C9A84C",
                fontSize: "1.25rem",
                fontWeight: "700",
                marginBottom: "0.5rem",
              }}
            >
              Hey {userName}! I&apos;m Reyna.
            </h2>
            <p
              style={{
                color: "#888",
                fontSize: "0.9rem",
                maxWidth: "400px",
                margin: "0 auto 2rem",
                lineHeight: "1.6",
              }}
            >
              I can help with color formulas, inventory, scheduling, client retention, and
              anything your salon needs.
            </p>
            {showSuggestions && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  justifyContent: "center",
                  maxWidth: "500px",
                  margin: "0 auto",
                }}
              >
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#1f1f1f",
                      border: "1px solid #2a2a2a",
                      borderRadius: "2rem",
                      color: "#f5f5f5",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#C9A84C";
                      e.currentTarget.style.color = "#C9A84C";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#2a2a2a";
                      e.currentTarget.style.color = "#f5f5f5";
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div
            key={`${i}-${msg.role}-${msg.content.slice(0, 24)}`}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "assistant" && (
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "#C9A84C22",
                  border: "1px solid #C9A84C44",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  marginRight: "0.5rem",
                  flexShrink: 0,
                  marginTop: "4px",
                }}
              >
                ✨
              </div>
            )}
            <div
              style={{
                maxWidth: "72%",
                padding: "0.75rem 1rem",
                borderRadius:
                  msg.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                backgroundColor: msg.role === "user" ? "#C9A84C" : "#1f1f1f",
                color: msg.role === "user" ? "#0d0d0d" : "#f5f5f5",
                fontSize: "0.9rem",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                border: msg.role === "assistant" ? "1px solid #2a2a2a" : "none",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "#C9A84C22",
                border: "1px solid #C9A84C44",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
              }}
            >
              ✨
            </div>
            <div
              style={{
                backgroundColor: "#1f1f1f",
                border: "1px solid #2a2a2a",
                borderRadius: "1rem",
                padding: "0.75rem 1rem",
              }}
            >
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                {[0, 1, 2].map((dot) => (
                  <div
                    key={dot}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#C9A84C",
                      animation: `bounce 1.2s infinite ${dot * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "1rem 1.5rem",
          borderTop: "1px solid #2a2a2a",
          backgroundColor: "#161616",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Ask Reyna anything... (Enter to send)"
            rows={1}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              backgroundColor: "#1f1f1f",
              border: "1px solid #2a2a2a",
              borderRadius: "0.75rem",
              color: "#f5f5f5",
              fontSize: "0.9rem",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: "1.5",
            }}
          />
          <button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              padding: "0.75rem 1.25rem",
              backgroundColor: loading || !input.trim() ? "#2a2a2a" : "#C9A84C",
              color: loading || !input.trim() ? "#555" : "#0d0d0d",
              fontWeight: "700",
              borderRadius: "0.75rem",
              border: "none",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
        <p
          style={{
            color: "#555",
            fontSize: "0.7rem",
            textAlign: "center",
            marginTop: "0.5rem",
          }}
        >
          Reyna AI • Powered by Claude • Salon Envy® Intelligence
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
