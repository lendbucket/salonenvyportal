import { NextResponse } from "next/server"

export const maxDuration = 30

export async function GET() {
  const token = process.env.SOCRATA_APP_TOKEN || "NO TOKEN"

  const res = await fetch(
    "https://data.texas.gov/resource/7358-krk7.json?license_number=1349062",
    { headers: { "X-App-Token": token } }
  )

  const data = await res.json()

  return NextResponse.json({
    token: token.substring(0, 8) + "...",
    status: res.status,
    data,
  })
}
