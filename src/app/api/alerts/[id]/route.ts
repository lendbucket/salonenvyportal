import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction, AUDIT_ACTIONS } from "@/lib/auditLogger"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as Record<string, unknown>
  if (user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await prisma.adminAlert.delete({ where: { id } }).catch(() => null)
  logAction({ action: AUDIT_ACTIONS.ALERT_DELETED, entity: "AdminAlert", entityId: id, userId: user.id as string, userEmail: user.email as string, userRole: user.role as string })
  return NextResponse.json({ success: true })
}
