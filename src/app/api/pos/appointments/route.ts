import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SquareClient, SquareEnvironment } from "square";

import { CC_LOCATION_ID, SA_LOCATION_ID, CC_STYLISTS_MAP, SA_STYLISTS_MAP, TEAM_NAMES } from "@/lib/staff";
import { getFullCache } from "@/lib/catalogCache";

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
    let filtered = allStatuses
      ? bookings
      : bookings.filter((b) => b.status === "ACCEPTED" || b.status === "PENDING");

    // Filter by location's stylists — only show team members belonging to the selected location
    const locationStylistIds = locationId === CC_LOCATION_ID
      ? new Set(Object.keys(CC_STYLISTS_MAP))
      : new Set(Object.keys(SA_STYLISTS_MAP));
    if (!teamMemberFilter) {
      filtered = filtered.filter(b => {
        const tmId = b.appointmentSegments?.[0]?.teamMemberId;
        return !tmId || locationStylistIds.has(tmId);
      });
    }

    // Load shared catalog cache for service names
    const sharedCatalog = getFullCache();

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

          if (varId && sharedCatalog[varId]) {
            const cached = sharedCatalog[varId];
            services.push({ serviceName: cached.name, price: cached.price, durationMinutes: dur || cached.durationMinutes, serviceVariationId: varId });
          } else {
            services.push({ serviceName: "Service", price: 0, durationMinutes: dur, serviceVariationId: varId || "" });
          }
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

    // Check for completed orders — fetch from BOTH locations since all payments go through SA
    // SALONTRANSACT: Currently powered by Square API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ordersByCustomer: Record<string, any> = {};
    try {
      const ordersRes = await square.orders.search({
        locationIds: [CC_LOCATION_ID, SA_LOCATION_ID],
        query: {
          filter: {
            dateTimeFilter: { closedAt: { startAt: startOfDay.toISOString(), endAt: new Date(endOfDay.getTime() + 12 * 60 * 60 * 1000).toISOString() } },
            stateFilter: { states: ["COMPLETED"] },
          },
        },
        limit: 200,
      });
      for (const o of (ordersRes.orders || [])) {
        if (o.customerId) {
          // Keep the most recent order per customer
          if (!ordersByCustomer[o.customerId] || new Date(o.closedAt || "").getTime() > new Date(ordersByCustomer[o.customerId].closedAt || "").getTime()) {
            ordersByCustomer[o.customerId] = o;
          }
        }
      }
    } catch {
      // Orders lookup failed — skip checkout detection
    }

    const enrichedAppointments = appointments.map(appt => {
      let isCheckedOut = false;
      let orderId: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let checkoutDetails: any = null;

      if (appt.customerId && ordersByCustomer[appt.customerId]) {
        const order = ordersByCustomer[appt.customerId];
        const bookingTime = new Date(appt.startTime || "").getTime();
        const orderTime = new Date(order.closedAt || order.createdAt || "").getTime();
        const diffH = Math.abs(orderTime - bookingTime) / (1000 * 60 * 60);

        if (diffH < 12) {
          isCheckedOut = true;
          orderId = order.id;

          // Build checkout details
          const lineItems = (order.lineItems || []).map((li: { name?: string; grossSalesMoney?: { amount?: bigint | number } }) => ({
            name: li.name || "Service",
            price: Number(li.grossSalesMoney?.amount || 0) / 100,
          }));
          const subtotal = lineItems.reduce((s: number, li: { price: number }) => s + li.price, 0);
          const tips = Number(order.totalTipMoney?.amount || 0) / 100;
          const tax = Number(order.totalTaxMoney?.amount || 0) / 100;
          const total = Number(order.totalMoney?.amount || 0) / 100;

          // Payment method from tenders
          let paymentMethod = "Card";
          const tender = order.tenders?.[0];
          if (tender) {
            if (tender.type === "CASH") paymentMethod = "Cash";
            else if (tender.type === "WALLET") paymentMethod = "Apple Pay";
            else if (tender.cardDetails?.card) {
              const card = tender.cardDetails.card;
              const brand = (card.cardBrand || "Card").replace(/_/g, " ");
              paymentMethod = `${brand} •••• ${card.last4 || "****"}`;
            }
          }

          checkoutDetails = { services: lineItems, subtotal, tips, tax, total, paymentMethod, closedAt: order.closedAt };
        }
      }

      return { ...appt, isCheckedOut, ...(orderId ? { orderId } : {}), ...(checkoutDetails ? { checkoutDetails } : {}) };
    });

    return NextResponse.json({ appointments: enrichedAppointments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ appointments: [], error: msg }, { status: 500 });
  }
}
