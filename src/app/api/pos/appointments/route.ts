import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SquareClient, SquareEnvironment } from "square";

const LOCATION_MAP: Record<string, string> = {
  "Corpus Christi": "LTJSA6QR1HGW6",
  "San Antonio": "LXJYXDXWR0XZF",
};

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as Record<string, unknown>;
  const role = user.role as string;
  const userId = user.id as string;

  const square = getSquare();

  // Determine location and optional team member filter
  let locationId: string | undefined;
  let teamMemberFilter: string | undefined;

  if (role === "STYLIST") {
    // Find their StaffMember record
    const staff = await prisma.staffMember.findFirst({
      where: { userId },
      include: { location: true },
    });
    if (!staff?.squareTeamMemberId) {
      return NextResponse.json({ appointments: [], error: "No team member linked" });
    }
    teamMemberFilter = staff.squareTeamMemberId;
    locationId = staff.location.squareLocationId;
  } else if (role === "MANAGER") {
    const userLocationId = user.locationId as string | undefined;
    if (userLocationId) {
      const loc = await prisma.location.findUnique({ where: { id: userLocationId } });
      if (loc) locationId = loc.squareLocationId;
    }
  } else if (role === "OWNER") {
    const locParam = request.nextUrl.searchParams.get("location");
    if (locParam && LOCATION_MAP[locParam]) {
      locationId = LOCATION_MAP[locParam];
    }
  }

  // Default to CC if no location resolved
  if (!locationId) locationId = "LTJSA6QR1HGW6";

  // Get today's date range
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  try {
    const listParams: Record<string, unknown> = {
      startAtMin: startOfDay.toISOString(),
      startAtMax: endOfDay.toISOString(),
      locationId,
      limit: 50,
    };
    if (teamMemberFilter) {
      listParams.teamMemberId = teamMemberFilter;
    }

    const bookingsPage = await square.bookings.list(listParams as Parameters<typeof square.bookings.list>[0]);
    const bookings = bookingsPage.data || [];

    // Fetch customer details for first 20 bookings
    const appointments = await Promise.all(
      bookings.slice(0, 20).map(async (booking) => {
        let customerName = "Walk-in";
        let customerPhone = "";

        if (booking.customerId) {
          try {
            const custRes = await square.customers.get({ customerId: booking.customerId });
            if (custRes.customer) {
              const c = custRes.customer;
              customerName = [c.givenName, c.familyName].filter(Boolean).join(" ") || "Client";
              customerPhone = c.phoneNumber || "";
            }
          } catch {
            // Customer lookup failed — use fallback
          }
        }

        return {
          id: booking.id,
          customerName,
          customerPhone,
          startTime: booking.startAt,
          teamMemberId: booking.appointmentSegments?.[0]?.teamMemberId || null,
          status: booking.status,
        };
      })
    );

    return NextResponse.json({ appointments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ appointments: [], error: msg }, { status: 500 });
  }
}
