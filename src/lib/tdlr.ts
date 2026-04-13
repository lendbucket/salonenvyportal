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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(r: Record<string, any>, cleaned: string, source: string): TDLRResult {
  const lastName = r.name_last || r.last_name || r.lname || ""
  const firstName = r.name_first || r.first_name || r.fname || ""
  const fullName = r.name || r.full_name || r.licensee_name ||
    (lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName)
  const expDate = r.expiration_date || r.exp_date || r.expiry_date || r.lic_exp_date || r.expire_date || ""
  const rawStatus = r.status || r.lic_status || r.license_status || "ACTIVE"
  const licType = r.license_type || r.lic_type || r.type || r.profession || "Cosmetologist - Operator"
  const county = r.county || r.county_name || ""
  const issueDate = r.original_issue_date || r.issue_date || r.orig_iss_date || r.first_issued || ""
  const city = r.city || r.bus_city || ""
  const licNum = r.license_no || r.lic_no || r.license_number || r.lic_nbr || cleaned

  let isExpired = false
  if (expDate) { try { isExpired = new Date(expDate) < new Date() } catch { /* skip */ } }

  const statusStr = String(rawStatus).toUpperCase()
  const normalizedStatus = isExpired ? "EXPIRED" :
    statusStr.includes("ACTIVE") ? "ACTIVE" :
    statusStr.includes("EXPIRE") ? "EXPIRED" :
    statusStr || "ACTIVE"

  return {
    valid: !isExpired && normalizedStatus === "ACTIVE",
    holderName: String(fullName).toUpperCase().trim(),
    licenseNumber: String(licNum).trim(),
    licenseType: String(licType).trim(),
    expirationDate: String(expDate).trim() || null,
    originalIssueDate: String(issueDate).trim(),
    status: normalizedStatus,
    county: String(county).toUpperCase().trim(),
    city: String(city).toUpperCase().trim(),
    state: "TX",
    source,
  }
}

async function saveToCache(cleaned: string, result: TDLRResult) {
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

export async function verifyTDLRLicense(licenseNumber: string): Promise<TDLRResult> {
  const cleaned = licenseNumber.trim().replace(/\D/g, "")
  console.log("[TDLR] Verifying:", cleaned)

  // STEP 1: Check Supabase cache first (instant)
  try {
    const cached = await prisma.tdlrLicenseCache.findUnique({ where: { licenseNumber: cleaned } })
    if (cached) {
      console.log("[TDLR] Cache hit:", cleaned, "verified:", cached.lastVerified)
      let isExpired = false
      if (cached.expirationDate) { try { isExpired = new Date(cached.expirationDate) < new Date() } catch { /* skip */ } }
      return {
        valid: !isExpired && (cached.status || "").toUpperCase() === "ACTIVE",
        holderName: cached.holderName || "", licenseNumber: cached.licenseNumber,
        licenseType: cached.licenseType || "", expirationDate: cached.expirationDate || null,
        originalIssueDate: cached.originalIssueDate || "", status: isExpired ? "EXPIRED" : (cached.status || "ACTIVE"),
        county: cached.county || "", city: cached.city || "", state: "TX", source: "cache",
      }
    }
  } catch (e) {
    console.log("[TDLR] Cache error:", e instanceof Error ? e.message : e)
  }

  // STEP 2: Try Socrata API (fast, small response, <1s per request)
  const socrataToken = process.env.SOCRATA_APP_TOKEN || ""
  const padded7 = cleaned.padStart(7, "0")
  const padded8 = cleaned.padStart(8, "0")

  const socrataUrls = [
    `https://data.texas.gov/resource/er6t-8gkz.json?license_no=${cleaned}`,
    `https://data.texas.gov/resource/er6t-8gkz.json?license_no=${padded7}`,
    `https://data.texas.gov/resource/er6t-8gkz.json?license_no=${padded8}`,
    `https://data.texas.gov/resource/er6t-8gkz.json?$where=license_no=%27${cleaned}%27`,
    `https://data.texas.gov/resource/7358-krk7.json?license_no=${cleaned}`,
    `https://data.texas.gov/resource/7358-krk7.json?license_no=${padded7}`,
    `https://data.texas.gov/resource/7358-krk7.json?$where=license_no=%27${cleaned}%27`,
    `https://data.texas.gov/resource/er6t-8gkz.json?$where=license_no+like+%27%25${cleaned}%25%27&$limit=5`,
    `https://data.texas.gov/resource/7358-krk7.json?$where=license_no+like+%27%25${cleaned}%25%27&$limit=5`,
  ]

  for (const url of socrataUrls) {
    try {
      console.log("[TDLR] Socrata:", url)
      const headers: Record<string, string> = { Accept: "application/json" }
      if (socrataToken) headers["X-App-Token"] = socrataToken
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!res.ok) { console.log("[TDLR] Socrata", res.status); continue }
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        console.log("[TDLR] Socrata found! Keys:", Object.keys(data[0]).join(", "))
        const result = mapRecord(data[0], cleaned, url)
        saveToCache(cleaned, result).catch(() => {})
        return result
      }
      console.log("[TDLR] Socrata empty:", url)
    } catch (e: unknown) {
      console.log("[TDLR] Socrata fail:", e instanceof Error ? e.message : e)
    }
  }

  // STEP 3: Stream CSV (slow fallback, 25-55s)
  console.log("[TDLR] Socrata exhausted, trying CSV...")
  const result = await searchTDLRCSV(cleaned)
  if (result.valid || result.holderName) {
    saveToCache(cleaned, result).catch(() => {})
  }
  return result
}

