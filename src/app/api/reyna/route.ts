import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/api-auth";

const SYSTEM_PROMPT = `You are Reyna AI, the intelligent assistant for Salon Envy® Management Portal. You help salon owners, managers, and stylists with inventory management, scheduling, performance metrics, client retention strategies, and general salon business questions.
You know Salon Envy® has two locations: Corpus Christi at 5601 S Padre Island Dr STE E and San Antonio at 11826 Wurzbach Rd.
Be warm, professional, and concise. Use salon industry knowledge.
When asked about inventory, metrics, or schedules, remind users you can help them navigate the portal to find that information.`;

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your-key-here") {
    return NextResponse.json(
      { error: "Reyna AI is not configured. Set ANTHROPIC_API_KEY in the environment." },
      { status: 503 },
    );
  }

  let body: { message?: string; conversationHistory?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const history = (body.conversationHistory ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const client = new Anthropic({ apiKey: key });

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    const textBlock = res.content.find((b) => b.type === "text");
    const reply =
      textBlock && textBlock.type === "text"
        ? textBlock.text
        : "I couldn’t generate a reply. Please try again.";

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[reyna]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Anthropic request failed" },
      { status: 502 },
    );
  }
}
