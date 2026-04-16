import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import crypto from "crypto"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, keyId: true, locationId: true,
      permissions: true, isActive: true, lastUsedAt: true,
      requestCount: true, createdAt: true, expiresAt: true,
    },
  })

  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, locationId, permissions, expiresIn, ipWhitelist, notes } = body as {
    name: string
    locationId?: string
    permissions: string[]
    expiresIn?: string
    ipWhitelist?: string[]
    notes?: string
  }

  if (!name || !permissions?.length) {
    return NextResponse.json({ error: "Name and permissions required" }, { status: 400 })
  }

  const keyId = "sk_live_" + crypto.randomBytes(8).toString("hex")
  const keySecret = crypto.randomBytes(32).toString("hex")
  const keySecretHash = await hash(keySecret, 12)

  let expiresAt: Date | null = null
  if (expiresIn === "90days") expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  else if (expiresIn === "1year") expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyId,
      keySecretHash,
      locationId: locationId || null,
      permissions,
      expiresAt,
      ipWhitelist: ipWhitelist || [],
      notes: notes || null,
      createdBy: (session.user as Record<string, unknown>).id as string,
    },
  })

  // Return the full key ONCE
  return NextResponse.json({
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      keyId: apiKey.keyId,
      fullKey: `${keyId}.${keySecret}`,
    },
  })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.apiKey.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
