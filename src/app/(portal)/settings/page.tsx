"use client"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useUserRole } from "@/hooks/useUserRole"

function SettingsInner() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isOwner, isManager, isStylist } = useUserRole()
  const user = session?.user as any

  const tabs = [
    { key: "profile", label: "Profile" },
    { key: "license", label: "License" },
    { key: "notifications", label: "Notifications" },
    ...(isOwner || isManager ? [{ key: "location", label: "Location" }] : []),
    ...(isOwner ? [{ key: "api", label: "API & Integrations" }] : []),
  ]

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile")
  const [name, setName] = useState(user?.name || "")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  // License state
  const [licenseNumber, setLicenseNumber] = useState("")
  const [licenseStatus, setLicenseStatus] = useState<any>(null)
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [newKey, setNewKey] = useState({ name: "", locationId: "", permissions: ["appointments:read", "staff:read", "services:read"], expiresIn: "never", notes: "" })
  const [generatedKey, setGeneratedKey] = useState("")
  const [generatingKey, setGeneratingKey] = useState(false)

  const loadApiKeys = useCallback(async () => {
    setApiKeysLoading(true)
    try {
      const res = await fetch("/api/v1/api-keys")
      const data = await res.json()
      setApiKeys(data.keys || [])
    } catch { /* ignore */ }
    setApiKeysLoading(false)
  }, [])

  useEffect(() => { if (activeTab === "api" && isOwner) loadApiKeys() }, [activeTab, isOwner, loadApiKeys])

  const generateApiKey = async () => {
    setGeneratingKey(true)
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      })
      const data = await res.json()
      if (data.apiKey?.fullKey) {
        setGeneratedKey(data.apiKey.fullKey)
        loadApiKeys()
      } else {
        setMsg(data.error || "Failed to generate key")
      }
    } catch { setMsg("Failed to generate key") }
    setGeneratingKey(false)
  }

  const revokeApiKey = async (id: string) => {
    await fetch(`/api/v1/api-keys?id=${id}`, { method: "DELETE" })
    loadApiKeys()
    setMsg("API key revoked")
    setTimeout(() => setMsg(""), 3000)
  }

  useEffect(() => {
    fetch("/api/staff/me/license-status").then(r => r.json()).then(d => {
      setLicenseStatus(d)
      if (d.licenseNumber) setLicenseNumber(d.licenseNumber)
    }).catch(() => {})
  }, [])

  const verifyLicense = async () => {
    if (!licenseNumber.trim()) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/tdlr/verify?license=${encodeURIComponent(licenseNumber)}`)
      const data = await res.json()
      if (data.found) {
        // Save to profile via existing endpoint
        const meRes = await fetch("/api/staff/me")
        const meData = await meRes.json()
        if (meData.staffMember?.id) {
          await fetch("/api/tdlr/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffMemberId: meData.staffMember.id, licenseNumber, licenseStatus: data.isActive ? "active" : data.status, expirationDate: data.expirationDate }),
          })
        }
        setLicenseStatus({ ...licenseStatus, licenseNumber, verified: data.isActive, status: data.isActive ? "active" : data.status, expirationDate: data.expirationDate, holderName: data.holderName })
        setMsg(data.isActive ? "License verified!" : "License found but not active")
      } else {
        setMsg("License not found in TDLR records")
      }
    } catch { setMsg("Verification failed") }
    setVerifying(false)
    setTimeout(() => setMsg(""), 4000)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone }) })
      const data = await res.json()
      setMsg(data.error ? data.error : "Profile saved!")
    } catch { setMsg("Failed to save") }
    setSaving(false)
    setTimeout(() => setMsg(""), 3000)
  }

  const cardStyle: React.CSSProperties = { backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "28px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25)" }
  const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", backgroundColor: "rgba(205,201,192,0.06)", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#FFFFFF", fontSize: "14px", outline: "none", boxSizing: "border-box" }
  const labelStyle: React.CSSProperties = { fontSize: "10px", fontWeight: 700, color: "#7a8f96", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "6px", display: "block" }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "28px 20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 20px" }}>Settings</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: "10px 18px", fontSize: "13px", fontWeight: 600, color: activeTab === t.key ? "#ffffff" : "#606E74",
            backgroundColor: "transparent", border: "none", borderBottom: activeTab === t.key ? "2px solid #7a8f96" : "2px solid transparent",
            cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {msg && <div style={{ padding: "10px 16px", marginBottom: "16px", borderRadius: "8px", backgroundColor: "rgba(122,143,150,0.1)", color: "#7a8f96", fontSize: "13px" }}>{msg}</div>}

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div><label style={labelStyle}>Full Name</label><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Email</label><input value={user?.email || ""} disabled style={{ ...inputStyle, color: "rgba(205,201,192,0.4)", cursor: "not-allowed" }} /></div>
            <div><label style={labelStyle}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(361) 555-0123" style={inputStyle} /></div>
            <button onClick={saveProfile} disabled={saving} style={{ padding: "12px", backgroundColor: "#7a8f96", color: "#06080d", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save Profile"}</button>
          </div>
        </div>
      )}

      {/* License tab */}
      {activeTab === "license" && (
        <div style={cardStyle}>
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#606E74", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>License Status</div>
            {licenseStatus?.verified ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: licenseStatus.expired ? "#ef4444" : licenseStatus.expiringSoon ? "#f59e0b" : "#22c55e" }} />
                <span style={{ fontSize: "14px", fontWeight: 600, color: licenseStatus.expired ? "#ef4444" : licenseStatus.expiringSoon ? "#f59e0b" : "#22c55e" }}>
                  {licenseStatus.expired ? "Expired" : licenseStatus.expiringSoon ? `Expiring Soon (${licenseStatus.daysUntilExpiry} days)` : "Active"}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: "14px", color: "#f59e0b" }}>Unverified — enter your license number below</div>
            )}
          </div>

          {licenseStatus?.holderName && <div style={{ fontSize: "13px", color: "#7a8f96", marginBottom: "8px" }}>TDLR Name: {licenseStatus.holderName}</div>}
          {licenseStatus?.expirationDate && <div style={{ fontSize: "13px", color: "#606E74", marginBottom: "16px", fontFamily: "'Fira Code', monospace" }}>Expires: {new Date(licenseStatus.expirationDate).toLocaleDateString()}</div>}

          <div style={{ display: "flex", gap: "8px" }}>
            <input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="TX license number" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={verifyLicense} disabled={verifying || !licenseNumber.trim()} style={{ padding: "12px 20px", backgroundColor: "#7a8f96", color: "#06080d", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer", opacity: verifying ? 0.6 : 1, whiteSpace: "nowrap" }}>{verifying ? "Verifying..." : "Verify"}</button>
          </div>
          <div style={{ fontSize: "12px", color: "#606E74", marginTop: "12px" }}>Your license number can be found on your TDLR certificate or at tdlr.texas.gov</div>
        </div>
      )}

      {/* Notifications tab */}
      {activeTab === "notifications" && (
        <div style={cardStyle}>
          <div style={{ fontSize: "14px", color: "#7a8f96", marginBottom: "16px" }}>Notification preferences are managed in the Preferences page.</div>
          <button onClick={() => router.push("/preferences")} style={{ padding: "10px 16px", backgroundColor: "transparent", border: "1px solid #606E74", color: "#7a8f96", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Go to Preferences</button>
        </div>
      )}

      {/* Location tab */}
      {activeTab === "location" && (isOwner || isManager) && (
        <div style={cardStyle}>
          <div style={{ fontSize: "14px", color: "#7a8f96" }}>Location settings are configured in the portal admin. Contact the portal owner for changes.</div>
        </div>
      )}

      {/* API & Integrations tab */}
      {activeTab === "api" && isOwner && (
        <div>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", marginBottom: "4px" }}>API Keys</div>
                <div style={{ fontSize: "12px", color: "#606E74" }}>Generate keys for Kasse and RunMySalon integrations</div>
              </div>
              <button onClick={() => { setShowKeyModal(true); setGeneratedKey("") }} style={{ padding: "8px 16px", backgroundColor: "#7a8f96", color: "#06080d", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>Generate New Key</button>
            </div>

            {apiKeysLoading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#606E74" }}>Loading...</div>
            ) : apiKeys.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#606E74", fontSize: "13px" }}>No API keys yet. Generate one to get started.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {apiKeys.map((k: any) => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>{k.name}</div>
                      <div style={{ fontSize: "11px", color: "#606E74", fontFamily: "'Fira Code', monospace", marginTop: "2px" }}>{k.keyId}</div>
                    </div>
                    <div style={{ fontSize: "10px", color: "#606E74" }}>
                      {k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                    </div>
                    <div style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "4px", backgroundColor: k.isActive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: k.isActive ? "#10B981" : "#ef4444", fontWeight: 700 }}>
                      {k.isActive ? "ACTIVE" : "REVOKED"}
                    </div>
                    {k.isActive && (
                      <button onClick={() => revokeApiKey(k.id)} style={{ padding: "4px 10px", backgroundColor: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#ef4444", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick start docs */}
          <div style={{ ...cardStyle, marginTop: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", marginBottom: "12px" }}>Quick Start</div>
            <div style={{ fontSize: "12px", color: "#606E74", marginBottom: "8px" }}>Base URL: <span style={{ color: "#7a8f96", fontFamily: "'Fira Code', monospace" }}>https://portal.salonenvyusa.com/api/v1</span></div>
            <div style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "16px", fontFamily: "'Fira Code', monospace", fontSize: "11px", color: "#7a8f96", lineHeight: 1.8, overflow: "auto" }}>
              <div style={{ color: "#606E74" }}>{"// Fetch today's appointments"}</div>
              <div><span style={{ color: "#c792ea" }}>const</span> res = <span style={{ color: "#c792ea" }}>await</span> <span style={{ color: "#82aaff" }}>fetch</span>(</div>
              <div style={{ paddingLeft: "16px" }}><span style={{ color: "#c3e88d" }}>{`'https://portal.salonenvyusa.com/api/v1/appointments?date=2026-04-16'`}</span>,</div>
              <div style={{ paddingLeft: "16px" }}>{"{ headers: { 'X-API-Key': 'your_key_here' } }"}</div>
              <div>)</div>
            </div>
            <div style={{ fontSize: "11px", color: "#606E74", marginTop: "12px" }}>
              Endpoints: /appointments, /staff, /services, /clients, /metrics, /health
              <br />Rate limit: 1,000 requests/hour per key
            </div>
          </div>
        </div>
      )}

      {/* Generate Key Modal */}
      {showKeyModal && (
        <>
          <div onClick={() => { setShowKeyModal(false); setGeneratedKey("") }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "90%", maxWidth: "480px", backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "28px", zIndex: 101 }}>
            {generatedKey ? (
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#10B981", marginBottom: "12px" }}>API Key Generated</div>
                <div style={{ fontSize: "12px", color: "#f59e0b", marginBottom: "16px" }}>This key will only be shown once. Copy it now.</div>
                <div style={{ backgroundColor: "rgba(0,0,0,0.4)", borderRadius: "8px", padding: "14px", fontFamily: "'Fira Code', monospace", fontSize: "11px", color: "#ffffff", wordBreak: "break-all", marginBottom: "16px", border: "1px solid rgba(16,185,129,0.3)" }}>
                  {generatedKey}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { navigator.clipboard.writeText(generatedKey); setMsg("Copied!"); setTimeout(() => setMsg(""), 2000) }} style={{ flex: 1, padding: "10px", backgroundColor: "#7a8f96", color: "#06080d", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>Copy Key</button>
                  <button onClick={() => { setShowKeyModal(false); setGeneratedKey("") }} style={{ flex: 1, padding: "10px", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#7a8f96", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>Done</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", marginBottom: "20px" }}>Generate API Key</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div><label style={labelStyle}>Key Name</label><input value={newKey.name} onChange={e => setNewKey({ ...newKey, name: e.target.value })} placeholder="e.g. Kasse Production" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Location</label>
                    <select value={newKey.locationId} onChange={e => setNewKey({ ...newKey, locationId: e.target.value })} style={{ ...inputStyle, appearance: "none" }}>
                      <option value="">All Locations</option>
                      <option value="LTJSA6QR1HGW6">Corpus Christi</option>
                      <option value="LXJYXDXWR0XZF">San Antonio</option>
                    </select>
                  </div>
                  <div><label style={labelStyle}>Permissions</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {["appointments:read", "appointments:write", "staff:read", "services:read", "clients:read", "metrics:read", "checkout:write"].map(p => (
                        <label key={p} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                          <input type="checkbox" checked={newKey.permissions.includes(p)} onChange={e => {
                            setNewKey({ ...newKey, permissions: e.target.checked ? [...newKey.permissions, p] : newKey.permissions.filter(x => x !== p) })
                          }} style={{ accentColor: "#7a8f96" }} />
                          <span style={{ fontSize: "12px", color: "#7a8f96", fontFamily: "'Fira Code', monospace" }}>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div><label style={labelStyle}>Expiration</label>
                    <select value={newKey.expiresIn} onChange={e => setNewKey({ ...newKey, expiresIn: e.target.value })} style={{ ...inputStyle, appearance: "none" }}>
                      <option value="never">Never</option>
                      <option value="90days">90 Days</option>
                      <option value="1year">1 Year</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                  <button onClick={() => setShowKeyModal(false)} style={{ flex: 1, padding: "10px", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#7a8f96", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>Cancel</button>
                  <button onClick={generateApiKey} disabled={generatingKey || !newKey.name} style={{ flex: 1, padding: "10px", backgroundColor: "#7a8f96", color: "#06080d", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: generatingKey || !newKey.name ? 0.5 : 1 }}>{generatingKey ? "Generating..." : "Generate Key"}</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return <Suspense fallback={null}><SettingsInner /></Suspense>
}
