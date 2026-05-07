"use client"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Shield, CreditCard, FileText, User, Phone } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Enrollment = Record<string, any>

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1A1313" }}>{value || "Not provided"}</div>
    </div>
  )
}

export default function EnrollmentDetailPage() {
  const { id } = useParams()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showReject, setShowReject] = useState(false)

  useEffect(() => {
    fetch(`/api/onboarding/admin/${id}`).then(r => r.json()).then(d => setEnrollment(d.enrollment)).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function approve() {
    setActing(true)
    await fetch(`/api/onboarding/admin/${id}/approve`, { method: "POST" })
    const r = await fetch(`/api/onboarding/admin/${id}`)
    const d = await r.json()
    setEnrollment(d.enrollment)
    setActing(false)
  }

  async function reject() {
    setActing(true)
    await fetch(`/api/onboarding/admin/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: rejectReason }) })
    const r = await fetch(`/api/onboarding/admin/${id}`)
    const d = await r.json()
    setEnrollment(d.enrollment)
    setShowReject(false)
    setActing(false)
  }

  if (loading) return <div style={{ padding: "48px 32px", color: "#9ca3af" }}>Loading...</div>
  if (!enrollment) return <div style={{ padding: "48px 32px", color: "#9ca3af" }}>Enrollment not found</div>

  const isPending = enrollment.status === "pending_review" || enrollment.status === "signed" || enrollment.status === "completed"
  const ackFields = ["ackPolicies", "ackConfidentiality", "ackAtWill", "ackSafetyProtocol", "ackTechPolicy", "ackBackgroundCheck", "ackDrugFree", "ackSocialMedia", "ackSanitation", "ackEquipment", "ackDirectDeposit"]
  const ackLabels: Record<string, string> = {
    ackPolicies: "Policies", ackConfidentiality: "Confidentiality", ackAtWill: "At-Will", ackSafetyProtocol: "Safety",
    ackTechPolicy: "Technology", ackBackgroundCheck: "Background Check", ackDrugFree: "Drug-Free", ackSocialMedia: "Social Media",
    ackSanitation: "Sanitation", ackEquipment: "Equipment", ackDirectDeposit: "Direct Deposit",
  }

  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/staff/enrollments" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollments
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>{enrollment.firstName} {enrollment.lastName}</h1>
          <p style={{ fontSize: 14, color: "#525866", margin: 0 }}>{enrollment.role} at {enrollment.location?.name} -- {enrollment.email}</p>
        </div>
        {isPending && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={approve} disabled={acting} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "#059669", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: acting ? 0.5 : 1 }}>
              {acting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={16} />} Approve
            </button>
            <button onClick={() => setShowReject(true)} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <XCircle size={16} /> Reject
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Personal Info */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><User size={16} color={ACC} /><h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: 0 }}>Personal Information</h2></div>
          <Field label="Date of Birth" value={enrollment.dateOfBirth} />
          <Field label="Phone" value={enrollment.phone} />
          <Field label="Address" value={[enrollment.address, enrollment.city, enrollment.state, enrollment.zip].filter(Boolean).join(", ")} />
          <Field label="Emergency Contact" value={enrollment.emergencyName ? `${enrollment.emergencyName} (${enrollment.emergencyRelationship}) -- ${enrollment.emergencyPhone}` : null} />
        </div>

        {/* License */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><FileText size={16} color={ACC} /><h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: 0 }}>License</h2></div>
          <Field label="License Number" value={enrollment.licenseNumber} />
          <Field label="State" value={enrollment.licenseState} />
          <Field label="Expiration" value={enrollment.licenseExpiration} />
          <Field label="Type" value={enrollment.licenseType} />
          <Field label="Years Experience" value={enrollment.yearsOfExperience?.toString()} />
        </div>

        {/* W-9 */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Shield size={16} color={ACC} /><h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: 0 }}>W-9 Information</h2></div>
          <Field label="Legal Name" value={enrollment.w9LegalName} />
          <Field label="Business Name" value={enrollment.w9BusinessName} />
          <Field label="Tax Classification" value={enrollment.w9TaxClassification} />
          <Field label="SSN" value={enrollment.w9SsnMasked || enrollment.w9Ssn} />
          <Field label="EIN" value={enrollment.w9Ein} />
        </div>

        {/* Direct Deposit */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><CreditCard size={16} color={ACC} /><h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: 0 }}>Direct Deposit</h2></div>
          <Field label="Bank" value={enrollment.ddBankName} />
          <Field label="Name on Account" value={enrollment.ddNameOnAccount} />
          <Field label="Account Type" value={enrollment.ddAccountType} />
          <Field label="Routing" value={enrollment.ddRoutingMasked} />
          <Field label="Account" value={enrollment.ddAccountMasked} />
        </div>
      </div>

      {/* Acknowledgments */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 12px" }}>Acknowledgments</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {ackFields.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: enrollment[f] ? "#059669" : "#dc2626" }}>
              {enrollment[f] ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {ackLabels[f] || f}
            </div>
          ))}
        </div>
      </div>

      {/* Signature */}
      {(enrollment.signatureUrl || enrollment.signatureData) && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 12px" }}>Signature</h2>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {enrollment.signatureUrl ? (
              <img src={enrollment.signatureUrl} alt="Signature" style={{ maxWidth: 300, maxHeight: 100, border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }} />
            ) : enrollment.signatureData ? (
              <img src={enrollment.signatureData} alt="Signature" style={{ maxWidth: 300, maxHeight: 100, border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }} />
            ) : null}
            <div>
              <Field label="Signed by" value={enrollment.signedLegalName} />
              <Field label="Date" value={enrollment.signedDate} />
              {enrollment.agreementSignedAt && <Field label="Timestamp" value={new Date(enrollment.agreementSignedAt).toLocaleString()} />}
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowReject(false)}>
          <div style={{ ...cardStyle, maxWidth: 420, width: "90%", padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: "0 0 8px" }}>Reject Enrollment</h2>
            <p style={{ fontSize: 14, color: "#525866", margin: "0 0 16px" }}>Provide a reason. The stylist will be notified.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, color: "#1A1313", backgroundColor: "#fff", minHeight: 80, resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowReject(false)} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "transparent", border: "1px solid #e5e7eb", color: "#525866", cursor: "pointer" }}>Cancel</button>
              <button onClick={reject} disabled={!rejectReason.trim() || acting} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, backgroundColor: "#dc2626", color: "#fff", border: "none", cursor: "pointer", opacity: !rejectReason.trim() || acting ? 0.5 : 1 }}>Reject</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
