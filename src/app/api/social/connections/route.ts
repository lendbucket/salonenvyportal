import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const locationId = req.nextUrl.searchParams.get("locationId")

  const connections = await prisma.socialConnection.findMany({
    where: {
      isActive: true,
      ...(locationId ? { locationId } : {}),
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ connections })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can disconnect accounts" }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.socialConnection.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
