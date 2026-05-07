import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params
  const body = await req.json()

  const draft = await prisma.agentDraft.findUnique({ where: { id } })
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (draft.status === "sent") return NextResponse.json({ error: "Cannot edit a sent message" }, { status: 400 })

  if (body.messageBody && body.messageBody.length > 320) {
    return NextResponse.json({ error: "Message must be under 320 characters (2 SMS segments)" }, { status: 400 })
  }

  const updated = await prisma.agentDraft.update({
    where: { id },
    data: {
      messageBody: body.messageBody ?? draft.messageBody,
      proposedOffer: body.proposedOffer ?? draft.proposedOffer,
      proposedSendAt: body.proposedSendAt ? new Date(body.proposedSendAt) : draft.proposedSendAt,
      editedAt: new Date(),
      editedById: userId,
    },
  })

  return NextResponse.json({ draft: updated })
}
