"use client"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

const ACC = "#7a8f96"
const cardStyle: React.CSSProperties = { backgroundColor: "#FBFBFB", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }

const STEPS = [
  { num: 1, label: "Invited", desc: "Admin creates invite, email + SMS sent to stylist" },
  { num: 2, label: "Started", desc: "Stylist opens the link" },
  { num: 3, label: "Personal Info", desc: "Name, DOB, address, emergency contact" },
  { num: 4, label: "Email Verified", desc: "6-digit code sent to email, rate-limited" },
  { num: 5, label: "Phone Verified", desc: "6-digit code sent via SMS" },
  { num: 6, label: "License Verified", desc: "TDLR number + license image upload" },
  { num: 7, label: "Gov ID Uploaded", desc: "Front + back of government ID" },
  { num: 8, label: "Insurance Uploaded", desc: "Liability insurance cert with carrier + expiry" },
  { num: 9, label: "W-9 Complete", desc: "Tax classification, SSN/EIN (encrypted at rest)" },
  { num: 10, label: "State Tax", desc: "Texas: no form needed. Other states: blocked for now" },
  { num: 11, label: "Direct Deposit", desc: "Bank routing + account (encrypted at rest)" },
  { num: 12, label: "NDA Signed", desc: "Non-disclosure agreement reviewed + signed" },
  { num: 13, label: "Comp Agreement", desc: "Compensation terms reviewed + signed" },
  { num: 14, label: "I-9 Section 1", desc: "W-2 only: citizenship/work authorization" },
  { num: 15, label: "Acknowledgments", desc: "9 policy acknowledgment checkboxes" },
  { num: 16, label: "Signed", desc: "Final signature + agreement text" },
  { num: 17, label: "Pending Review", desc: "Admin reviews all submissions" },
  { num: 18, label: "Background Check", desc: "Checkr driver_pro package ordered" },
  { num: 19, label: "BG Check Clear", desc: "Checkr returns clear (or manual review if consider)" },
  { num: 20, label: "I-9 Section 2", desc: "W-2 only: in-person doc review within 3 days" },
  { num: 21, label: "Approved", desc: "Admin approves enrollment" },
  { num: 22, label: "Square Synced", desc: "Team member created in Square with service assignments" },
  { num: 23, label: "Active", desc: "Fully onboarded, can use portal and be booked" },
]

export default function EnrollmentHelpPage() {
  return (
    <div style={{ padding: "48px 32px 32px 32px", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/staff/enrollments" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACC, textDecoration: "none", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Enrollments
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 600, color: "#1A1313", margin: "0 0 4px" }}>Enrollment Help</h1>
      <p style={{ fontSize: 14, color: "#525866", margin: "0 0 24px" }}>How the 23-step onboarding flow works</p>

      {/* State flow */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 16px" }}>Enrollment States</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {STEPS.map(s => (
            <div key={s.num} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: `${ACC}15`, color: ACC, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.num}</div>
              <div style={{ width: 160, fontSize: 14, fontWeight: 500, color: "#1A1313", flexShrink: 0 }}>{s.label}</div>
              <div style={{ fontSize: 13, color: "#525866" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Common tasks */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 16px" }}>Common Admin Tasks</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { title: "How to invite a new stylist", steps: ["Go to /staff/enrollments/new", "Fill in name, email, location, role", "Click 'Send Invite' -- email + SMS sent automatically", "Copy link if needed for manual sharing"] },
            { title: "How to approve an enrollment", steps: ["Go to /staff/enrollments", "Click Pending Review tab", "Click 'Review' on the enrollment", "Verify all sections look correct", "Click 'Approve' -- triggers background check + Square sync"] },
            { title: "How to reject with changes needed", steps: ["Open enrollment detail", "Click 'Reject'", "Enter reason (stylist will be notified)", "Stylist can re-submit, you'll see it again in queue"] },
          ].map(task => (
            <div key={task.title} style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", margin: "0 0 8px" }}>{task.title}</h3>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {task.steps.map((step, i) => <li key={i} style={{ fontSize: 13, color: "#525866", lineHeight: 1.8 }}>{step}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance checklist */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: "#1A1313", margin: "0 0 16px" }}>Compliance Checklist</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { item: "NDA template reviewed by lawyer", status: "pending" },
            { item: "Compensation agreement template reviewed by lawyer", status: "pending" },
            { item: "I-9 form compliance verified with USCIS guidelines", status: "pending" },
            { item: "Checkr account active (sandbox or production)", status: "pending" },
            { item: "BANK_ENCRYPTION_KEY set in all Vercel environments", status: "done" },
            { item: "Storage buckets created (run npm run setup:storage-buckets)", status: "pending" },
            { item: "Data retention policy documented", status: "done" },
          ].map(c => (
            <div key={c.item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              {c.status === "done" ? <CheckCircle2 size={14} color="#059669" /> : c.status === "pending" ? <Clock size={14} color="#d97706" /> : <AlertTriangle size={14} color="#dc2626" />}
              <span style={{ color: "#1A1313" }}>{c.item}</span>
              <span style={{ fontSize: 11, color: c.status === "done" ? "#059669" : "#d97706", fontWeight: 500 }}>{c.status === "done" ? "Done" : "Pending"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
