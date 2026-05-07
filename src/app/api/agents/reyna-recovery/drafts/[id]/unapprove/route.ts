import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params

  const draft = await prisma.agentDraft.findUnique({ where: { id } })
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (draft.status === "sent") return NextResponse.json({ error: "Cannot un-approve a sent message" }, { status: 400 })
  if (draft.status !== "approved") return NextResponse.json({ error: "Only approved drafts can be un-approved" }, { status: 400 })

  const updated = await prisma.agentDraft.update({
    where: { id },
    data: { status: "pending", reviewedAt: null, reviewedById: null },
  })

  return NextResponse.json({ draft: updated })
}
