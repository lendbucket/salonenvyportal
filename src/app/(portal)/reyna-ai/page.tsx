"use client";

import { Send, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

type Msg = { id: string; role: "user" | "assistant"; text: string };

const welcome: Msg = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm Reyna AI. I can help with inventory, scheduling, metrics, client retention, and salon operations. Ask me anything, or try a suggestion below.",
};

const SUGGESTIONS = [
  "What inventory is running low?",
  "How can I improve client retention?",
  "Help me write a staff schedule",
  "Explain my metrics dashboard",
];

function LoadingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Loading">
      <span className="size-1.5 animate-bounce rounded-full bg-[#C9A84C] [animation-delay:-0.2s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-[#C9A84C] [animation-delay:-0.1s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-[#C9A84C]" />
    </span>
  );
}

export default function ReynaAIPage() {
  const [messages, setMessages] = useState<Msg[]>([welcome]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setInput("");

    const priorForApi = messages
      .filter((x) => x.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.text }));

    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/reyna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: priorForApi,
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const reply = data.reply?.trim() || "I didn’t get a response. Please try again.";
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", text: reply },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Sorry — ${msg} If your admin hasn’t set ANTHROPIC_API_KEY yet, Reyna AI stays offline until that’s configured.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  function send() {
    void sendMessage(input);
  }

  const showSuggestions = messages.length === 1 && messages[0]?.id === "welcome";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-[#2a2a2a] bg-gradient-to-r from-[#161616] to-[#1a1810] px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#C9A84C]/15 ring-1 ring-[#C9A84C]/40">
            <Sparkles className="size-6 text-[#C9A84C]" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#C9A84C]">Reyna AI</h1>
            <p className="text-sm text-neutral-500">Your Salon Intelligence Assistant</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-6">
        {showSuggestions ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void sendMessage(s)}
                disabled={loading}
                className="rounded-full border border-[#C9A84C]/35 bg-[#1f1f1f] px-3 py-1.5 text-left text-xs text-[#C9A84C] transition hover:bg-[#2a2618] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[#2a2a2a] text-neutral-100"
                  : "border border-[#C9A84C]/35 bg-[#1f1f1f] text-neutral-200"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[#C9A84C]/25 bg-[#1f1f1f] px-4 py-3">
              <LoadingDots />
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#2a2a2a] bg-[#0d0d0d] p-3 md:p-4">
        <div className="mx-auto flex max-w-4xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask Reyna anything…"
            disabled={loading}
            className="min-h-11 flex-1 rounded-xl border border-neutral-700 bg-[#161616] px-4 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 placeholder:text-neutral-500 focus:ring-2 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#C9A84C] text-[#0d0d0d] transition hover:bg-[#b89642] disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
