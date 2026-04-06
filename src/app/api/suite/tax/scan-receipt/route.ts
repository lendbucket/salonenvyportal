import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const body = await request.json()
  const { imageData } = body as { imageData: string }

  if (!imageData) {
    return NextResponse.json({ error: "No image data provided" }, { status: 400 })
  }

  // Strip data URL prefix if present
  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "")
  const mediaType = imageData.startsWith("data:image/png") ? "image/png" : "image/jpeg"

  const client = new Anthropic()

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: `Analyze this receipt image for a self-employed hair stylist / salon professional. Extract the following information and respond in valid JSON only (no markdown):
{
  "vendor": "store/business name",
  "amount": 0.00,
  "category": "one of: Supplies, Equipment, Education, Travel, Marketing, Office, Insurance, Licensing, Software, Other",
  "description": "brief description of the purchase",
  "date": "YYYY-MM-DD or null if not visible",
  "isDeductible": true,
  "reasoning": "brief explanation of why this is or isn't tax deductible for a hair stylist/salon professional",
  "scheduleC_line": "IRS Schedule C line number (e.g. '22 - Supplies', '13 - Depreciation', '18 - Office expense', '27a - Other expenses', '8 - Advertising', '15 - Insurance', '10 - Commissions and fees'). Pick the best match.",
  "businessPercent": 100,
  "merchantCategory": "merchant category like 'Beauty Supply', 'Office Supply', 'Gas Station', 'Restaurant', 'Retail', 'Education', 'Insurance', 'Auto', 'Technology', 'Other'"
}
If the expense is mixed personal/business (like a phone bill), set businessPercent to the estimated business-use percentage (e.g. 60).`,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  const aiText = textBlock && "text" in textBlock ? textBlock.text : "{}"

  let parsed: {
    vendor?: string
    amount?: number
    category?: string
    description?: string
    date?: string | null
    isDeductible?: boolean
    reasoning?: string
    scheduleC_line?: string
    businessPercent?: number
    merchantCategory?: string
  }
  try {
    parsed = JSON.parse(aiText)
  } catch {
    parsed = {}
  }

  const taxYear = parsed.date
    ? new Date(parsed.date).getFullYear()
    : new Date().getFullYear()

  const amt = parsed.amount || 0
  const bizPct = parsed.businessPercent ?? 100
  const bizAmount = Math.round(amt * bizPct) / 100

  // Duplicate detection: same vendor + amount within 7 days
  const receiptDate = parsed.date ? new Date(parsed.date) : new Date()
  const sevenDaysAgo = new Date(receiptDate)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAhead = new Date(receiptDate)
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7)

  const duplicate = await prisma.taxReceipt.findFirst({
    where: {
      userId,
      vendor: parsed.vendor || "Unknown",
      amount: amt,
      receiptDate: { gte: sevenDaysAgo, lte: sevenDaysAhead },
    },
  })

  const receipt = await prisma.taxReceipt.create({
    data: {
      userId,
      imageData: imageData.substring(0, 500),
      vendor: parsed.vendor || "Unknown",
      amount: amt,
      category: parsed.category || "Other",
      description: parsed.description || "",
      receiptDate,
      isDeductible: parsed.isDeductible ?? true,
      aiAnalysis: aiText,
      taxYear,
      scheduleC_line: parsed.scheduleC_line || null,
      isSplit: bizPct < 100,
      businessPercent: bizPct,
      businessAmount: bizAmount,
      isDuplicate: !!duplicate,
      merchantCategory: parsed.merchantCategory || null,
    },
  })

  return NextResponse.json({ receipt, analysis: parsed, isDuplicate: !!duplicate })
}
