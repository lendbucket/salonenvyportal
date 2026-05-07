import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const body = await req.json()
  const status = body.status as string
  if (!["active", "paused", "suspended"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const agent = await prisma.agent.update({
    where: { name: "reyna_recovery" },
    data: { status },
  })
  return NextResponse.json({ agent })
}
