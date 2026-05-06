export type AudienceFilter =
  | { type: "ALL_CLIENTS" }
  | { type: "BY_LOCATION"; locationIds: string[] }
  | { type: "BY_STYLIST"; stylistIds: string[] }
  | { type: "BY_LAST_VISIT"; daysSinceLastVisit: number; operator: "GT" | "LT" }
  | { type: "BY_VISIT_COUNT"; minVisits?: number; maxVisits?: number }
  | { type: "BY_TOTAL_SPEND"; minSpend?: number; maxSpend?: number }
  | { type: "BY_SERVICE"; serviceCategoryIds: string[]; withinDays: number }
  | { type: "BY_BIRTHDAY_MONTH"; month?: number }
  | { type: "MANUAL"; clientIds: string[] }
  | { type: "AND"; filters: AudienceFilter[] }
  | { type: "OR"; filters: AudienceFilter[] }
