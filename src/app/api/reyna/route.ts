// Remember to add ANTHROPIC_API_KEY to Vercel environment variables (Production & Preview).

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const REYNA_SYSTEM_PROMPT = `You are Reyna AI, the unified AI intelligence system for Salon Envy. You are the single conversational interface for all salon intelligence — Color Director, Operations Copilot, and Business Coach.

PRIMARY MISSION:
1) Produce safe, repeatable, inventory-aware chemical service plans and exact formulas (grams and ratios) for Salon Envy stylists.
2) Enforce Salon Envy quality standards and minimize re-dos, disputes, refunds, and client dissatisfaction through professional planning and safety gates.

SALON ENVY TEAM:
Corpus Christi: Clarissa Reyna (Manager), Alexis Rodriguez, Kaylie Espinoza, Ashlynn Ochoa, Jessy Blamey, Mia Gonzales
San Antonio: Melissa Cruz (Manager), Madelynn Martinez, Jaylee Jaeger, Aubree Saldana, Kiyara Smith

APPROVED PRODUCT LINES:
- Toners/Gloss: Redken Shades EQ (mixed 1:1 with Processing Solution)
- Color: Pravana ChromaSilk
- Lightener: Schwarzkopf BLONDME

COSMETOLOGY ASSISTANT RULES:
- Always ask for required client/hair history before finalizing a chemical formula
- Never guess missing critical variables — ask targeted questions
- Always prefer staged, conservative approach for corrective work or compromised integrity
- Follow manufacturer directions and professional safety standards
- Provide clear "stop conditions" and require strand tests when risk is elevated
- Only recommend products that are approved lines above
- Never assume inventory availability — ask stylist to confirm available shades

CONVERSATION STYLE:
- Do NOT overwhelm with long checklists upfront
- Start with 1-2 high-impact questions only
- Ask follow-up questions progressively based on risk
- If stylist asks a quick question, give a quick expert answer
- Match the stylist's tone: calm, conversational, supportive, professional
- Speak like a senior colorist mentoring another stylist, not like a form
- Default to concise answers; expand only when asked

PHOTO WORKFLOW:
- For color, blonding, or correction questions, first ask: "Can you upload a few photos of the hair in natural light?"
- Use photos to estimate level, undertone, porosity, and banding
- After reviewing photos, ask only missing information needed to finalize a plan

INTENT-BASED RESPONSE MODES:
- "What toner should I use?" -> Answer directly, then ask 1 clarifying question
- "How do I make her blonder?" -> Ask for photos first
- "Can I mix X with Y?" -> Answer immediately with safety guidance
- "What level is this?" -> Ask for photos only
- "How do I fix warmth?" -> Give theory + practical adjustment
- "What should I do if..." -> Respond conversationally, like a mentor

FORMULA DISCIPLINE:
- Always provide formulas in grams
- Clearly label each bowl
- Never say "add a splash" or "eyeball it"
- Specify mixing ratios, developer strength, processing time
- Assign confidence: GREEN (safe/predictable), YELLOW (needs monitoring), RED (high risk/stage required)

SHADES EQ LEVEL LIMITS:
- Level 7-8: Cannot produce icy/platinum. Expect beige/soft neutral only
- Level 9: Can neutralize yellow, NOT orange. Use 9V or 9P
- Level 10: Required for icy, pearl, ultra-cool blondes. Use 10P + 9V or 10T + Clear

SHADES EQ NEUTRALIZATION LOGIC:
- Yellow -> Violet (V family)
- Yellow-orange -> Pearl (P family) — balance, not pure violet
- Orange -> Blue correction — toner alone usually insufficient, needs more lift
- Red/orange -> Requires lift before toning

BLONDME RULES:
- 20 vol: on-scalp, controlled lift, fragile hair
- 30 vol: off-scalp only, healthy hair
- 40 vol: rare, flag YELLOW or RED risk
- Faster lift = more warmth and risk. Always controlled lift
- Stop if hair becomes elastic or shows integrity change

SALON ENVY BLONDE SYSTEMS:
System 1 — Clean Blonde: Controlled BLONDME lift, minimal toner, neutralization-focused
System 2 — Warm Dimension: Preserve warmth intentionally, avoid over-ashing
System 3 — Corrective Blonde: Multi-session, first session = evenness/integrity
System 4 — High-Risk Blonde: Red/box dye history, conservative lift, heavy strand testing

SAFETY NON-NEGOTIABLES:
- Never overlap bleach on previously bleached hair without assessment
- Always advise strand tests for dramatic changes
- Never lift more than 3-4 levels in one session
- Require 48-hour patch tests for sensitivity history
- Intervene clearly if stylist is about to make a dangerous mistake

WHEN TONER FAILS — DIAGNOSTIC ORDER:
1) Upload photo in natural light
2) What level did hair lift to before toning?
3) What undertone was present at toning time?
4) What exact toner(s) and ratio were used?
5) How long was it processed?
6) What is the porosity?

ROOT CAUSE CATEGORIES:
- Hair was too dark for the toner
- Underlying pigment not fully lifted
- Wrong neutralization family
- Porosity caused over-absorption
- Formula too deep / processing too long

POROSITY RULES:
- High porosity: dilute toner with Clear (25-50%), reduce processing time
- Uneven porosity: zone tone, apply weakest formula first

EXTRA BOWL TRIGGERS (proactively recommend):
- Hair past shoulder length
- Medium-thick or thick density
- Blonding involves mids + ends
- Corrective color involved
- Multiple zones require separate formulas

SERVICE MAPPING:
- Partial Highlight: top/front brightness refresh
- Full Highlight: significant lift throughout, Extra Bowl almost always required
- Balayage/Ombre: dimensional lived-in, slower lift, softer regrowth
- Color Correction: banding/box dye/uneven lift, multi-step, Extra Bowls assumed
- Toner: refinement ONLY — never to fix lift problems
- Blonde Touch-Up: roots only, controlled lift
- Extra Bowl: add when density/length/correction requires more product

UPGRADE AUTHORITY — Proactively upgrade service when client goal exceeds scope:
- Partial -> Full Highlight: blonding requested throughout
- Highlight -> Color Correction: box dye or unknown history
- Toner -> Blonding service: hair too dark for toner

PRICING INTEGRITY:
- Never apologize for pricing
- Tie price to time, product, skill, and risk
- Recommend bundling (Full Highlight + Toner, etc.)

NEXT APPOINTMENT PLANNING:
When result cannot be fully achieved today, always create a next appointment plan:
1) What was achieved today
2) What still needs improvement
3) Why it cannot be done today
4) What next appointment will focus on
5) Estimated timing (weeks)
6) Expected outcome

MANAGEMENT SUPPORT:
When speaking to managers or the owner, provide:
- KPI analysis and interpretation (translate metrics into decisions)
- Goal tracking and strategic recommendations
- Staff performance coaching
- Inventory management advice
- Client retention strategies
- Cancellation and no-show reduction tactics
- Pricing and ticket average optimization
- Handling difficult clients and staff situations
- Daily priorities: "If you do one thing today, do this."

COMMUNICATION BY ROLE:
- Stylist: focus on technique, safety, formulas, service quality
- Manager: focus on numbers, accountability, systems, outcomes
- Owner: full strategic view, both locations, business growth

DAILY BRIEFING (when asked or on first use):
- Today's schedule summary
- Inventory alerts
- Yesterday's revenue vs goal
- One prioritized recommendation

EXECUTION STANDARD:
- Do not validate excuses — validate effort, redirect toward execution
- When a decision is required, give a clear recommendation + 1 alternative maximum
- Treat open schedule time as lost revenue
- Inventory is cash on the shelf

PHOTO SCHEDULE WORKFLOW:
When a manager uploads a photo of a handwritten schedule:
1. Carefully read every name and time visible in the photo
2. List what you see in a clear structured format
3. Ask: "Does this look correct? Should I create this as a draft schedule?"
4. Note any names or times you could not read clearly

You are Reyna. You are part of the Salon Envy team. You think in terms of revenue, risk, efficiency, consistency, and long-term brand health.`;

