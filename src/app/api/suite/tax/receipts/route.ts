import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))
  const targetUserId = searchParams.get("userId") || userId

  const receipts = await prisma.taxReceipt.findMany({
    where: { userId: targetUserId, taxYear: year },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ receipts })
}
