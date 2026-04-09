import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SquareClient, SquareEnvironment } from "square";

import { CC_LOCATION_ID, SA_LOCATION_ID } from "@/lib/staff";

const LOCATION_MAP: Record<string, string> = {
  "Corpus Christi": CC_LOCATION_ID,
  "San Antonio": SA_LOCATION_ID,
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

  // Date param support — default to today
  const dateParam = request.nextUrl.searchParams.get("date");
  const allStatuses = request.nextUrl.searchParams.get("all") === "true";

  let startOfDay: Date;
  let endOfDay: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split("-").map(Number);
    startOfDay = new Date(y, m - 1, d);
    endOfDay = new Date(y, m - 1, d + 1);
  } else {
    const now = new Date();
    startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
  }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBookings: any[] = [];
    let bookingsPage = await square.bookings.list(listParams as Parameters<typeof square.bookings.list>[0]);
    for (const b of bookingsPage.data) allBookings.push(b);
    while (bookingsPage.hasNextPage()) {
      bookingsPage = await bookingsPage.getNextPage();
      for (const b of bookingsPage.data) allBookings.push(b);
    }
    const bookings = allBookings;

    // Filter by status unless ?all=true
    const filtered = allStatuses
      ? bookings
      : bookings.filter((b) => b.status === "ACCEPTED" || b.status === "PENDING");

    // Cache for catalog lookups to avoid duplicate fetches
    const catalogCache = new Map<string, { serviceName: string; price: number; durationMinutes: number }>();

    // Fetch customer details and service info
    const appointments = await Promise.all(
      filtered.slice(0, 30).map(async (booking) => {
        let customerName = "Walk-in";
        let customerPhone = "";
        let customerEmail = "";

        if (booking.customerId) {
          try {
            const custRes = await square.customers.get({ customerId: booking.customerId });
            if (custRes.customer) {
              const c = custRes.customer;
              customerName = [c.givenName, c.familyName].filter(Boolean).join(" ") || "Client";
              customerPhone = c.phoneNumber || "";
              customerEmail = c.emailAddress || "";
            }
          } catch {
            // Customer lookup failed
          }
        }

        // Build services array from appointment segments
        const segments = booking.appointmentSegments || [];
        const services: { serviceName: string; price: number; durationMinutes: number; serviceVariationId?: string }[] = [];

        for (const seg of segments) {
          const varId = seg.serviceVariationId;
          const dur = seg.durationMinutes ?? 0;

          if (varId && catalogCache.has(varId)) {
            const cached = catalogCache.get(varId)!;
            services.push({ ...cached, serviceVariationId: varId });
            continue;
          }

          let serviceName = "Service";
          let price = 0;

          if (varId) {
            try {
              const catRes = await square.catalog.object.get({ objectId: varId });
              const obj = catRes.object as unknown as Record<string, unknown>;
              if (obj) {
                const varData = obj.itemVariationData as Record<string, unknown> | undefined;
                if (varData) {
                  serviceName = (varData.name as string) || "Service";
                  const priceMoney = varData.priceMoney as { amount?: bigint | number } | undefined;
                  if (priceMoney?.amount != null) {
                    price = Number(priceMoney.amount) / 100;
                  }
                }
              }
            } catch {
              // Catalog lookup failed — use defaults
            }
            catalogCache.set(varId, { serviceName, price, durationMinutes: dur });
          }

          services.push({ serviceName, price, durationMinutes: dur, serviceVariationId: varId || "" });
        }

        // Calculate endTime from startTime + total segment durations
        const totalDurationMin = services.reduce((sum, s) => sum + s.durationMinutes, 0);
        let endTime: string | null = null;
        if (booking.startAt && totalDurationMin > 0) {
          const start = new Date(booking.startAt);
          endTime = new Date(start.getTime() + totalDurationMin * 60000).toISOString();
        }

        // Calculate totalPrice from service prices
        const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

        return {
          id: booking.id,
          customerId: booking.customerId || null,
          customerName,
          customerPhone,
          customerEmail,
          startTime: booking.startAt,
          endTime,
          teamMemberId: segments[0]?.teamMemberId || null,
          status: booking.status,
          services,
          totalPrice,
          totalDurationMinutes: totalDurationMin,
          note: booking.customerNote || null,
        };
      })
    );

    // Check for completed orders matching each appointment (checked-out detection)
    let completedOrders: Array<{ id?: string; createdAt?: string }> = [];
    try {
      const ordersRes = await square.orders.search({
        locationIds: [locationId],
        query: {
          filter: {
            dateTimeFilter: { createdAt: { startAt: startOfDay.toISOString(), endAt: new Date(endOfDay.getTime() + 4 * 60 * 60 * 1000).toISOString() } },
            stateFilter: { states: ["COMPLETED"] },
          },
        },
        limit: 200,
      });
      completedOrders = (ordersRes.orders || []).map(o => ({ id: o.id, createdAt: o.createdAt }));
    } catch {
      // Orders lookup failed — skip checkout detection
    }

    const enrichedAppointments = appointments.map(appt => {
      let isCheckedOut = false;
      let orderId: string | undefined;
      if (appt.startTime && completedOrders.length > 0) {
        const apptStart = new Date(appt.startTime).getTime();
        for (const order of completedOrders) {
          if (!order.createdAt) continue;
          const orderTime = new Date(order.createdAt).getTime();
          const diffHours = (orderTime - apptStart) / (1000 * 60 * 60);
          if (diffHours >= -0.5 && diffHours <= 4) {
            isCheckedOut = true;
            orderId = order.id;
            break;
          }
        }
      }
      return { ...appt, isCheckedOut, ...(orderId ? { orderId } : {}) };
    });

    return NextResponse.json({ appointments: enrichedAppointments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ appointments: [], error: msg }, { status: 500 });
  }
}
