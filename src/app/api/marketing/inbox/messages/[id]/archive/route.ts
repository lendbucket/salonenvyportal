import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const { id } = await params
  await prisma.inboundMessage.update({ where: { id }, data: { status: "archived" } })
  return NextResponse.json({ success: true })
}
