import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).id as string

  const { prisma } = await import("@/lib/prisma")
  const { docId } = await params

  await prisma.enrollmentDocument.update({
    where: { id: docId },
    data: { isVerified: true, verifiedById: userId, verifiedAt: new Date(), rejectedReason: null },
  })

  return NextResponse.json({ success: true })
}
