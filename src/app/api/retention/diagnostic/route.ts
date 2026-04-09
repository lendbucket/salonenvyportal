import { NextResponse } from "next/server"
import { SquareClient, SquareEnvironment } from "square"

export async function GET() {
  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    // Get sample customers with pagination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCustomers: any[] = []
    let customersPage = await square.customers.list({ limit: 100 })
    for (const c of customersPage.data) allCustomers.push(c)
    while (customersPage.hasNextPage()) {
      customersPage = await customersPage.getNextPage()
      for (const c of customersPage.data) allCustomers.push(c)
    }

    const sampleCustomers = allCustomers.slice(0, 5).map(c => ({
      id: c.id,
      firstName: c.givenName,
      lastName: c.familyName,
      email: c.emailAddress,
      phone: c.phoneNumber,
      createdAt: c.createdAt,
    }))

    // Get sample bookings from last year with pagination
    const now = new Date()
    const yearAgo = new Date(now.getFullYear() - 1, 0, 1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBookings: any[] = []
    let bookingsPage = await square.bookings.list({
      startAtMin: yearAgo.toISOString(),
      startAtMax: now.toISOString(),
      limit: 200,
    })
    for (const b of bookingsPage.data) allBookings.push(b)
    while (bookingsPage.hasNextPage()) {
      bookingsPage = await bookingsPage.getNextPage()
      for (const b of bookingsPage.data) allBookings.push(b)
    }

    const sampleBookings = allBookings.slice(0, 5).map(b => ({
      id: b.id,
      customerId: b.customerId,
      teamMemberId: b.appointmentSegments?.[0]?.teamMemberId,
      startAt: b.startAt,
      status: b.status,
      locationId: b.locationId,
    }))

    return NextResponse.json({
      customerCount: allCustomers.length,
      hasMoreCustomers: false,
      sampleCustomers,
      sampleBookings,
      bookingCount: allBookings.length,
      hasMoreBookings: false,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg })
  }
}
