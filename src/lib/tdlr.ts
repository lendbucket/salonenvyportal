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

export async function verifyTDLRLicense(licenseNumber: string): Promise<TDLRResult> {
  const cleaned = licenseNumber.trim().replace(/\D/g, "")
  console.log("[TDLR] Starting verification for:", cleaned)

  const token = process.env.SOCRATA_APP_TOKEN || ""
  console.log("[TDLR] Token present:", !!token, "length:", token.length)

  // STEP 1: Direct Socrata call — confirmed working query
  const url = `https://data.texas.gov/resource/7358-krk7.json?license_number=${cleaned}`
  console.log("[TDLR] Fetching:", url)

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-App-Token": token,
      },
      signal: AbortSignal.timeout(15000),
    })

    console.log("[TDLR] Response status:", res.status)

    const data = await res.json()
    console.log("[TDLR] Response data:", JSON.stringify(data).substring(0, 500))

    if (!Array.isArray(data) || data.length === 0) {
      console.log("[TDLR] Empty result for license:", cleaned)
      return { valid: false, error: `License ${cleaned} not found in TDLR database` }
    }

    const r = data[0]
    console.log("[TDLR] Record found:", JSON.stringify(r))

    const holderName = (r.owner_name || r.business_name || "").toUpperCase().trim()
    const expDate = r.license_expiration_date_mmddccyy || ""
    const licType = `${r.license_type || "Cosmetologist"} (${r.license_subtype || "OP"})`
    const county = (r.business_county || r.mailing_address_county || "").toUpperCase()

    let isExpired = false
    if (expDate) {
      try {
        const parts = expDate.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (parts) {
          isExpired = new Date(parseInt(parts[3]), parseInt(parts[1]) - 1, parseInt(parts[2])) < new Date()
        }
      } catch (e) {
        console.log("[TDLR] Date parse error:", e)
      }
    }

    const result: TDLRResult = {
      valid: !isExpired,
      holderName,
      licenseNumber: r.license_number || cleaned,
      licenseType: licType,
      expirationDate: expDate || null,
      originalIssueDate: "",
      status: isExpired ? "EXPIRED" : "ACTIVE",
      county,
      city: "",
      state: "TX",
      source: "socrata",
    }

    console.log("[TDLR] Returning result:", JSON.stringify(result))

    // Save to cache async — non-blocking, dynamic import to avoid module-level prisma crash
    try {
      const { prisma } = await import("@/lib/prisma")
      await prisma.tdlrLicenseCache.upsert({
        where: { licenseNumber: cleaned },
        create: {
          licenseNumber: cleaned, holderName, licenseType: licType,
          expirationDate: expDate || undefined, status: result.status,
          county, isValid: result.valid, lastVerified: new Date(),
        },
        update: {
          holderName, licenseType: licType,
          expirationDate: expDate || undefined, status: result.status,
          county, isValid: result.valid, lastVerified: new Date(),
        },
      })
      console.log("[TDLR] Cached successfully")
    } catch (cacheErr) {
      console.error("[TDLR] Cache save failed (non-fatal):", cacheErr instanceof Error ? cacheErr.message : cacheErr)
    }

    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[TDLR] Fatal error:", msg)
    return { valid: false, error: `Verification failed: ${msg}` }
  }
}

/** Stream-search TDLR daily CSV files. Exported for cron use. */
export async function searchTDLRCSV(cleaned: string): Promise<TDLRResult> {
  const csvUrls = [
    "https://www.tdlr.texas.gov/dbproduction2/ltcos_op.csv",
    "https://www.tdlr.texas.gov/dbproduction2/ltcosmos.csv",
  ]
  const searchVariants = [cleaned, cleaned.padStart(7, "0"), cleaned.padStart(8, "0")]

  for (const csvUrl of csvUrls) {
    try {
      const res = await fetch(csvUrl, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv,*/*" },
        signal: AbortSignal.timeout(55000),
      })
      if (!res.ok) continue
      const reader = res.body?.getReader()
      if (!reader) continue

      const decoder = new TextDecoder()
      let buffer = ""
      let headers: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          if (headers.length === 0) {
            headers = line.split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase())
            continue
          }
          if (!searchVariants.some(v => line.includes(v))) continue
          const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""))
          if (values.length < headers.length - 2) continue
          const record: Record<string, string> = {}
          headers.forEach((h, i) => { record[h] = values[i] || "" })
          const licField = record["license_number"] || record["license_no"] || record["lic_no"] || record["lic_nbr"] || ""
          if (licField.replace(/\D/g, "") !== cleaned) continue
          reader.cancel()

          const holderName = (record["owner_name"] || record["business_name"] || record["name"] || "").toUpperCase()
          const expDate = record["license_expiration_date_mmddccyy"] || record["expiration_date"] || ""
          let isExpired = false
          if (expDate) { try { const p = expDate.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (p) isExpired = new Date(parseInt(p[3]), parseInt(p[1]) - 1, parseInt(p[2])) < new Date() } catch { /* skip */ } }
          return {
            valid: !isExpired, holderName, licenseNumber: licField || cleaned,
            licenseType: `${record["license_type"] || "Cosmetologist"} (${record["license_subtype"] || "OP"})`,
            expirationDate: expDate || null, status: isExpired ? "EXPIRED" : "ACTIVE",
            county: (record["business_county"] || "").toUpperCase(), state: "TX", source: csvUrl,
          }
        }
      }
    } catch { continue }
  }

  return { valid: false, error: `License ${cleaned} not found in TDLR records` }
}
