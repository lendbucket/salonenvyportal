interface ClientData {
  firstName: string | null
  lastName: string | null
  lastVisitAt: Date | null
}

interface StylistData {
  name: string
}

interface SalonContext {
  locationName: string
}

export function personalizeBody(
  template: string,
  client: ClientData,
  stylist?: StylistData,
  salonContext?: SalonContext
): string {
  const firstName = client.firstName || "there"
  const lastName = client.lastName || ""
  const fullName = `${firstName} ${lastName}`.trim()
  const stylistName = stylist?.name || "your stylist"
  const locationName = salonContext?.locationName || "Salon Envy"
  const lastVisit = client.lastVisitAt
    ? client.lastVisitAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "your last visit"

  let body = template
    .replace(/\{first_name\}/gi, firstName)
    .replace(/\{last_name\}/gi, lastName)
    .replace(/\{full_name\}/gi, fullName)
    .replace(/\{stylist_name\}/gi, stylistName)
    .replace(/\{location_name\}/gi, locationName)
    .replace(/\{last_visit\}/gi, lastVisit)

  // Compliance: ensure STOP footer is present
  if (!body.toLowerCase().includes("reply stop")) {
    body += " Reply STOP to opt out."
  }

  return body
}

/** Calculate SMS segment count (GSM-7 = 160 chars / segment, Unicode = 70 chars / segment) */
export function segmentCount(body: string): number {
  // eslint-disable-next-line no-control-regex
  const isGSM = /^[\x00-\x7F\u00A0-\u00FF]*$/.test(body)
  const limit = isGSM ? 160 : 70
  const concat = isGSM ? 153 : 67 // concatenated message segment size
  if (body.length <= limit) return 1
  return Math.ceil(body.length / concat)
}
