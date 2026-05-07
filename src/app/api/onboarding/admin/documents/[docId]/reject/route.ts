import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const { docId } = await params
  const body = await req.json()

  await prisma.enrollmentDocument.update({
    where: { id: docId },
    data: { isVerified: false, rejectedReason: body.reason || "Rejected" },
  })

  return NextResponse.json({ success: true })
}
