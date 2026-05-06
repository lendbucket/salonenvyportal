import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { prisma } = await import("@/lib/prisma")
  const status = req.nextUrl.searchParams.get("status")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}
  if (status && status !== "all") where.status = status

  const campaigns = await prisma.emailCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json({ campaigns })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const body = await req.json()

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: body.name || `Email Campaign ${new Date().toLocaleDateString()}`,
      status: "draft",
      subject: body.subject || "",
      preheader: body.preheader || null,
      fromName: body.fromName || "Salon Envy",
      fromEmail: body.fromEmail || "news@marketing.salonenvyusa.com",
      replyTo: body.replyTo || null,
      templateKey: body.templateKey || "promo",
      templateData: body.templateData || {},
      audienceFilter: body.audienceFilter || { type: "ALL_CLIENTS" },
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      createdById: userId,
    },
  })
  return NextResponse.json({ campaign }, { status: 201 })
}
