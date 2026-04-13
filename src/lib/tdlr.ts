export interface TDLRResult {
  valid: boolean
  holderName?: string
  licenseNumber?: string
  licenseType?: string
  expirationDate?: string | null
  originalIssueDate?: string
  status?: string
  county?: string
  source?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawRecord?: any
  error?: string
}

export async function verifyTDLRLicense(licenseNumber: string): Promise<TDLRResult> {
  const cleaned = licenseNumber.trim().replace(/\D/g, "")
  console.log("[TDLR] Verifying license:", cleaned)

  // ALL dataset + field combinations to try
  const attempts = [
    // Dataset er6t-8gkz — primary TDLR active licenses
    `https://data.texas.gov/resource/er6t-8gkz.json?license_no=${cleaned}`,
    `https://data.texas.gov/resource/er6t-8gkz.json?$where=license_no=%27${cleaned}%27`,
    `https://data.texas.gov/resource/er6t-8gkz.json?lic_no=${cleaned}`,
    `https://data.texas.gov/resource/er6t-8gkz.json?license_number=${cleaned}`,
    `https://data.texas.gov/resource/er6t-8gkz.json?lic_nbr=${cleaned}`,
    // Dataset 7358-krk7 — TDLR all licenses
    `https://data.texas.gov/resource/7358-krk7.json?license_no=${cleaned}`,
    `https://data.texas.gov/resource/7358-krk7.json?$where=license_no=%27${cleaned}%27`,
    `https://data.texas.gov/resource/7358-krk7.json?lic_no=${cleaned}`,
    `https://data.texas.gov/resource/7358-krk7.json?license_number=${cleaned}`,
    `https://data.texas.gov/resource/7358-krk7.json?lic_nbr=${cleaned}`,
    `https://data.texas.gov/resource/7358-krk7.json?$where=lic_nbr=%27${cleaned}%27`,
    // Dataset whvf-shnm — cosmetology specific
    `https://data.texas.gov/resource/whvf-shnm.json?license_no=${cleaned}`,
    `https://data.texas.gov/resource/whvf-shnm.json?lic_no=${cleaned}`,
    `https://data.texas.gov/resource/whvf-shnm.json?license_number=${cleaned}`,
    `https://data.texas.gov/resource/whvf-shnm.json?lic_nbr=${cleaned}`,
    // Broader search with LIKE
    `https://data.texas.gov/resource/er6t-8gkz.json?$limit=5&$where=license_no+like+%27${cleaned}%25%27`,
    `https://data.texas.gov/resource/7358-krk7.json?$limit=5&$where=license_no+like+%27${cleaned}%25%27`,
  ]

  for (const url of attempts) {
    try {
      console.log("[TDLR] Trying:", url)
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-App-Token": process.env.SOCRATA_APP_TOKEN || "",
        },
        signal: AbortSignal.timeout(8000),
      })

      console.log("[TDLR] Status:", res.status, "URL:", url)

      if (!res.ok) {
        const errText = await res.text()
        console.log("[TDLR] Error response:", errText.substring(0, 200))
        continue
      }

      const data = await res.json()
      console.log("[TDLR] Response isArray:", Array.isArray(data), "length:", Array.isArray(data) ? data.length : "N/A")

      if (Array.isArray(data) && data.length > 0) {
        const r = data[0]
        console.log("[TDLR] SUCCESS - Keys:", Object.keys(r).join(", "))
        console.log("[TDLR] Record:", JSON.stringify(r))

        // Map ALL possible field name variations
        const holderName = (
          r.name || r.licensee_name || r.holder_name || r.lic_holder ||
          r.full_name || r.person_name || r.applicant_name ||
          [r.last_name, r.first_name].filter(Boolean).join(", ") ||
          [r.lname, r.fname].filter(Boolean).join(", ") || ""
        )

        const licType = (
          r.license_type || r.lic_type || r.type || r.profession ||
          r.license_type_desc || r.lic_type_desc || r.activity ||
          r.license_subtype || ""
        )

        const expDate = (
          r.expiration_date || r.exp_date || r.expiry_date ||
          r.expiration || r.expire_date || r.lic_exp_date || ""
        )

        const rawStatus = (
          r.status || r.license_status || r.lic_status ||
          r.active_status || r.current_status || "ACTIVE"
        )

        const county = (r.county || r.county_name || r.county_desc || "")
        const issueDate = (r.original_issue_date || r.issue_date || r.issued || r.lic_issue_date || r.first_issued || "")
        const licNum = (r.license_no || r.lic_no || r.license_number || r.lic_nbr || r.license_nbr || cleaned)

        let isExpired = false
        if (expDate) {
          try { isExpired = new Date(expDate) < new Date() } catch { /* skip */ }
        }

        const normalizedStatus = isExpired ? "EXPIRED" :
          String(rawStatus).toUpperCase().includes("ACTIVE") ? "ACTIVE" :
          String(rawStatus).toUpperCase().includes("EXPIRE") ? "EXPIRED" :
          String(rawStatus).toUpperCase() || "ACTIVE"

        return {
          valid: !isExpired && normalizedStatus === "ACTIVE",
          holderName: String(holderName).trim(),
          licenseNumber: String(licNum).trim(),
          licenseType: String(licType).trim() || "Cosmetologist",
          expirationDate: String(expDate).trim() || null,
          originalIssueDate: String(issueDate).trim(),
          status: normalizedStatus,
          county: String(county).trim(),
          source: url,
          rawRecord: r,
        }
      }

      if (Array.isArray(data) && data.length === 0) {
        console.log("[TDLR] Empty array from:", url)
      }
    } catch (e: unknown) {
      console.log("[TDLR] Fetch failed for", url, ":", e instanceof Error ? e.message : e)
      continue
    }
  }

  console.log("[TDLR] All strategies exhausted for license:", cleaned)
  return {
    valid: false,
    error: `License ${cleaned} could not be verified via TDLR API. Please verify manually at tdlr.texas.gov and use the manual override option.`,
  }
}
