import { NextResponse } from "next/server"
import { SquareClient, SquareEnvironment } from "square"

export async function GET() {
  try {
    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production,
    })

    // Get sample customers
    const customersPage = await square.customers.list({ limit: 10 })
    const sampleCustomers = customersPage.data?.slice(0, 5).map(c => ({
      id: c.id,
      firstName: c.givenName,
      lastName: c.familyName,
      email: c.emailAddress,
      phone: c.phoneNumber,
      createdAt: c.createdAt,
    }))

    // Get sample bookings from last year
    const now = new Date()
    const yearAgo = new Date(now.getFullYear() - 1, 0, 1)
    const bookingsPage = await square.bookings.list({
      startAtMin: yearAgo.toISOString(),
      startAtMax: now.toISOString(),
      limit: 10,
    })

    const sampleBookings = bookingsPage.data?.slice(0, 5).map(b => ({
      id: b.id,
      customerId: b.customerId,
      teamMemberId: b.appointmentSegments?.[0]?.teamMemberId,
      startAt: b.startAt,
      status: b.status,
      locationId: b.locationId,
    }))

    return NextResponse.json({
      customerCount: customersPage.data?.length || 0,
      hasMoreCustomers: customersPage.hasNextPage(),
      sampleCustomers,
      sampleBookings,
      bookingCount: bookingsPage.data?.length || 0,
      hasMoreBookings: bookingsPage.hasNextPage(),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg })
  }
}
