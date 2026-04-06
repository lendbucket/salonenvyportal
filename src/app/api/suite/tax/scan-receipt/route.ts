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
            text: `Analyze this receipt image. Extract the following information and respond in valid JSON only (no markdown):
{
  "vendor": "store/business name",
  "amount": 0.00,
  "category": "one of: Supplies, Equipment, Education, Travel, Marketing, Office, Insurance, Licensing, Software, Other",
  "description": "brief description of the purchase",
  "date": "YYYY-MM-DD or null if not visible",
  "isDeductible": true,
  "reasoning": "brief explanation of why this is or isn't tax deductible for a hair stylist/salon professional"
}`,
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
  }
  try {
    parsed = JSON.parse(aiText)
  } catch {
    parsed = {}
  }

  const taxYear = parsed.date
    ? new Date(parsed.date).getFullYear()
    : new Date().getFullYear()

  const receipt = await prisma.taxReceipt.create({
    data: {
      userId,
      imageData: imageData.substring(0, 500), // Store thumbnail reference, not full image
      vendor: parsed.vendor || "Unknown",
      amount: parsed.amount || 0,
      category: parsed.category || "Other",
      description: parsed.description || "",
      receiptDate: parsed.date ? new Date(parsed.date) : new Date(),
      isDeductible: parsed.isDeductible ?? true,
      aiAnalysis: aiText,
      taxYear,
    },
  })

  return NextResponse.json({ receipt, analysis: parsed })
}
