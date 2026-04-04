"use client";

import { Send, Sparkles } from "lucide-react";
import { useState } from "react";

type Msg = { id: string; role: "user" | "assistant"; text: string };

const welcome: Msg = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm Reyna AI. I can help you with inventory, scheduling, performance insights, and anything your salon needs. What can I help you with today?",
};

export default function ReynaAIPage() {
  const [messages, setMessages] = useState<Msg[]>([welcome]);
  const [input, setInput] = useState("");

  function send() {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "This is a placeholder response. Connect Reyna AI to your backend to enable real answers.",
        },
      ]);
    }, 400);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-neutral-800 bg-[#161616] px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <Sparkles className="size-7 text-[#C9A84C]" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">Reyna AI</h1>
            <p className="text-sm text-neutral-500">Your Salon Intelligence Assistant</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-6">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[#2a2a2a] text-neutral-100"
                  : "border border-[#C9A84C]/35 bg-[#1f1f1f] text-[#C9A84C]"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-800 bg-[#0d0d0d] p-3 md:p-4">
        <div className="mx-auto flex max-w-4xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask Reyna anything…"
            className="min-h-11 flex-1 rounded-xl border border-neutral-700 bg-[#161616] px-4 text-sm text-neutral-100 outline-none ring-[#C9A84C]/25 placeholder:text-neutral-500 focus:ring-2"
          />
          <button
            type="button"
            onClick={send}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#C9A84C] text-[#0d0d0d] transition hover:bg-[#b89642]"
            aria-label="Send"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
