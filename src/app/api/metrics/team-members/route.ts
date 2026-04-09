import { NextResponse } from "next/server"
import { SquareClient, SquareEnvironment } from "square"

export async function GET() {
  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    // Paginated team members search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMembers: any[] = []
    let cursor: string | undefined
    do {
      const response = await square.teamMembers.search({
        query: { filter: { status: "ACTIVE" } },
        cursor,
      })
      for (const m of (response.teamMembers || [])) allMembers.push(m)
      cursor = response.cursor || undefined
    } while (cursor)

    const members = allMembers.map(m => ({
      id: m.id,
      givenName: m.givenName,
      familyName: m.familyName,
      email: m.emailAddress,
      status: m.status,
      isOwner: m.isOwner,
    }))

    return NextResponse.json({ members, count: members.length })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg })
  }
}
