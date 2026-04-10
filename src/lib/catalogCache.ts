// Static catalog cache — hardcoded from Square catalog
// Last updated: April 2026
// To update: run the catalog debug endpoint and paste new values

export const CATALOG: Record<string, { name: string; price: number; durationMinutes: number }> = {
  // Cuts
  "POE6SDZB3ISP2MPUO6TV2K3T": { name: "Envy Cut®", price: 85, durationMinutes: 45 },
  "QMPSENCSASW4UIOPTQFJPUED": { name: "Envy Dry Cut®", price: 70, durationMinutes: 30 },
  "EZ6V2LLLWT4MZSZUNVPMDJN7": { name: "Envy Men's Haircut®", price: 35, durationMinutes: 30 },
  "DDCKYSU2WSDSDJSFQLXS2KSD": { name: "Envy Children's Cut®", price: 43, durationMinutes: 30 },
  "MRIUJBOXXNIJKWJGWUVIQNI6": { name: "Bang Trim", price: 12, durationMinutes: 15 },
  "KEIPWOBHQM5AJ6D2YA4OKWBB": { name: "Envy Trim®", price: 35, durationMinutes: 30 },
  "WZGEY6FQD4FBHPOW44YENGQY": { name: "Envy Men's Trim®", price: 25, durationMinutes: 20 },
  "YN5ZLP5KFYK4FRUZZ5WETXQV": { name: "Envy Children's Trim®", price: 20, durationMinutes: 20 },
  "RUTBAQ35T3VIWN2N7XQQJL2S": { name: "Envy Dry Cut® + Style", price: 85, durationMinutes: 30 },

  // Color
  "3N3MWKKUO5ZLSPRV77K6SX4Z": { name: "Full Highlight", price: 210, durationMinutes: 270 },
  "3UI5L7VG7WWPD3KJDSMECBYE": { name: "Partial Highlight", price: 165, durationMinutes: 120 },
  "KIEQ7NE6EKITICOUCKGVAO3K": { name: "Partial Highlight & Base Color", price: 200, durationMinutes: 150 },
  "MYWNX5PWUQU34FPT5VRUS7KJ": { name: "Envy Color®", price: 110, durationMinutes: 95 },
  "SV4PGKMCWEKTSWGIGUQX6ZVE": { name: "Color Touch Up", price: 130, durationMinutes: 90 },
  "2UIPZ6UL2E3BCPDKW57FST74": { name: "Blonde Touch Up", price: 155, durationMinutes: 150 },
  "2TDK7VZIKPB6IVRVKZS53Y2W": { name: "Envy Blonde®", price: 265, durationMinutes: 150 },
  "HIVCZWVEXFWHUQXI6FMAE5PK": { name: "Full Highlight & Base Color", price: 240, durationMinutes: 240 },
  "STMYYY7OH5IIEIOSV5U5ZNQM": { name: "Wedding Updo", price: 150, durationMinutes: 60 },
  "EPHRYYHYKXOUS3AMWBVMWLVW": { name: "Toner", price: 130, durationMinutes: 45 },
  "KCBATXZWQ5WJ2MQKD6CZMJL6": { name: "Envy Gloss®", price: 55, durationMinutes: 30 },
  "PHC4JW6TWTLLI3YREQ2Q3VHM": { name: "Brazilian Blowout", price: 250, durationMinutes: 180 },

  // Add-ons
  "W2PGQF37TRD63JZN6GKSR7WC": { name: "Extra Bowl - Bleach", price: 53, durationMinutes: 30 },
  "4PK44QOV5RZFMWKK5NBXASNK": { name: "Extra Bowl - Color", price: 40, durationMinutes: 30 },
  "64LUY6AYVAD6M4GT4H5ELQZL": { name: "Extra Bowl", price: 53, durationMinutes: 30 },
  "NY6PW3FTWO74QTZ2W3L47TKX": { name: "Extra Bowl - Toner", price: 53, durationMinutes: 30 },
  "7SUXOQACVU6RPNGN33S4YXQQ": { name: "Envy Treatment®", price: 15, durationMinutes: 10 },
  "YWBAGHCQOFEO267RSWUPTKLN": { name: "Brow Wax", price: 25, durationMinutes: 10 },
  "V6GZJJ3UAVNWD4QDY5MNM5ET": { name: "Olaplex 4c Hair Treatment", price: 20, durationMinutes: 15 },
  "B2ABXNFZP24OLVGNOZCFJQMR": { name: "Envy Scalp Treatment®", price: 25, durationMinutes: 20 },
}

export function getServiceName(variationId: string): string {
  return CATALOG[variationId]?.name || "Service"
}

export function getServicePrice(variationId: string): number {
  return CATALOG[variationId]?.price || 0
}

export function getServiceDuration(variationId: string): number {
  return CATALOG[variationId]?.durationMinutes || 0
}

export function getServiceInfo(variationId: string): { name: string; price: number; durationMinutes: number } {
  return CATALOG[variationId] || { name: "Service", price: 0, durationMinutes: 0 }
}

export function getFullCache(): Record<string, { name: string; price: number; durationMinutes: number }> {
  return CATALOG
}

// Backward compatibility stubs
export async function refreshCatalogCache(): Promise<void> {}
export async function getBulkServiceNames(ids: string[]): Promise<Record<string, string>> {
  return Object.fromEntries(ids.map(id => [id, getServiceName(id)]))
}
export async function fetchVariationDirect(variationId: string): Promise<{ name: string; price: number; durationMinutes: number }> {
  return CATALOG[variationId] || { name: "Service", price: 0, durationMinutes: 0 }
}
