import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode")
  const token = req.nextUrl.searchParams.get("hub.verify_token")
  const challenge = req.nextUrl.searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log("Meta webhook event:", JSON.stringify(body).slice(0, 500))
  return new Response("EVENT_RECEIVED", { status: 200 })
}
