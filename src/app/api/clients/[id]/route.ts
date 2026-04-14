import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const user = session.user as Record<string, unknown>
  const role = user.role as string

  const client = await prisma.client.findUnique({
    where: { id },
    include: { formulas: { orderBy: { createdAt: "desc" } } },
  })

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const isStylist = role === "STYLIST"
  return NextResponse.json({
    ...client,
    email: isStylist && client.email ? `${client.email[0]}***@${client.email.split("@")[1] || ""}` : client.email,
    phone: isStylist && client.phone ? `***-***-${client.phone.replace(/\D/g, "").slice(-4)}` : client.phone,
  })
}
