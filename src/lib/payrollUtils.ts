export function getCurrentPayPeriod(): { start: Date; end: Date } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour12: false })
  const parts = formatter.formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "0"
  const year = parseInt(get("year")), month = parseInt(get("month")) - 1, day = parseInt(get("day"))
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dow = wdMap[get("weekday")] ?? 0
  const daysBack = (dow + 7 - 3) % 7
  const wedLocal = new Date(year, month, day - daysBack, 0, 0, 0, 0)
  const tueLocal = new Date(year, month, day - daysBack + 6, 23, 59, 59, 999)
  const toUTC = (d: Date) => { const u = new Date(d.toLocaleString("en-US", { timeZone: "UTC" })); const c = new Date(d.toLocaleString("en-US", { timeZone: "America/Chicago" })); return new Date(d.getTime() + (u.getTime() - c.getTime())) }
  return { start: toUTC(wedLocal), end: toUTC(tueLocal) }
}

export function getPreviousPayPeriod(weeksBack: number = 1): { start: Date; end: Date } {
  const c = getCurrentPayPeriod(); const off = weeksBack * 7 * 24 * 60 * 60 * 1000
  return { start: new Date(c.start.getTime() - off), end: new Date(c.end.getTime() - off) }
}

export function formatPeriodLabel(start: Date, end: Date): string {
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "America/Chicago" }
  return `${start.toLocaleDateString("en-US", o)} – ${end.toLocaleDateString("en-US", { ...o, year: "numeric" })}`
}

export function getPayDay(periodEnd: Date): string {
  return periodEnd.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" })
}

export const TEAM_MEMBERS: Record<string, { name: string; location: string; isManager: boolean }> = {
  TMbc13IBzS8Z43AO: { name: "Clarissa Reyna", location: "CC", isManager: true },
  TMaExUyYaWYlvSqh: { name: "Alexis", location: "CC", isManager: false },
  TMCzd3unwciKEVX7: { name: "Kaylie", location: "CC", isManager: false },
  TMn7kInT8g7Vrgxi: { name: "Ashlynn", location: "CC", isManager: false },
  TMMdDDwU8WXpCZ9m: { name: "Jessy", location: "CC", isManager: false },
  TM_xI40vPph2_Cos: { name: "Mia", location: "CC", isManager: false },
  TMMJKxeQuMlMW1Dw: { name: "Melissa Cruz", location: "SA", isManager: true },
  TM5CjcvcHRXZQ4hP: { name: "Madelynn", location: "SA", isManager: false },
  TMcc0QbHuUZfgcIB: { name: "Jaylee", location: "SA", isManager: false },
  "TMfFCmgJ5RV-WCBq": { name: "Aubree", location: "SA", isManager: false },
  TMk1YstlrnPrKw8p: { name: "Kiyara", location: "SA", isManager: false },
}

export const CC_LOCATION_ID = "LTJSA6QR1HGW6"
export const SA_LOCATION_ID = "LXJYXDXWR0XZF"
