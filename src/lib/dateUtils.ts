/**
 * CST timezone utilities for Square API date ranges.
 * All "today" calculations use CST (UTC-5 standard, UTC-6 CDT).
 * Uses America/Chicago timezone for proper DST handling.
 */

export function getTodayRangeUTC() {
  const now = new Date()
  // Get today's date in CST
  const cstDate = now.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const [m, d, y] = cstDate.split("/")
  // CST midnight boundaries — use -06:00 for CDT awareness
  // (toISOString will handle the UTC conversion)
  const start = new Date(`${y}-${m}-${d}T00:00:00-06:00`)
  const end = new Date(`${y}-${m}-${d}T23:59:59-06:00`)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export function getDateRangeUTC(dateStr: string) {
  // dateStr format: "YYYY-MM-DD" interpreted as CST
  const start = new Date(dateStr + "T00:00:00-06:00")
  const end = new Date(dateStr + "T23:59:59-06:00")
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}
