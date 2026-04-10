import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SquareClient, SquareEnvironment } from "square"

function getSquare() { return new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production }) }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const q = req.nextUrl.searchParams.get("q") || ""
  if (q.length < 2) return NextResponse.json({ customers: [] })

  try {
    const square = getSquare()
    const res = await square.customers.search({ query: { filter: { emailAddress: { fuzzy: q } } }, limit: BigInt(10) })
    // Fallback: if no results by email/phone, search by name
    let customers = res.customers || []
    if (customers.length === 0) {
      const nameRes = await square.customers.search({ query: { filter: {} }, limit: BigInt(50) })
      const lq = q.toLowerCase()
      customers = (nameRes.customers || []).filter(c => {
        const name = `${c.givenName || ""} ${c.familyName || ""}`.toLowerCase()
        return name.includes(lq) || (c.phoneNumber || "").includes(q) || (c.emailAddress || "").toLowerCase().includes(lq)
      }).slice(0, 10)
    }
    return NextResponse.json({
      customers: customers.map(c => ({ id: c.id, givenName: c.givenName || "", familyName: c.familyName || "", phone: c.phoneNumber || "", email: c.emailAddress || "" }))
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed", customers: [] })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { givenName, familyName, phone, email } = await req.json()
  try {
    const square = getSquare()
    const res = await square.customers.create({ givenName, familyName, phoneNumber: phone || undefined, emailAddress: email || undefined })
    return NextResponse.json({ customer: { id: res.customer?.id, givenName: res.customer?.givenName, familyName: res.customer?.familyName, phone: res.customer?.phoneNumber, email: res.customer?.emailAddress } })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 500 })
  }
}
