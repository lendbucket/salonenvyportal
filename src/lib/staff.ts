/** Centralized staff constants — single source of truth for all team member IDs */

export const CC_LOCATION_ID = process.env.SQUARE_CC_LOCATION_ID || "LTJSA6QR1HGW6"
export const SA_LOCATION_ID = process.env.SQUARE_SA_LOCATION_ID || "LXJYXDXWR0XZF"

/** Record<squareTeamMemberId, displayName> for CC */
export const CC_STYLISTS_MAP: Record<string, string> = {
  TMbc13IBzS8Z43AO: "Clarissa Reyna",
  TMaExUyYaWYlvSqh: "Alexis Rodriguez",
  TMCzd3unwciKEVX7: "Kaylie Espinoza",
  TMn7kInT8g7Vrgxi: "Ashlynn Ochoa",
  TMMdDDwU8WXpCZ9m: "Jessy Blamey",
  TM_xI40vPph2_Cos: "Mia Gonzales",
}

/** Record<squareTeamMemberId, displayName> for SA */
export const SA_STYLISTS_MAP: Record<string, string> = {
  TMMJKxeQuMlMW1Dw: "Melissa Cruz",
  TM5CjcvcHRXZQ4hP: "Madelynn Martinez",
  TMcc0QbHuUZfgcIB: "Jaylee Jaeger",
  "TMfFCmgJ5RV-WCBq": "Aubree Saldana",
  TMk1YstlrnPrKw8p: "Kiyara Smith",
}

/** All team member names (CC + SA). Used as fallback lookup when Square returns a team member ID. */
export const TEAM_NAMES: Record<string, string> = {
  ...CC_STYLISTS_MAP,
  ...SA_STYLISTS_MAP,
  // Legacy IDs that may still appear in older Square bookings
  TMKwAEkzf3NN3Hiu: "Yahaira",
  TMxKBPJq29Wfrl2N: "Jasmine",
  TMr3JMjH29LqXLJp: "Briana",
  TM3eYXBb4hFwcPwA: "Priscilla",
  TMPFXkqFP7vJXRMa: "Christina",
  TM0JKR4Zq4jMNcbE: "Nayelie",
}

/** Array format for dropdowns and lists — {id, name} */
export const CC_STYLISTS = Object.entries(CC_STYLISTS_MAP).map(([id, name]) => ({ id, name }))
export const SA_STYLISTS = Object.entries(SA_STYLISTS_MAP).map(([id, name]) => ({ id, name }))

/** Location lookup: team member ID → "Corpus Christi" | "San Antonio" */
export const TEAM_MEMBER_LOCATIONS: Record<string, string> = {}
for (const id of Object.keys(CC_STYLISTS_MAP)) TEAM_MEMBER_LOCATIONS[id] = "Corpus Christi"
for (const id of Object.keys(SA_STYLISTS_MAP)) TEAM_MEMBER_LOCATIONS[id] = "San Antonio"

/** Abbreviated location lookup: team member ID → "CC" | "SA" */
export const TEAM_LOCATION_SHORT: Record<string, "CC" | "SA"> = {}
for (const id of Object.keys(CC_STYLISTS_MAP)) TEAM_LOCATION_SHORT[id] = "CC"
for (const id of Object.keys(SA_STYLISTS_MAP)) TEAM_LOCATION_SHORT[id] = "SA"

/** All active staff as array */
export const ALL_STAFF = Object.entries({ ...CC_STYLISTS_MAP, ...SA_STYLISTS_MAP }).map(([id, name]) => ({
  id,
  name,
  location: TEAM_MEMBER_LOCATIONS[id],
  locationShort: TEAM_LOCATION_SHORT[id],
}))
