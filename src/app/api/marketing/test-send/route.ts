import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { personalizeBody } from "@/lib/sms/personalize"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const userId = (session.user as Record<string, unknown>).id as string
  const { prisma } = await import("@/lib/prisma")

  // Find user's phone from User or linked StaffMember
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { staffMember: { select: { phone: true } } } })
  const phone = user?.staffMember?.phone
  if (!phone) return NextResponse.json({ error: "No phone number on your profile. Add one in /settings or ask your admin." }, { status: 400 })

  const reqBody = await req.json()
  const messageBody = reqBody.body as string
  if (!messageBody) return NextResponse.json({ error: "Message body is required" }, { status: 400 })

  const personalized = personalizeBody(messageBody, { firstName: user.name?.split(" ")[0] || "Test", lastName: user.name?.split(" ").slice(1).join(" ") || "", lastVisitAt: null })

  try {
    const twilio = await import("twilio")
    const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    const msg = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
      body: personalized,
    })

    const masked = phone.replace(/^(.+)(\d{4})$/, "***-***-$2")
    return NextResponse.json({ success: true, sentTo: masked, twilioSid: msg.sid })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed" }, { status: 500 })
  }
}
