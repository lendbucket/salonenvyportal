import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 })

  const { runReynaRecovery } = await import("@/lib/agents/reyna-recovery/run")
  const result = await runReynaRecovery()
  return NextResponse.json(result)
}