/** Stream-search TDLR daily CSV files. Exported for cron use. */
export async function searchTDLRCSV(cleaned: string): Promise<TDLRResult> {
  const searchVariants = [cleaned, cleaned.padStart(7, "0"), cleaned.padStart(8, "0")]

  const csvUrls = [
    "https://www.tdlr.texas.gov/dbproduction2/ltcos_op.csv",
    "https://www.tdlr.texas.gov/dbproduction2/ltcosmos.csv",
  ]

  for (const csvUrl of csvUrls) {
    try {
      console.log("[TDLR] CSV:", csvUrl)
      const res = await fetch(csvUrl, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv,*/*" },
        signal: AbortSignal.timeout(55000),
      })
      if (!res.ok) { console.log("[TDLR] CSV status:", res.status); continue }

      const reader = res.body?.getReader()
      if (!reader) continue

      const decoder = new TextDecoder()
      let buffer = ""
      let headers: string[] = []
      let linesProcessed = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) { console.log("[TDLR] CSV done after", linesProcessed, "lines"); break }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          linesProcessed++

          if (headers.length === 0) {
            headers = parseCSVLine(line).map(h => h.toLowerCase().trim())
            console.log("[TDLR] CSV headers:", headers.join(", "))
            continue
          }

          // Fast pre-check: does line contain any variant of the license number?
          if (!searchVariants.some(v => line.includes(v))) continue

          const values = parseCSVLine(line)
          if (values.length < headers.length - 2) continue

          const record: Record<string, string> = {}
          headers.forEach((h, i) => { record[h] = (values[i] || "").replace(/^"|"$/g, "").trim() })

          const licField = record["license_no"] || record["lic_no"] || record["license_number"] || record["lic_nbr"] || record["licno"] || ""
          const licCleaned = licField.replace(/\D/g, "")

          if (licCleaned !== cleaned && licCleaned !== cleaned.padStart(7, "0") && licCleaned !== cleaned.padStart(8, "0")) continue

          console.log("[TDLR] CSV match at line", linesProcessed)
          reader.cancel()
          return mapRecord(record, cleaned, csvUrl)
        }
      }
      console.log("[TDLR] Not found in:", csvUrl)
    } catch (e: unknown) {
      console.log("[TDLR] CSV error:", e instanceof Error ? e.message : e)
    }
  }

  return { valid: false, error: `License ${cleaned} not found in TDLR records. Verify at tdlr.texas.gov` }
}
