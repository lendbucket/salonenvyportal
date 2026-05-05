import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SquareClient, SquareEnvironment } from "square";

import { CC_LOCATION_ID, SA_LOCATION_ID, CC_STYLISTS_MAP, SA_STYLISTS_MAP, TEAM_NAMES } from "@/lib/staff";
import { getFullCache } from "@/lib/catalogCache";
import { resolveStatuses } from "@/lib/square-appointment-status";

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
    if (locParam) {
      const lp = locParam.toLowerCase();
      if (lp === "cc" || lp.includes("corpus") || locParam === CC_LOCATION_ID) {
        locationId = CC_LOCATION_ID;
      } else if (lp === "sa" || lp.includes("san") || locParam === SA_LOCATION_ID) {
        locationId = SA_LOCATION_ID;
      } else if (LOCATION_MAP[locParam]) {
        locationId = LOCATION_MAP[locParam];
      }
    }
  }

  // Default to CC if no location resolved
  if (!locationId) locationId = CC_LOCATION_ID;

  // Date param support — single date OR date range for week/month views
  const dateParam = request.nextUrl.searchParams.get("date");
  const startDateParam = request.nextUrl.searchParams.get("startDate");
  const endDateParam = request.nextUrl.searchParams.get("endDate");
  const allStatuses = request.nextUrl.searchParams.get("all") === "true";

  let startOfDay: Date;
  let endOfDay: Date;
  if (startDateParam && endDateParam && /^\d{4}-\d{2}-\d{2}$/.test(startDateParam) && /^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) {
    const [sy, sm, sd] = startDateParam.split("-").map(Number);
    const [ey, em, ed] = endDateParam.split("-").map(Number);
    startOfDay = new Date(sy, sm - 1, sd);
    endOfDay = new Date(ey, em - 1, ed + 1);
  } else if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
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
    // Fetch bookings from BOTH Square locations for cross-location coverage
    // A stylist's appointments belong to their HOME location regardless of where booked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBookings: any[] = [];
    for (const locId of [CC_LOCATION_ID, SA_LOCATION_ID]) {
      const listParams: Record<string, unknown> = {
        startAtMin: startOfDay.toISOString(),
        startAtMax: endOfDay.toISOString(),
        locationId: locId,
        limit: 50,
      };
      if (teamMemberFilter) listParams.teamMemberId = teamMemberFilter;

      let bookingsPage = await square.bookings.list(listParams as Parameters<typeof square.bookings.list>[0]);
      for (const b of bookingsPage.data) allBookings.push(b);
      while (bookingsPage.hasNextPage()) {
        bookingsPage = await bookingsPage.getNextPage();
        for (const b of bookingsPage.data) allBookings.push(b);
      }
    }

    // Deduplicate by booking ID (same booking may appear at both locations)
    console.log("[appointments-api] Raw bookings count:", allBookings.length);
    const bookingIdMap = new Map<string, typeof allBookings[0]>();
    for (const b of allBookings) {
      if (b.id && !bookingIdMap.has(b.id)) bookingIdMap.set(b.id, b);
    }
    const bookings = Array.from(bookingIdMap.values());
    console.log("[appointments-api] Unique bookings count:", bookings.length);
    if (allBookings.length !== bookings.length) {
      console.warn("[appointments-api] DUPLICATES REMOVED:", allBookings.length - bookings.length);
    }

    // Filter by status unless ?all=true
    let filtered = allStatuses
      ? bookings
      : bookings.filter((b) => b.status === "ACCEPTED" || b.status === "PENDING");

    // Filter by team member's HOME location (not booking's physical Square location)
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

    const isRangeQuery = !!(startDateParam && endDateParam);
    const isBrief = request.nextUrl.searchParams.get("brief") === "true";
    const maxResults = isRangeQuery ? 200 : 30;
    const bookingsToEnrich = filtered.slice(0, maxResults);

    console.log("[appointments route]", { isRangeQuery, isBrief, totalFiltered: filtered.length, enriching: bookingsToEnrich.length });

    // Batch-fetch customer names (much faster than per-booking lookups)
    const customerCache: Record<string, { name: string; phone: string; email: string }> = {};
    const uniqueCustomerIds = [...new Set(bookingsToEnrich.map(b => b.customerId).filter(Boolean))] as string[];
    const BATCH_SIZE = 10;
    for (let i = 0; i < uniqueCustomerIds.length; i += BATCH_SIZE) {
      const batch = uniqueCustomerIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (cid) => {
        try {
          const custRes = await square.customers.get({ customerId: cid });
          if (custRes.customer) {
            const c = custRes.customer;
            customerCache[cid] = {
              name: [c.givenName, c.familyName].filter(Boolean).join(" ") || "Client",
              phone: c.phoneNumber || "",
              email: c.emailAddress || "",
            };
          }
        } catch { /* skip */ }
      }));
    }

    // Build appointments from bookings + cached customer data + catalog
    const appointments = bookingsToEnrich.map((booking) => {
      const cust = booking.customerId ? customerCache[booking.customerId] : null;
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

      const totalDurationMin = services.reduce((sum, s) => sum + s.durationMinutes, 0);
      let endTime: string | null = null;
      if (booking.startAt && totalDurationMin > 0) {
        endTime = new Date(new Date(booking.startAt).getTime() + totalDurationMin * 60000).toISOString();
      }

      return {
        id: booking.id,
        customerId: booking.customerId || null,
        customerName: cust?.name || (booking.customerId ? "Client" : "Walk-in"),
        customerPhone: cust?.phone || "",
        customerEmail: cust?.email || "",
        startTime: booking.startAt,
        endTime,
        teamMemberId: segments[0]?.teamMemberId || null,
        status: booking.status,
        services,
        totalPrice: services.reduce((sum, s) => sum + s.price, 0),
        totalDurationMinutes: totalDurationMin,
        note: booking.customerNote || null,
      };
    });

    // For brief/range queries (month view), skip checkout detection — dedup and return
    if (isBrief) {
      // Dedup by ID
      const briefMap = new Map<string, typeof appointments[0]>();
      for (const a of appointments) { if (!briefMap.has(a.id)) briefMap.set(a.id, a); }
      const briefResult = Array.from(briefMap.values());
      console.log("[appointments route] brief mode — returning", briefResult.length, "appointments");
      return NextResponse.json({ appointments: briefResult });
    }

    // ── Cross-reference with completed Square orders to resolve true status ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let completedOrders: any[] = [];
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
      completedOrders = ordersRes.orders || [];
    } catch {
      // Orders lookup failed — statuses will fall back to time-based
    }

    // Deduplicate orders by ID
    const orderIdsSeen = new Set<string>();
    completedOrders = completedOrders.filter(o => {
      if (!o.id || orderIdsSeen.has(o.id)) return false;
      orderIdsSeen.add(o.id);
      return true;
    });

    // Build raw booking objects for resolver (it needs startAt, appointmentSegments, customerId, status, id)
    const rawBookingsForResolver = bookingsToEnrich.map(b => ({
      id: b.id,
      startAt: b.startAt,
      customerId: b.customerId,
      status: b.status,
      appointmentSegments: b.appointmentSegments,
    }));

    // Resolve true statuses
    const statusMap = resolveStatuses(rawBookingsForResolver, completedOrders);

    // Build order lookup for checkout details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ordersById = new Map<string, any>();
    for (const o of completedOrders) {
      if (o.id) ordersById.set(o.id, o);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function buildCheckoutDetails(order: any) {
      const lineItems = (order.lineItems || []).map((li: { name?: string; grossSalesMoney?: { amount?: bigint | number } }) => ({
        name: li.name || "Service",
        price: Number(li.grossSalesMoney?.amount || 0) / 100,
      }));
      const subtotal = lineItems.reduce((s: number, li: { price: number }) => s + li.price, 0);
      const tips = Number(order.totalTipMoney?.amount || 0) / 100;
      const tax = Number(order.totalTaxMoney?.amount || 0) / 100;
      const total = Number(order.totalMoney?.amount || 0) / 100;
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
      return { services: lineItems, subtotal, tips, tax, total, paymentMethod, closedAt: order.closedAt, checkoutLocationId: order.locationId };
    }

    // Enrich appointments with resolved status + checkout details
    const enrichedAppointments = appointments.map(appt => {
      const resolved = statusMap.get(appt.id);
      const resolvedStatus = resolved?.status || (appt.status === "CANCELLED_BY_CUSTOMER" || appt.status === "CANCELLED_BY_SELLER" ? "CANCELLED" : appt.status);
      const isCheckedOut = resolvedStatus === "CHECKED_OUT";
      const orderId = resolved?.squareOrderId;
      const order = orderId ? ordersById.get(orderId) : null;
      const checkoutDetails = order ? buildCheckoutDetails(order) : null;

      return {
        ...appt,
        resolvedStatus,
        isCheckedOut,
        ...(orderId ? { orderId } : {}),
        ...(checkoutDetails ? { checkoutDetails } : {}),
        ...(resolved?.checkedOutAt ? { checkedOutAt: resolved.checkedOutAt } : {}),
      };
    });

    console.log("[appointments] Status breakdown:",
      enrichedAppointments.reduce((acc, a) => { acc[a.resolvedStatus] = (acc[a.resolvedStatus] || 0) + 1; return acc }, {} as Record<string, number>)
    );

    // Final deduplication pass — by booking ID, then by customerName + startTime
    const idMap = new Map<string, typeof enrichedAppointments[0]>();
    for (const a of enrichedAppointments) {
      const existing = idMap.get(a.id);
      if (!existing || (a.isCheckedOut && !existing.isCheckedOut)) {
        idMap.set(a.id, a);
      }
    }
    const dedupedFinal = Array.from(idMap.values());

    // Secondary dedup: same customer + same start time (within 5 min)
    // Prefer checked-out entry over non-checked-out when colliding
    const timeKeyMap = new Map<string, typeof dedupedFinal[0]>();
    for (const a of dedupedFinal) {
      const startMs = new Date(a.startTime || "").getTime();
      const roundedMin = Math.floor(startMs / 300000); // 5-min buckets
      const key = `${a.customerName}::${roundedMin}`;
      const existing = timeKeyMap.get(key);
      if (!existing || (a.isCheckedOut && !existing.isCheckedOut)) {
        timeKeyMap.set(key, a);
      }
    }
    const finalResult = Array.from(timeKeyMap.values());

    const removed = enrichedAppointments.length - finalResult.length;
    if (removed > 0) console.log(`[dedup] removed ${removed} duplicates, returning ${finalResult.length} appointments`);

    return NextResponse.json({ appointments: finalResult });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ appointments: [], error: msg }, { status: 500 });
  }
}