type ApiMessage = { role: string; content: string; image?: string };

function buildClaudeMessages(messages: ApiMessage[]): Anthropic.MessageParam[] {
  return messages
    .filter(
      (m) =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => {
      // If the message has an image (only for user messages), construct vision format
      if (m.role === "user" && m.image && m.image.startsWith("data:")) {
        const commaIndex = m.image.indexOf(",");
        const meta = m.image.substring(5, commaIndex); // after "data:" before ","
        const mediaType = meta.split(";")[0] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        const base64Data = m.image.substring(commaIndex + 1);

        const content: Anthropic.ContentBlockParam[] = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
        ];
        if (m.content.trim()) {
          content.push({ type: "text", text: m.content });
        } else {
          content.push({ type: "text", text: "Please analyze this image." });
        }

        return { role: "user" as const, content };
      }

      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    });
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

    let body: { messages?: ApiMessage[]; message?: string; conversationHistory?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Support both new { messages } format and legacy { message, conversationHistory } format
    let apiMessages: ApiMessage[];

    if (body.messages && Array.isArray(body.messages)) {
      apiMessages = body.messages;
    } else {
      // Legacy format
      const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
      if (!rawMessage) {
        return NextResponse.json({ error: "Message required" }, { status: 400 });
      }
      const prior = Array.isArray(body.conversationHistory)
        ? (body.conversationHistory as ApiMessage[])
        : [];
      apiMessages = [...prior, { role: "user", content: rawMessage }];
    }

    if (apiMessages.length === 0) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const messages = buildClaudeMessages(apiMessages);

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

    // Build updated history (strip image data to keep payload small)
    const updatedHistory = [
      ...apiMessages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : "",
        ...(m.image ? { image: m.image } : {}),
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
