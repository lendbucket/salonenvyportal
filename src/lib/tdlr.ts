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
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export async function verifyTDLRLicense(licenseNumber: string): Promise<TDLRResult> {
  const cleaned = licenseNumber.trim().replace(/\D/g, "")
  console.log("[TDLR] Verifying license via CSV:", cleaned)

  // TDLR publishes daily CSV downloads — these are the most reliable source
  const csvUrls = [
    "https://www.tdlr.texas.gov/dbproduction2/ltcos_op.csv", // Cosmetology operators (~35MB)
    "https://www.tdlr.texas.gov/dbproduction2/ltcosmos.csv", // All cosmetology
  ]

  for (const csvUrl of csvUrls) {
    try {
      console.log("[TDLR] Fetching CSV:", csvUrl)

      const res = await fetch(csvUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SalonEnvyPortal/1.0)",
          Accept: "text/csv,text/plain,*/*",
        },
        signal: AbortSignal.timeout(25000),
      })

      if (!res.ok) {
        console.log("[TDLR] CSV fetch failed:", res.status)
        continue
      }

      // Stream the response and search line by line — do NOT load entire file into memory
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

        // Keep last incomplete line in buffer
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue

          // First line is headers
          if (!headerLine) {
            headerLine = line
            headers = line.split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase())
            console.log("[TDLR] CSV headers:", headers.join(", "))
            continue
          }

          // Search for license number in this line (fast pre-check before parsing)
          if (!line.includes(cleaned)) continue

          const values = parseCSVLine(line)

          if (values.length >= headers.length) {
            const record: Record<string, string> = {}
            headers.forEach((h, i) => { record[h] = (values[i] || "").replace(/^"|"$/g, "").trim() })

            // Check if this is actually our license number
            const licField = record["license_no"] || record["lic_no"] || record["license_number"] ||
                             record["lic_nbr"] || record["licno"] || ""

            if (licField.replace(/\D/g, "") !== cleaned) continue

            console.log("[TDLR] Found record:", JSON.stringify(record))

            // Map fields with all possible column name variations
            const lastName = record["name_last"] || record["last_name"] || record["lname"] || ""
            const firstName = record["name_first"] || record["first_name"] || record["fname"] || ""
            const fullName = record["name"] || record["full_name"] || record["licensee_name"] ||
                             (lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName)

            const expDate = record["expiration_date"] || record["exp_date"] || record["expiry"] ||
                            record["lic_exp_date"] || record["expire_date"] || ""

            const rawStatus = record["status"] || record["lic_status"] || record["license_status"] || "ACTIVE"
            const licType = record["license_type"] || record["lic_type"] || record["type"] ||
                            record["profession"] || "Cosmetologist - Operator"
            const county = record["county"] || record["county_name"] || ""
            const issueDate = record["original_issue_date"] || record["issue_date"] ||
                              record["orig_iss_date"] || record["first_issued"] || ""
            const city = record["city"] || record["bus_city"] || ""
            const stateVal = record["state"] || "TX"

            let isExpired = false
            if (expDate) {
              try { isExpired = new Date(expDate) < new Date() } catch { /* skip */ }
            }

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
        }

        if (found) {
          reader.cancel()
          break
        }
      }

      if (result) {
        console.log("[TDLR] Returning result:", JSON.stringify(result))
        return result
      }

      console.log("[TDLR] License not found in:", csvUrl)
    } catch (e: unknown) {
      console.log("[TDLR] CSV error:", e instanceof Error ? e.message : e)
      continue
    }
  }

  console.log("[TDLR] License not found in any CSV:", cleaned)
  return {
    valid: false,
    error: `License ${cleaned} was not found in TDLR records. Please verify at tdlr.texas.gov`,
  }
}
