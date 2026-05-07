import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params
  const body = await req.json()

  await prisma.inboundMessage.update({
    where: { id },
    data: { replyDraft: body.draft || null },
  })

  return NextResponse.json({ success: true })
}
