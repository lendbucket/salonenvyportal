import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const IRS_MILEAGE_RATE = 0.70

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))

  const logs = await prisma.mileageLog.findMany({
    where: { userId, taxYear: year },
    orderBy: { date: "desc" },
  })

  const totalMiles = logs.reduce((sum, l) => sum + l.miles, 0)
  const totalAmount = logs.reduce((sum, l) => sum + l.amount, 0)

  return NextResponse.json({ logs, totalMiles, totalAmount, rate: IRS_MILEAGE_RATE })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const body = await request.json()
  const { date, purpose, miles, notes } = body as {
    date: string
    purpose: string
    miles: number
    notes?: string
  }

  if (!date || !purpose || !miles) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const amount = Math.round(miles * IRS_MILEAGE_RATE * 100) / 100
  const taxYear = new Date(date).getFullYear()

  const log = await prisma.mileageLog.create({
    data: {
      userId,
      date: new Date(date),
      purpose,
      miles,
      amount,
      notes: notes || null,
      taxYear,
    },
  })

  return NextResponse.json({ log })
}
