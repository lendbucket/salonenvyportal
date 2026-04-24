/**
 * Appointment Status Resolver
 *
 * Cross-references Square Orders with Square Bookings to determine true checkout status.
 * Square Bookings API keeps status as ACCEPTED even after POS checkout completes an order.
 * This module resolves the actual status by matching completed orders to bookings.
 */

export type ResolvedAppointmentStatus =
  | "ACCEPTED"       // Booked, past appointment time, not yet checked out
  | "CHECKED_OUT"    // Has a completed Square order
  | "CANCELLED"      // Cancelled by client or salon
  | "NO_SHOW"        // Marked no-show
  | "IN_PROGRESS"    // Appointment time has started but not ended and not checked out
  | "UPCOMING"       // Future appointment

export interface ResolvedAppointment {
  bookingId: string
  squareOrderId?: string
  status: ResolvedAppointmentStatus
  checkedOutAt?: string
  totalAmount?: number
  paymentMethod?: string
  last4?: string
}

/**
 * Given already-fetched bookings and orders, resolve the true status of each booking.
 * This does NOT make any Square API calls — the caller must provide the data.
 */
export function resolveStatuses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookings: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completedOrders: any[],
): Map<string, ResolvedAppointment> {
  const resolved = new Map<string, ResolvedAppointment>()
  const now = new Date()

  // Build lookup: customerId → orders for that customer, sorted by closedAt ASC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersByCustomer = new Map<string, any[]>()
  for (const order of completedOrders) {
    if (order.customerId) {
      if (!ordersByCustomer.has(order.customerId)) {
        ordersByCustomer.set(order.customerId, [])
      }
      ordersByCustomer.get(order.customerId)!.push(order)
    }
  }

  // Helper: get CST calendar date string for same-day comparison
  function getCSTDate(d: Date): string {
    return d.toLocaleDateString("en-US", { timeZone: "America/Chicago" })
  }

  const usedOrderIds = new Set<string>()

  for (const booking of bookings) {
    const bookingId = booking.id
    if (!bookingId) continue

    // Handle cancellations and no-shows from booking status
    if (booking.status === "CANCELLED_BY_CUSTOMER" || booking.status === "CANCELLED_BY_SELLER") {
      resolved.set(bookingId, { bookingId, status: "CANCELLED" })
      continue
    }
    if (booking.status === "NO_SHOW") {
      resolved.set(bookingId, { bookingId, status: "NO_SHOW" })
      continue
    }

    const bookingStartAt = new Date(booking.startAt || "")
    const durationMs = (booking.appointmentSegments?.[0]?.durationMinutes || 60) * 60 * 1000
    const bookingEndAt = new Date(bookingStartAt.getTime() + durationMs)
    const bookingCSTDate = getCSTDate(bookingStartAt)
    const bookingTime = bookingStartAt.getTime()
    const customerId = booking.customerId

    // Try to match with a completed order
    let matchedOrder = null

    if (customerId && ordersByCustomer.has(customerId)) {
      const customerOrders = ordersByCustomer.get(customerId)!
      let bestDiff = Infinity

      for (const order of customerOrders) {
        if (usedOrderIds.has(order.id)) continue
        const orderClosedAt = new Date(order.closedAt || order.createdAt || "")
        const orderCSTDate = getCSTDate(orderClosedAt)
        const orderTime = orderClosedAt.getTime()

        // Must be same CST calendar day and order closed at or after booking start
        if (bookingCSTDate !== orderCSTDate) continue
        if (orderTime < bookingTime) continue

        const diff = orderTime - bookingTime
        if (diff < bestDiff) {
          bestDiff = diff
          matchedOrder = order
        }
      }
    }

    if (matchedOrder) {
      usedOrderIds.add(matchedOrder.id)
      const tender = matchedOrder.tenders?.[0]
      let paymentMethod = "Card"
      let last4: string | undefined

      if (tender) {
        if (tender.type === "CASH") {
          paymentMethod = "Cash"
        } else if (tender.type === "WALLET") {
          paymentMethod = "Apple Pay"
        } else if (tender.cardDetails?.card) {
          const card = tender.cardDetails.card
          const brand = (card.cardBrand || card.brand || "Card").replace(/_/g, " ")
          paymentMethod = brand
          last4 = card.last4 || card.lastFour || undefined
        }
      }

      resolved.set(bookingId, {
        bookingId,
        squareOrderId: matchedOrder.id,
        status: "CHECKED_OUT",
        checkedOutAt: matchedOrder.closedAt,
        totalAmount: Number(matchedOrder.totalMoney?.amount || 0) / 100,
        paymentMethod,
        last4,
      })
      continue
    }

    // No matching order — determine status from time
    if (bookingStartAt > now) {
      resolved.set(bookingId, { bookingId, status: "UPCOMING" })
    } else if (now >= bookingStartAt && now <= bookingEndAt) {
      resolved.set(bookingId, { bookingId, status: "IN_PROGRESS" })
    } else {
      // Past appointment, no checkout found
      resolved.set(bookingId, { bookingId, status: "ACCEPTED" })
    }
  }

  // Strategy 3: Time-based matching for orders without customerId
  for (const order of completedOrders) {
    if (!order.customerId && !usedOrderIds.has(order.id)) {
      const closedAt = order.closedAt ? new Date(order.closedAt) : null
      if (!closedAt) continue

      for (const booking of bookings) {
        const existing = resolved.get(booking.id)
        if (!existing || existing.status !== "ACCEPTED") continue

        const bookingStart = new Date(booking.startAt)
        const segDuration = booking.appointmentSegments?.[0]?.durationMinutes || 60
        const bookingEnd = new Date(bookingStart.getTime() + segDuration * 60000)
        const bookingLocationId = booking.locationId

        // Match: same location + order closed within booking window + 3 hour grace
        const windowEnd = new Date(bookingEnd.getTime() + 3 * 60 * 60 * 1000)
        if (order.locationId === bookingLocationId && closedAt >= bookingStart && closedAt <= windowEnd) {
          const tender = order.tenders?.[0]
          resolved.set(booking.id, {
            bookingId: booking.id,
            squareOrderId: order.id,
            status: "CHECKED_OUT",
            checkedOutAt: order.closedAt,
            totalAmount: Number(order.totalMoney?.amount || 0) / 100,
            paymentMethod: tender?.type || "CARD",
            last4: tender?.cardDetails?.card?.last4,
          })
          usedOrderIds.add(order.id)
          break
        }
      }
    }
  }

  // Log unmatched orders for debugging
  const unmatchedOrders = completedOrders.filter(o => !usedOrderIds.has(o.id))
  if (unmatchedOrders.length > 0) {
    console.log(`[appt-status] ${unmatchedOrders.length} unmatched orders:`, unmatchedOrders.map(o => ({
      id: o.id, closedAt: o.closedAt, customerId: o.customerId,
      total: Number(o.totalMoney?.amount || 0) / 100,
    })))
  }

  return resolved
}
