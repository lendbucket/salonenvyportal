import { prisma } from "@/lib/prisma"

export interface TDLRResult {
  valid: boolean
  holderName?: string
  licenseNumber?: string
  licenseType?: string
  expirationDate?: string | null
  originalIssueDate?: string
  status?: string
  county?: string
  city?: string
  state?: string
  source?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawRecord?: any
  error?: string
}

// Helper to parse a CSV line respecting quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') { inQuotes = !inQuotes }
    else if (char === "," && !inQuotes) { result.push(current); current = "" }
    else { current += char }
  }
  result.push(current)
  return result
}

export async function verifyTDLRLicense(licenseNumber: string): Promise<TDLRResult> {
  const cleaned = licenseNumber.trim().replace(/\D/g, "")
  console.log("[TDLR] Verifying:", cleaned)

  // STEP 1: Check database cache first
  try {
    const cached = await prisma.tdlrLicenseCache.findUnique({ where: { licenseNumber: cleaned } })
    if (cached) {
      const hoursSince = (Date.now() - cached.lastVerified.getTime()) / (1000 * 60 * 60)
      console.log("[TDLR] Found in cache, last verified:", cached.lastVerified, "hours ago:", Math.round(hoursSince))

      let isExpired = false
      if (cached.expirationDate) {
        try { isExpired = new Date(cached.expirationDate) < new Date() } catch { /* skip */ }
      }
      const status = isExpired ? "EXPIRED" : (cached.status || "ACTIVE")

      return {
        valid: !isExpired && status === "ACTIVE",
        holderName: cached.holderName || "",
        licenseNumber: cached.licenseNumber,
        licenseType: cached.licenseType || "",
        expirationDate: cached.expirationDate || null,
        originalIssueDate: cached.originalIssueDate || "",
        status,
        county: cached.county || "",
        city: cached.city || "",
        state: cached.state || "TX",
        source: hoursSince < 24 ? "cache_fresh" : "cache_stale",
      }
    }
  } catch (e) {
    console.log("[TDLR] Cache lookup failed:", e instanceof Error ? e.message : e)
  }

  // STEP 2: Not in cache — download CSV and search
  console.log("[TDLR] Not in cache, downloading CSV...")
  const result = await searchTDLRCSV(cleaned)

  // STEP 3: Save result to cache if found
  if (result.valid || result.holderName) {
    try {
      await prisma.tdlrLicenseCache.upsert({
        where: { licenseNumber: cleaned },
        create: {
          licenseNumber: cleaned,
          holderName: result.holderName,
          licenseType: result.licenseType,
          expirationDate: typeof result.expirationDate === "string" ? result.expirationDate : undefined,
          originalIssueDate: result.originalIssueDate,
          status: result.status,
          county: result.county,
          city: result.city,
          state: result.state || "TX",
          isValid: result.valid,
          lastVerified: new Date(),
        },
        update: {
          holderName: result.holderName,
          licenseType: result.licenseType,
          expirationDate: typeof result.expirationDate === "string" ? result.expirationDate : undefined,
          originalIssueDate: result.originalIssueDate,
          status: result.status,
          county: result.county,
          city: result.city,
          state: result.state || "TX",
          isValid: result.valid,
          lastVerified: new Date(),
        },
      })
      console.log("[TDLR] Saved to cache:", cleaned)
    } catch (e) {
      console.log("[TDLR] Cache save failed:", e instanceof Error ? e.message : e)
    }
  }

  return result
}

/** Stream-search TDLR daily CSV files for a license number. Exported for cron use. */
export async function searchTDLRCSV(cleaned: string): Promise<TDLRResult> {
  const csvUrls = [
    "https://www.tdlr.texas.gov/dbproduction2/ltcos_op.csv",
    "https://www.tdlr.texas.gov/dbproduction2/ltcosmos.csv",
  ]

  for (const csvUrl of csvUrls) {
    try {
      console.log("[TDLR] Fetching CSV:", csvUrl)
      const res = await fetch(csvUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SalonEnvyPortal/1.0)", Accept: "text/csv,text/plain,*/*" },
        signal: AbortSignal.timeout(25000),
      })
      if (!res.ok) { console.log("[TDLR] CSV fetch failed:", res.status); continue }

      const reader = res.body?.getReader()
      if (!reader) continue

      const decoder = new TextDecoder()
      let buffer = ""
      let headerLine = ""
      let headers: string[] = []
      let found = false
      let result: TDLRResult | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          if (!headerLine) {
            headerLine = line
            headers = line.split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase())
            console.log("[TDLR] CSV headers:", headers.join(", "))
            continue
          }
          if (!line.includes(cleaned)) continue

          const values = parseCSVLine(line)
          if (values.length < headers.length) continue

          const record: Record<string, string> = {}
          headers.forEach((h, i) => { record[h] = (values[i] || "").replace(/^"|"$/g, "").trim() })

          const licField = record["license_no"] || record["lic_no"] || record["license_number"] || record["lic_nbr"] || record["licno"] || ""
          if (licField.replace(/\D/g, "") !== cleaned) continue

          console.log("[TDLR] Found record:", JSON.stringify(record))

          const lastName = record["name_last"] || record["last_name"] || record["lname"] || ""
          const firstName = record["name_first"] || record["first_name"] || record["fname"] || ""
          const fullName = record["name"] || record["full_name"] || record["licensee_name"] ||
                           (lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName)
          const expDate = record["expiration_date"] || record["exp_date"] || record["expiry"] || record["lic_exp_date"] || record["expire_date"] || ""
          const rawStatus = record["status"] || record["lic_status"] || record["license_status"] || "ACTIVE"
          const licType = record["license_type"] || record["lic_type"] || record["type"] || record["profession"] || "Cosmetologist - Operator"
          const county = record["county"] || record["county_name"] || ""
          const issueDate = record["original_issue_date"] || record["issue_date"] || record["orig_iss_date"] || record["first_issued"] || ""
          const city = record["city"] || record["bus_city"] || ""
          const stateVal = record["state"] || "TX"

          let isExpired = false
          if (expDate) { try { isExpired = new Date(expDate) < new Date() } catch { /* skip */ } }

          const normalizedStatus = isExpired ? "EXPIRED" :
            rawStatus.toUpperCase().includes("ACTIVE") ? "ACTIVE" :
            rawStatus.toUpperCase().includes("EXPIRE") ? "EXPIRED" :
            rawStatus.toUpperCase() || "ACTIVE"

          result = {
            valid: !isExpired && normalizedStatus === "ACTIVE",
            holderName: fullName.toUpperCase(),
            licenseNumber: licField || cleaned,
            licenseType: licType,
            expirationDate: expDate || null,
            originalIssueDate: issueDate,
            status: normalizedStatus,
            county: county.toUpperCase(),
            city: city.toUpperCase(),
            state: stateVal.toUpperCase(),
            source: csvUrl,
          }
          found = true
          break
        }
        if (found) { reader.cancel(); break }
      }

      if (result) { console.log("[TDLR] Returning result:", JSON.stringify(result)); return result }
      console.log("[TDLR] License not found in:", csvUrl)
    } catch (e: unknown) {
      console.log("[TDLR] CSV error:", e instanceof Error ? e.message : e)
      continue
    }
  }

  return { valid: false, error: `License ${cleaned} was not found in TDLR records. Please verify at tdlr.texas.gov` }
}
