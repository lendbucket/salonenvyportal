import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

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

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[TDLR Cron] Starting daily refresh")

  const cachedLicenses = await prisma.tdlrLicenseCache.findMany({ select: { licenseNumber: true } })
  if (cachedLicenses.length === 0) {
    console.log("[TDLR Cron] No cached licenses to refresh")
    return NextResponse.json({ success: true, refreshed: 0, message: "No licenses in cache" })
  }

  console.log("[TDLR Cron] Refreshing", cachedLicenses.length, "licenses")

  await prisma.tdlrCacheMetadata.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", status: "syncing", totalRecords: cachedLicenses.length },
    update: { status: "syncing" },
  })

  let refreshed = 0
  let errors = 0

  try {
    const csvUrl = "https://www.tdlr.texas.gov/dbproduction2/ltcos_op.csv"
    const res = await fetch(csvUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SalonEnvyPortal/1.0)" },
      signal: AbortSignal.timeout(55000),
    })

    if (res.ok && res.body) {
      const licenseSet = new Set(cachedLicenses.map(l => l.licenseNumber))
      const decoder = new TextDecoder()
      const reader = res.body.getReader()
      let buffer = ""
      let headers: string[] = []
      let headerLine = ""
      const found = new Map<string, Record<string, string>>()

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
            continue
          }
          const matchedLicense = [...licenseSet].find(lic => line.includes(lic))
          if (matchedLicense && !found.has(matchedLicense)) {
            const values = parseCSVLine(line)
            if (values.length >= headers.length) {
              const record: Record<string, string> = {}
              headers.forEach((h, i) => { record[h] = (values[i] || "").replace(/^"|"$/g, "").trim() })
              const licField = record["license_no"] || record["lic_no"] || record["license_number"] || record["lic_nbr"] || ""
              if (licField.replace(/\D/g, "") === matchedLicense) {
                found.set(matchedLicense, record)
              }
            }
          }
        }
        if (found.size === licenseSet.size) { reader.cancel(); break }
      }

      for (const [licenseNumber, record] of found) {
        try {
          const lastName = record["name_last"] || record["last_name"] || ""
          const firstName = record["name_first"] || record["first_name"] || ""
          const fullName = record["name"] || (lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName)
          const expDate = record["expiration_date"] || record["exp_date"] || ""
          const rawStatus = record["status"] || record["lic_status"] || "ACTIVE"
          let isExpired = false
          if (expDate) { try { isExpired = new Date(expDate) < new Date() } catch { /* skip */ } }

          await prisma.tdlrLicenseCache.update({
            where: { licenseNumber },
            data: {
              holderName: fullName.toUpperCase(),
              licenseType: record["license_type"] || record["lic_type"] || "Cosmetologist - Operator",
              expirationDate: expDate,
              originalIssueDate: record["original_issue_date"] || record["issue_date"] || "",
              status: isExpired ? "EXPIRED" : rawStatus.toUpperCase().includes("ACTIVE") ? "ACTIVE" : rawStatus.toUpperCase(),
              county: (record["county"] || "").toUpperCase(),
              city: (record["city"] || "").toUpperCase(),
              isValid: !isExpired && rawStatus.toUpperCase().includes("ACTIVE"),
              lastVerified: new Date(),
            },
          })
          refreshed++
        } catch { errors++ }
      }
    }
  } catch (e: unknown) {
    console.error("[TDLR Cron] Error:", e instanceof Error ? e.message : e)
    errors++
  }

  await prisma.tdlrCacheMetadata.update({
    where: { id: "singleton" },
    data: {
      status: errors > 0 ? "error" : "complete",
      lastSync: new Date(),
      totalRecords: refreshed,
      errorMsg: errors > 0 ? `${errors} licenses failed to refresh` : null,
    },
  })

  console.log("[TDLR Cron] Complete. Refreshed:", refreshed, "Errors:", errors)
  return NextResponse.json({ success: true, refreshed, errors, timestamp: new Date().toISOString() })
}
