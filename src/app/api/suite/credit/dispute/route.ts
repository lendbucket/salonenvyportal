import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string

  const letters = await prisma.disputeLetter.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ letters })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string
  const { bureau, creditorName, accountNumber, errorType, description } = await req.json()

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Generate a professional FCRA credit dispute letter.
Consumer name: ${user?.name || "Consumer"}
Bureau: ${bureau}
Creditor: ${creditorName}
Account: ${accountNumber || "Unknown"}
Error type: ${errorType}
Description: ${description}
Date: ${today}

Write a formal dispute letter following FCRA Section 611 guidelines.
Be firm but professional. Request investigation and correction within 30 days.
Include a request for written confirmation of the investigation results.
Format as a proper business letter ready to mail.`,
      },
    ],
  })

  const letterContent =
    response.content[0].type === "text" ? response.content[0].text : ""

  const letter = await prisma.disputeLetter.create({
    data: {
      userId,
      bureau,
      creditorName,
      accountNumber: accountNumber || null,
      errorType,
      description,
      letterContent,
      status: "draft",
    },
  })

  return NextResponse.json({ letter })
}
