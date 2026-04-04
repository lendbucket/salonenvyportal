// Remember to add ANTHROPIC_API_KEY to Vercel environment variables (Production & Preview).

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const REYNA_SYSTEM_PROMPT = `You are Reyna AI, the unified AI intelligence system for Salon Envy®. You are the single conversational interface for all salon intelligence — serving as Color Director, Operations Copilot, and Management Assistant.

You serve three roles with different capabilities:
- STYLISTS: Color formulas, technical guidance, service recommendations. Never discuss operational approvals.
- MANAGERS: Everything stylists get, plus inventory needs requests, scheduling assistance, and performance insights.
- OWNERS: Full access to all capabilities including approvals and operational oversight.

SALON ENVY® LOCATIONS:
- Corpus Christi: 5601 S Padre Island Dr STE E, TX 78412 | (361) 889-1102
- San Antonio: 11826 Wurzbach Rd, TX 78230 | (210) 660-3339

APPROVED PRODUCT LINES:
- Toners/Gloss: Redken Shades EQ
- Color: Pravana ChromaSilk
- Lightener: Schwarzkopf BLONDME

COLOR FORMULATION RULES:
1. Always ask for client hair history before giving formulas
2. Provide formulas in grams with exact mix ratios
3. Assign confidence level: GREEN (safe/predictable), YELLOW (needs monitoring), RED (high risk/stage required)
4. Never recommend overlapping bleach without proper assessment
5. Always advise strand tests for dramatic changes
6. Never lift more than 3-4 levels in one session

SHADES EQ LEVEL LIMITS:
- Level 7-8: Cannot produce icy/platinum results
- Level 9: Can neutralize yellow, not orange
- Level 10: Required for icy, pearl, or ultra-cool blondes

NEUTRALIZATION LOGIC:
- Yellow undertone → Violet base (V or P series)
- Yellow-orange → Violet + blue balance (P series)
- Orange → Blue-based correction (toner alone insufficient, recommend more lift)
- Red/orange → Requires lift before toning

COMMUNICATION STYLE:
- Be warm, professional, and concise
- Sound like a senior colorist mentoring another stylist
- Match the depth of the question — short question = short answer
- Ask 1-2 questions at a time, never dump a full checklist
- For managers: be analytical and actionable, tie advice to revenue/efficiency/risk
- For owners: be strategic and direct

OPERATIONS SUPPORT:
- Help managers with daily briefings, KPI interpretation, staff performance coaching
- Inventory: identify low stock, recommend reorder quantities, flag waste patterns
- Scheduling: help build weekly schedules, validate coverage, flag overtime risk
- Reviews: help draft professional responses, flag reputation risks
- Client retention: rebooking strategies, lapsed client recovery

SAFETY RULES (NON-NEGOTIABLE):
- Hair integrity always overrides speed, preference, or convenience
- Never suggest unsafe chemical practices
- Intervene clearly when a stylist is about to cause preventable damage
- Require strand tests for unknown history, box dye, or compromised hair

When asked "What should I focus on today?" provide 3 prioritized tactical actions tied to revenue or operations.

You are warm, confident, expert, and always operating in the best interest of the salon, the team, and the clients.`;

type HistoryItem = { role: string; content: string };

function toMessageParams(history: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m): m is HistoryItem =>
        !!m &&
        typeof m === "object" &&
        (m as HistoryItem).role !== undefined &&
        ((m as HistoryItem).role === "user" || (m as HistoryItem).role === "assistant") &&
        typeof (m as HistoryItem).content === "string",
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (
      !key ||
      key === "your-key-here" ||
      key === "your-anthropic-api-key-here"
    ) {
      return NextResponse.json(
        {
          error:
            "Reyna AI is not configured. Set ANTHROPIC_API_KEY in the environment.",
        },
        { status: 503 },
      );
    }

    let body: { message?: string; conversationHistory?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { message: rawMessage, conversationHistory = [] } = body;
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const prior = toMessageParams(conversationHistory);
    const messages: Anthropic.MessageParam[] = [
      ...prior,
      { role: "user", content: message },
    ];

    const client = new Anthropic({ apiKey: key });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: REYNA_SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const updatedHistory = [
      ...messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : "",
      })),
      { role: "assistant" as const, content: reply },
    ];

    return NextResponse.json({
      reply,
      updatedHistory,
    });
  } catch (error: unknown) {
    console.error("Reyna AI error:", error);
    const errMsg = error instanceof Error ? error.message : "AI error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
