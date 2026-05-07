/**
 * Checkr background check integration.
 * Uses Checkr REST API for candidate creation and report ordering.
 */

const CHECKR_BASE = "https://api.checkr.com/v1"

function getApiKey(): string {
  const key = process.env.CHECKR_API_KEY
  if (!key) throw new Error("CHECKR_API_KEY env var missing")
  return key
}

async function checkrFetch(path: string, opts?: RequestInit) {
  const key = getApiKey()
  const res = await fetch(`${CHECKR_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
      ...(opts?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Checkr API error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function createCandidate(data: {
  firstName: string; lastName: string; email: string; phone?: string
  ssn?: string; dob?: string; address?: string; city?: string; state?: string; zip?: string
}): Promise<{ candidateId: string }> {
  const result = await checkrFetch("/candidates", {
    method: "POST",
    body: JSON.stringify({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
      ssn: data.ssn,
      dob: data.dob,
      ...(data.address ? {
        geo_ids: [],
        address: { street: data.address, city: data.city, state: data.state, zipcode: data.zip },
      } : {}),
    }),
  })
  return { candidateId: result.id }
}

export async function orderReport(candidateId: string, packageSlug = "driver_pro"): Promise<{ reportId: string }> {
  const result = await checkrFetch("/invitations", {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId, package: packageSlug }),
  })
  return { reportId: result.id }
}

export async function getReport(reportId: string): Promise<{
  status: "pending" | "clear" | "consider" | "suspended"
  completedAt?: string
  resultUrl?: string
}> {
  const result = await checkrFetch(`/reports/${reportId}`)
  return {
    status: result.status,
    completedAt: result.completed_at,
    resultUrl: result.report_url,
  }
}
