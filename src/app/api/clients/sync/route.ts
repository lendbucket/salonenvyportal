import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SquareClient, SquareEnvironment } from "square"

export const maxDuration = 60

function getSquare() {
  return new SquareClient({ token: process.env.SQUARE_ACCESS_TOKEN!, environment: SquareEnvironment.Production })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).role as string
  if (role !== "OWNER" && role !== "MANAGER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const square = getSquare()
  let synced = 0

  try {
    let page = await square.customers.list({ limit: 100 })
    for (const c of page.data || []) {
      if (!c.id) continue
      await prisma.client.upsert({
        where: { squareCustomerId: c.id },
        create: {
          squareCustomerId: c.id,
          firstName: c.givenName || null,
          lastName: c.familyName || null,
          email: c.emailAddress || null,
          phone: c.phoneNumber || null,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        },
        update: {
          firstName: c.givenName || undefined,
          lastName: c.familyName || undefined,
          email: c.emailAddress || undefined,
          phone: c.phoneNumber || undefined,
        },
      })
      synced++
    }
    while (page.hasNextPage()) {
      page = await page.getNextPage()
      for (const c of page.data || []) {
        if (!c.id) continue
        await prisma.client.upsert({
          where: { squareCustomerId: c.id },
          create: {
            squareCustomerId: c.id,
            firstName: c.givenName || null,
            lastName: c.familyName || null,
            email: c.emailAddress || null,
            phone: c.phoneNumber || null,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          },
          update: {
            firstName: c.givenName || undefined,
            lastName: c.familyName || undefined,
            email: c.emailAddress || undefined,
            phone: c.phoneNumber || undefined,
          },
        })
        synced++
      }
    }

    return NextResponse.json({ synced })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed", synced }, { status: 500 })
  }
}
