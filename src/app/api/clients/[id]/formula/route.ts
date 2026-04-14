import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const formulas = await prisma.clientFormula.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ formulas })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const user = session.user as Record<string, unknown>
  const body = await req.json()

  const formula = await prisma.clientFormula.create({
    data: {
      clientId: id,
      appliedBy: (user.name as string) || "Staff",
      appliedById: (user.id as string) || "",
      baseColor: body.baseColor || null,
      colorBrand: body.colorBrand || null,
      developer: body.developer || null,
      developerVolume: body.developerVolume || null,
      toner: body.toner || null,
      tonerBrand: body.tonerBrand || null,
      processingTime: body.processingTime || null,
      technique: body.technique || null,
      notes: body.notes || null,
      appointmentId: body.appointmentId || null,
    },
  })

  return NextResponse.json({ formula })
}
