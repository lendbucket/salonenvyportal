import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { parseCsvText, createBulkInvites } from "@/lib/onboarding/bulk-invite"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const csvText = body.csv as string
  if (!csvText) return NextResponse.json({ error: "CSV text required" }, { status: 400 })

  const rows = parseCsvText(csvText)
  if (rows.length === 0) return NextResponse.json({ error: "No rows" }, { status: 400 })
  if (rows.length > 50) return NextResponse.json({ error: "Max 50" }, { status: 400 })

  const result = await createBulkInvites(rows)
  return NextResponse.json(result)
}
