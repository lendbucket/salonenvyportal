"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getStylistAgreement, getManagerAgreement } from "@/lib/agreements";

type EnrollmentData = {
  id: string;
  inviteToken: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  locationName: string;
  locationId: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiration?: string;
  licenseType?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  w9LegalName?: string;
  w9BusinessName?: string;
  w9TaxClassification?: string;
  w9Address?: string;
  ddBankName?: string;
  ddAccountType?: string;
  ddNameOnAccount?: string;
  ackPolicies?: boolean;
  ackConfidentiality?: boolean;
  ackAtWill?: boolean;
  ackSafetyProtocol?: boolean;
  ackTechPolicy?: boolean;
  agreementSignedAt?: string;
  verificationCode?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

// --- Validation helpers ---
function validateRoutingNumber(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = routing.split("").map(Number);
  const checksum = (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5] + d[8])) % 10;
  return checksum === 0;
}

const KNOWN_BANKS = ["chase", "wells fargo", "bank of america", "citibank", "capital one", "td bank", "us bank", "pnc", "navy federal", "usaa", "frost", "comerica", "woodforest", "regions", "truist", "ally", "fifth third", "huntington", "citizens", "bmo", "key bank", "first national", "community", "credit union"];

function isKnownBank(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWN_BANKS.some((b) => lower.includes(b));
}

const STEPS = ["Welcome", "Personal Info", "Verify Contact", "License", "W-9", "Consents", "Direct Deposit", "Emergency Contact", "Agreement", "Complete"];

const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "8px", color: "#FBFBFB", fontSize: "16px", boxSizing: "border-box", outline: "none" };
const inputErrorStyle: React.CSSProperties = { ...inputStyle, border: "1px solid rgba(239,68,68,0.6)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" };
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23CDC9C0' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" };
const btnPrimary: React.CSSProperties = { width: "100%", padding: "14px", backgroundColor: "#CDC9C0", color: "#0f1d24", fontSize: "12px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: "8px", border: "none", cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "14px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.2)", borderRadius: "8px", color: "#CDC9C0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" };
const errText: React.CSSProperties = { color: "#f87171", fontSize: "11px", marginTop: "4px" };
const warnText: React.CSSProperties = { color: "#eab308", fontSize: "11px", marginTop: "4px" };

export default function EnrollmentPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form state
  const [personal, setPersonal] = useState({ phone: "", dateOfBirth: "", ssn: "", address: "", city: "", state: "TX", zip: "", emergencyName: "", emergencyPhone: "" });
  const [license, setLicense] = useState({ licenseNumber: "", licenseState: "TX", licenseExpiration: "", licenseType: "cosmetology", yearsOfExperience: "", specialties: [] as string[] });
  const [w9, setW9] = useState({ w9LegalName: "", w9BusinessName: "", w9TaxClassification: "individual", w9Ssn: "", w9Ein: "", w9Address: "" });
  const [dd, setDd] = useState({ ddBankName: "", ddRoutingNumber: "", ddRoutingConfirm: "", ddAccountNumber: "", ddAccountConfirm: "", ddAccountType: "checking", ddNameOnAccount: "" });
  const [consents, setConsents] = useState({ ackBackgroundCheck: false, ackDrugFree: false, ackSocialMedia: false, ackSanitation: false, ackEquipment: false, mediaConsent: "", ackDirectDeposit: false });
  const [agreement, setAgreement] = useState({ agreementTopDate: new Date().toISOString().split("T")[0], agreementContractorName: "", ackPolicies: false, ackConfidentiality: false, ackAtWill: false, ackSafetyProtocol: false, ackTechPolicy: false, agreementSignedName: "", signedSsnLast4: "", signedDate: new Date().toISOString().split("T")[0] });

  // Verification state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneResendTimer, setPhoneResendTimer] = useState(0);
  const [verifyError, setVerifyError] = useState("");

  // Bank warning acknowledged
  const [bankWarnAck, setBankWarnAck] = useState(false);

  // TDLR verification
  const [tdlrResult, setTdlrResult] = useState<{ found: boolean; holderName?: string; licenseType?: string; status?: string; isActive?: boolean; expirationDate?: string; statusColor?: "green" | "red" | "yellow" } | null>(null);
  const [tdlrChecking, setTdlrChecking] = useState(false);

  const verifyTdlr = async (licenseNum: string) => {
    if (!licenseNum) return;
    setTdlrChecking(true);
    setTdlrResult(null);
    try {
      const res = await fetch(`/api/tdlr/verify?license=${encodeURIComponent(licenseNum)}`);
      const data = await res.json();
      setTdlrResult(data);
      if (data.found && data.expirationDate && !license.licenseExpiration) {
        setLicense((prev) => ({ ...prev, licenseExpiration: new Date(data.expirationDate).toISOString().split("T")[0] }));
      }
    } catch { setTdlrResult({ found: false }); } finally { setTdlrChecking(false); }
  };

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => { params.then((p) => setToken(p.token)); }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/onboarding/enroll/${token}`).then((r) => r.json()).then((data) => {
      if (data.error) { setError(data.error); setLoading(false); return; }
      const e = data.enrollment;
      setEnrollment(e);
      if (e.status === "completed") { setStep(9); setVerificationCode(e.verificationCode || ""); }
      if (e.phone) setPersonal((p) => ({ ...p, phone: e.phone || "", dateOfBirth: e.dateOfBirth || "", address: e.address || "", city: e.city || "", state: e.state || "TX", zip: e.zip || "" }));
      if (e.emergencyName) setPersonal((p) => ({ ...p, emergencyName: e.emergencyName || "", emergencyPhone: e.emergencyPhone || "" }));
      if (e.licenseNumber) setLicense((p) => ({ ...p, licenseNumber: e.licenseNumber || "", licenseState: e.licenseState || "TX", licenseExpiration: e.licenseExpiration || "", licenseType: e.licenseType || "cosmetology" }));
      if (e.w9LegalName) setW9((p) => ({ ...p, w9LegalName: e.w9LegalName || "", w9BusinessName: e.w9BusinessName || "", w9TaxClassification: e.w9TaxClassification || "individual", w9Address: e.w9Address || "" }));
      if (e.ddBankName) setDd((p) => ({ ...p, ddBankName: e.ddBankName || "", ddAccountType: e.ddAccountType || "checking", ddNameOnAccount: e.ddNameOnAccount || "" }));
      if (e.emailVerified) setEmailVerified(true);
      if (e.phoneVerified) setPhoneVerified(true);
      setLoading(false);
    }).catch(() => { setError("Failed to load enrollment"); setLoading(false); });
  }, [token]);

  // Resend timers
  useEffect(() => { if (emailResendTimer > 0) { const t = setTimeout(() => setEmailResendTimer(emailResendTimer - 1), 1000); return () => clearTimeout(t); } }, [emailResendTimer]);
  useEffect(() => { if (phoneResendTimer > 0) { const t = setTimeout(() => setPhoneResendTimer(phoneResendTimer - 1), 1000); return () => clearTimeout(t); } }, [phoneResendTimer]);

  const saveStep = useCallback(async (stepName: string, data: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const bodyStr = JSON.stringify({ step: stepName, data });
      console.log(`[saveStep] ${stepName} — sending ${(bodyStr.length / 1024).toFixed(1)}KB, keys:`, Object.keys(data || {}));
      const res = await fetch(`/api/onboarding/enroll/${token}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: bodyStr });
      const result = await res.json();
      console.log(`[saveStep] ${stepName} — response:`, res.status, JSON.stringify(result).slice(0, 500));
      if (!res.ok) {
        const errMsg = result.error || `Step "${stepName}" failed (HTTP ${res.status}). Please try again.`;
        console.error(`[saveStep] ${stepName} FAILED:`, errMsg);
        setError(errMsg);
        setSaving(false);
        return false;
      }
      if (result.verificationCode) setVerificationCode(result.verificationCode);
      setSaving(false);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      console.error(`[saveStep] ${stepName} EXCEPTION:`, errMsg);
      setError(`Network error during "${stepName}": ${errMsg}`);
      setSaving(false);
      return false;
    }
  }, [token]);

  // Canvas drawing
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); isDrawingRef.current = true; const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return; const { x, y } = getCanvasCoords(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!isDrawingRef.current) return; e.preventDefault(); const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return; const { x, y } = getCanvasCoords(e); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#CDC9C0"; ctx.lineTo(x, y); ctx.stroke(); setHasSigned(true); };
  const endDraw = () => { isDrawingRef.current = false; };
  const clearSignature = () => { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); setHasSigned(false); };

  // --- Send email OTP ---
  const sendEmailOtp = async () => {
    if (!enrollment) return;
    setEmailSending(true); setVerifyError("");
    const res = await fetch("/api/onboarding/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: enrollment.email, enrollmentId: enrollment.id }) });
    const data = await res.json();
    setEmailSending(false);
    if (data.sent) { setEmailOtpSent(true); setEmailResendTimer(60); } else { setVerifyError(data.error || "Failed to send email"); }
  };
  const confirmEmailOtp = async () => {
    if (!enrollment) return;
    setVerifyError("");
    const res = await fetch("/api/onboarding/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollmentId: enrollment.id, action: "confirm", code: emailOtp }) });
    const data = await res.json();
    if (data.verified) { setEmailVerified(true); } else { setVerifyError(data.error || "Invalid code"); }
  };
  // --- Send phone OTP ---
  const [phoneSkipReason, setPhoneSkipReason] = useState("");
  const sendPhoneOtp = async () => {
    if (!enrollment || !personal.phone) return;
    setPhoneSending(true); setVerifyError("");
    const res = await fetch("/api/onboarding/verify-phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: personal.phone, enrollmentId: enrollment.id }) });
    const data = await res.json();
    setPhoneSending(false);
    if (data.skipped) {
      // SMS not available — auto-verify
      setPhoneVerified(true);
      setPhoneSkipReason(data.reason || "Phone verification skipped.");
      console.log("[verify-phone] Skipped:", data.reason);
    } else if (data.sent) {
      setPhoneOtpSent(true); setPhoneResendTimer(60);
    } else {
      setVerifyError(data.error || "Failed to send SMS");
    }
  };
  const confirmPhoneOtp = async () => {
    if (!enrollment) return;
    setVerifyError("");
    const res = await fetch("/api/onboarding/verify-phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollmentId: enrollment.id, action: "confirm", code: phoneOtp }) });
    const data = await res.json();
    if (data.verified) { setPhoneVerified(true); } else { setVerifyError(data.error || "Invalid code"); }
  };

  // --- Validation ---
  const validatePersonal = (): boolean => {
    const errs: Record<string, string> = {};
    if (!enrollment) return false;
    if (enrollment.firstName.length < 2) errs.firstName = "First name must be at least 2 characters";
    if (enrollment.lastName.length < 2) errs.lastName = "Last name must be at least 2 characters";
    if (!personal.phone || personal.phone.replace(/\D/g, "").length < 10) errs.phone = "Valid 10-digit phone required";
    if (!personal.dateOfBirth) { errs.dob = "Date of birth is required"; } else {
      const dob = new Date(personal.dateOfBirth + "T00:00:00");
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) errs.dob = "You must be at least 18 years old";
    }
    if (!personal.ssn || !/^\d{3}-\d{2}-\d{4}$/.test(personal.ssn)) errs.ssn = "SSN must be in format XXX-XX-XXXX";
    if (!personal.address) errs.address = "Street address is required";
    if (!personal.city) errs.city = "City is required";
    if (!personal.state) errs.state = "State is required";
    if (!personal.zip || !/^\d{5}$/.test(personal.zip)) errs.zip = "5-digit ZIP required";
    if (!personal.emergencyName) errs.emergencyName = "Emergency contact name required";
    if (!personal.emergencyPhone || personal.emergencyPhone.replace(/\D/g, "").length < 10) errs.emergencyPhone = "Valid emergency phone required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateDD = (): boolean => {
    const errs: Record<string, string> = {};
    if (dd.ddBankName.length < 3) errs.ddBankName = "Bank name must be at least 3 characters";
    if (!dd.ddNameOnAccount) errs.ddNameOnAccount = "Account holder name required";
    if (!validateRoutingNumber(dd.ddRoutingNumber)) errs.ddRoutingNumber = "Invalid routing number. Please check with your bank.";
    if (dd.ddRoutingNumber !== dd.ddRoutingConfirm) errs.ddRoutingConfirm = "Routing numbers do not match";
    if (!/^\d{4,17}$/.test(dd.ddAccountNumber)) errs.ddAccountNumber = "Account number must be 4-17 digits";
    if (dd.ddAccountNumber !== dd.ddAccountConfirm) errs.ddAccountConfirm = "Account numbers do not match";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // --- Step navigation ---
  const handleNext = async () => {
    setError(""); setFieldErrors({});
    switch (step) {
      case 0: setStep(1); break;
      case 1: { // Personal Info
        if (!validatePersonal()) return;
        // Store full SSN in sessionStorage for cross-validation later
        if (typeof window !== "undefined") sessionStorage.setItem("__enroll_ssn", personal.ssn);
        const ok = await saveStep("personal", { phone: personal.phone, dateOfBirth: personal.dateOfBirth, address: personal.address, city: personal.city, state: personal.state, zip: personal.zip, emergencyName: personal.emergencyName, emergencyPhone: personal.emergencyPhone });
        if (ok) setStep(2);
        break;
      }
      case 2: { // Verify Contact — must have both verified
        if (!emailVerified || !phoneVerified) { setVerifyError("Please verify both your email and phone number to continue."); return; }
        setStep(3);
        break;
      }
      case 3: { // License
        const ok = await saveStep("license", { ...license, yearsOfExperience: license.yearsOfExperience ? parseInt(license.yearsOfExperience, 10) : null, specialties: license.specialties.join(", ") });
        if (ok) setStep(4);
        break;
      }
      case 4: { // W-9
        const ok = await saveStep("w9", w9);
        if (ok) setStep(5);
        break;
      }
      case 5: { // Consents
        if (!consents.ackBackgroundCheck || !consents.ackDrugFree || !consents.ackSocialMedia || !consents.ackSanitation || !consents.ackEquipment || !consents.mediaConsent || !consents.ackDirectDeposit) {
          setError("All consent acknowledgments are required to continue.");
          return;
        }
        const ok = await saveStep("consents", consents);
        if (ok) setStep(6);
        break;
      }
      case 6: { // Direct Deposit
        if (!validateDD()) return;
        // Check bank name warning
        if (!isKnownBank(dd.ddBankName) && !bankWarnAck) { setFieldErrors({ ddBankName: "warn" }); return; }
        // Check account holder matches legal name
        const legalName = enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "";
        if (dd.ddNameOnAccount.toLowerCase() !== legalName.toLowerCase()) { setFieldErrors((prev) => ({ ...prev, ddNameOnAccount: "warn" })); }
        const ok = await saveStep("direct_deposit", { ddBankName: dd.ddBankName, ddRoutingNumber: dd.ddRoutingNumber, ddAccountNumber: dd.ddAccountNumber, ddAccountType: dd.ddAccountType, ddNameOnAccount: dd.ddNameOnAccount });
        if (ok) setStep(7);
        break;
      }
      case 7: { // Emergency Contact (already collected in step 1, just confirm and save)
        const ok = await saveStep("emergency", { emergencyName: personal.emergencyName, emergencyRelationship: "other", emergencyPhone: personal.emergencyPhone });
        if (ok) setStep(8);
        break;
      }
      case 8: { // Agreement
        // SSN cross-validation
        const storedSsn = typeof window !== "undefined" ? sessionStorage.getItem("__enroll_ssn") || "" : "";
        const storedLast4 = storedSsn.replace(/-/g, "").slice(-4);
        if (agreement.signedSsnLast4 !== storedLast4) {
          setFieldErrors({ signedSsnLast4: "SSN does not match what you entered in Personal Information. Please re-enter." });
          return;
        }
        const sigData = canvasRef.current?.toDataURL("image/png") || "";
        const ok = await saveStep("agreement", { ...agreement, signedLegalName: resolvedSignedName, signatureData: sigData });
        if (ok) {
          const ok2 = await saveStep("complete", {});
          if (ok2) { setStep(9); if (typeof window !== "undefined") sessionStorage.removeItem("__enroll_ssn"); }
        }
        break;
      }
    }
  };

  if (loading) return (<div style={{ minHeight: "100vh", backgroundColor: "#0f1d24", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#CDC9C0", fontSize: "14px", fontWeight: 600 }}>Loading...</div></div>);
  if (error && !enrollment) return (<div style={{ minHeight: "100vh", backgroundColor: "#0f1d24", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}><div style={{ textAlign: "center" }}><span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#94A3B8", display: "block", marginBottom: "16px" }}>lock</span><h2 style={{ color: "#FBFBFB", fontSize: "22px", fontWeight: 800, margin: "0 0 8px" }}>Link Unavailable</h2><p style={{ color: "#94A3B8", fontSize: "14px" }}>{error}</p></div></div>);

  const allAcked = agreement.ackPolicies && agreement.ackConfidentiality && agreement.ackAtWill && agreement.ackSafetyProtocol && agreement.ackTechPolicy;
  const resolvedSignedName = agreement.agreementSignedName || agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "");
  const agreementValid = allAcked && hasSigned && resolvedSignedName && agreement.signedSsnLast4.length === 4 && agreement.signedDate;
  const totalSteps = STEPS.length;

  const CheckboxRow = ({ checked, onChange, text }: { checked: boolean; onChange: (v: boolean) => void; text: string }) => (
    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: "2px", accentColor: "#CDC9C0", width: "16px", height: "16px", flexShrink: 0 }} />
      <span style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.4 }}>{text}</span>
    </label>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1d24" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />
      <div style={{ backgroundColor: "#0a1520", borderBottom: "1px solid rgba(205,201,192,0.08)", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#22c55e" }}>lock</span>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>256-bit SSL encrypted</span>
      </div>
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px", paddingTop: "8px" }}>
          <img src="/images/logo-white.png" alt="Salon Envy" style={{ height: "50px", width: "auto" }} />
        </div>
        {step < 9 && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.08em", textTransform: "uppercase" }}>Step {step + 1} of {totalSteps}</span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(205,201,192,0.4)", letterSpacing: "0.05em" }}>{STEPS[step]}</span>
            </div>
            <div style={{ height: "3px", backgroundColor: "rgba(205,201,192,0.1)", borderRadius: "4px" }}>
              <div style={{ height: "100%", width: `${((step + 1) / totalSteps) * 100}%`, backgroundColor: "#CDC9C0", borderRadius: "4px", transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}
        {error && (<div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", color: "#f87171", fontSize: "13px" }}>{error}</div>)}

        <div style={{ backgroundColor: "#142127", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "12px", padding: "28px 24px" }}>

          {/* Step 0: Welcome */}
          {step === 0 && enrollment && (
            <div>
              <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>Welcome, {enrollment.firstName}!</h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>You have been invited to join <strong style={{ color: "#CDC9C0" }}>Salon Envy - {enrollment.locationName}</strong> as a <strong style={{ color: "#CDC9C0" }}>{enrollment.role === "MANAGER" ? "Manager" : "Stylist"}</strong>.</p>
              <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>This enrollment process will collect your personal information, licensing details, tax information, and direct deposit setup. All data is transmitted securely.</p>
              <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", padding: "16px", marginBottom: "24px", border: "1px solid rgba(205,201,192,0.08)" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>What you will need</div>
                {["Government-issued photo ID", "Cosmetology license number", "Social Security Number (XXX-XX-XXXX)", "Bank account details (routing + account number)", "Emergency contact information"].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#CDC9C0" }}>check_circle</span>
                    <span style={{ fontSize: "13px", color: "#94A3B8" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleNext} style={btnPrimary}>Begin Enrollment</button>
            </div>
          )}

          {/* Step 1: Personal Info + Emergency + SSN */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>Personal Information</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>All fields are required.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Phone Number *</label>
                  <input type="tel" value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} placeholder="(361) 555-0100" style={fieldErrors.phone ? inputErrorStyle : inputStyle} />
                  {fieldErrors.phone && <p style={errText}>{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Date of Birth *</label>
                  <input type="date" value={personal.dateOfBirth} onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })} style={fieldErrors.dob ? inputErrorStyle : inputStyle} />
                  {fieldErrors.dob && <p style={errText}>{fieldErrors.dob}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Social Security Number *</label>
                  <input type="password" value={personal.ssn} onChange={(e) => setPersonal({ ...personal, ssn: e.target.value })} placeholder="XXX-XX-XXXX" maxLength={11} style={fieldErrors.ssn ? inputErrorStyle : inputStyle} />
                  {fieldErrors.ssn && <p style={errText}>{fieldErrors.ssn}</p>}
                  <p style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>Format: XXX-XX-XXXX. Stored securely; only last 4 digits are kept after submission.</p>
                </div>
                <div>
                  <label style={labelStyle}>Street Address *</label>
                  <input value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} placeholder="123 Main St" style={fieldErrors.address ? inputErrorStyle : inputStyle} />
                  {fieldErrors.address && <p style={errText}>{fieldErrors.address}</p>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>City *</label>
                    <input value={personal.city} onChange={(e) => setPersonal({ ...personal, city: e.target.value })} placeholder="City" style={fieldErrors.city ? inputErrorStyle : inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>State *</label>
                    <input value={personal.state} onChange={(e) => setPersonal({ ...personal, state: e.target.value })} placeholder="TX" maxLength={2} style={fieldErrors.state ? inputErrorStyle : inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP *</label>
                    <input value={personal.zip} onChange={(e) => setPersonal({ ...personal, zip: e.target.value })} placeholder="78401" maxLength={5} style={fieldErrors.zip ? inputErrorStyle : inputStyle} />
                  </div>
                </div>
                <div style={{ borderTop: "1px solid rgba(205,201,192,0.1)", paddingTop: "16px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Emergency Contact</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>Full Name *</label>
                      <input value={personal.emergencyName} onChange={(e) => setPersonal({ ...personal, emergencyName: e.target.value })} placeholder="Contact name" style={fieldErrors.emergencyName ? inputErrorStyle : inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Phone *</label>
                      <input type="tel" value={personal.emergencyPhone} onChange={(e) => setPersonal({ ...personal, emergencyPhone: e.target.value })} placeholder="(xxx) xxx-xxxx" style={fieldErrors.emergencyPhone ? inputErrorStyle : inputStyle} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="button" onClick={() => setStep(0)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Continue"}</button>
              </div>
            </div>
          )}

          {/* Step 2: Verify Contact */}
          {step === 2 && enrollment && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>Verify Your Contact Info</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>We need to verify your email and phone number before proceeding.</p>
              {verifyError && <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", color: "#f87171", fontSize: "12px" }}>{verifyError}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Email verification */}
                <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", padding: "16px", border: `1px solid ${emailVerified ? "rgba(34,197,94,0.3)" : "rgba(205,201,192,0.08)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.1em", textTransform: "uppercase" }}>Email</div>
                    {emailVerified && <span style={{ fontSize: "10px", fontWeight: 700, color: "#22c55e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Verified</span>}
                  </div>
                  <p style={{ fontSize: "14px", color: "#FBFBFB", margin: "0 0 12px" }}>{enrollment.email}</p>
                  {!emailVerified && (
                    <>
                      {!emailOtpSent ? (
                        <button type="button" onClick={sendEmailOtp} disabled={emailSending} style={{ ...btnPrimary, fontSize: "11px", padding: "10px", opacity: emailSending ? 0.5 : 1 }}>{emailSending ? "Sending..." : "Send Verification Code"}</button>
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input value={emailOtp} onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" maxLength={6} style={{ ...inputStyle, flex: 1 }} />
                          <button type="button" onClick={confirmEmailOtp} disabled={emailOtp.length !== 6} style={{ ...btnPrimary, width: "auto", padding: "10px 20px", opacity: emailOtp.length !== 6 ? 0.5 : 1 }}>Verify</button>
                        </div>
                      )}
                      {emailOtpSent && !emailVerified && (
                        <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "8px" }}>
                          {emailResendTimer > 0 ? `Resend in ${emailResendTimer}s` : <button type="button" onClick={sendEmailOtp} style={{ background: "none", border: "none", color: "#CDC9C0", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>Resend code</button>}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {/* Phone verification */}
                <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", padding: "16px", border: `1px solid ${phoneVerified ? "rgba(34,197,94,0.3)" : "rgba(205,201,192,0.08)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.1em", textTransform: "uppercase" }}>Phone</div>
                    {phoneVerified && <span style={{ fontSize: "10px", fontWeight: 700, color: "#22c55e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Verified</span>}
                  </div>
                  <p style={{ fontSize: "14px", color: "#FBFBFB", margin: "0 0 12px" }}>{personal.phone}</p>
                  {phoneVerified && phoneSkipReason && (
                    <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0", fontStyle: "italic" }}>{phoneSkipReason}</p>
                  )}
                  {!phoneVerified && (
                    <>
                      {!phoneOtpSent ? (
                        <button type="button" onClick={sendPhoneOtp} disabled={phoneSending} style={{ ...btnPrimary, fontSize: "11px", padding: "10px", opacity: phoneSending ? 0.5 : 1 }}>{phoneSending ? "Sending..." : "Send Verification Code"}</button>
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" maxLength={6} style={{ ...inputStyle, flex: 1 }} />
                          <button type="button" onClick={confirmPhoneOtp} disabled={phoneOtp.length !== 6} style={{ ...btnPrimary, width: "auto", padding: "10px 20px", opacity: phoneOtp.length !== 6 ? 0.5 : 1 }}>Verify</button>
                        </div>
                      )}
                      {phoneOtpSent && !phoneVerified && (
                        <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "8px" }}>
                          {phoneResendTimer > 0 ? `Resend in ${phoneResendTimer}s` : <button type="button" onClick={sendPhoneOtp} style={{ background: "none", border: "none", color: "#CDC9C0", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>Resend code</button>}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="button" onClick={() => setStep(1)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={!emailVerified || !phoneVerified} style={{ ...btnPrimary, flex: 2, opacity: !emailVerified || !phoneVerified ? 0.5 : 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: License */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>License Information</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Your professional cosmetology license details.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div><label style={labelStyle}>License Type</label><select value={license.licenseType} onChange={(e) => setLicense({ ...license, licenseType: e.target.value })} style={selectStyle}><option value="cosmetology">Cosmetology</option><option value="barber">Barber</option><option value="esthetician">Esthetician</option><option value="nail_tech">Nail Technician</option><option value="other">Other</option></select></div>
                <div><label style={labelStyle}>License Number *</label><input value={license.licenseNumber} onChange={(e) => setLicense({ ...license, licenseNumber: e.target.value })} onBlur={() => { if (license.licenseNumber && license.licenseState?.toUpperCase() === "TX") verifyTdlr(license.licenseNumber); }} placeholder="License number" style={inputStyle} />{license.licenseState?.toUpperCase() === "TX" && <p style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4px" }}>Texas licenses are auto-verified via TDLR.</p>}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={labelStyle}>State Issued</label><input value={license.licenseState} onChange={(e) => setLicense({ ...license, licenseState: e.target.value })} placeholder="TX" maxLength={2} style={inputStyle} /></div><div><label style={labelStyle}>Expiration Date</label><input type="date" value={license.licenseExpiration} onChange={(e) => setLicense({ ...license, licenseExpiration: e.target.value })} style={inputStyle} /></div></div>
                <div><label style={labelStyle}>Years of Experience</label><input type="number" min="0" max="50" value={license.yearsOfExperience} onChange={(e) => setLicense({ ...license, yearsOfExperience: e.target.value })} placeholder="0" style={inputStyle} /></div>
                <div><label style={labelStyle}>Specialties</label><div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>{["Color", "Cuts", "Extensions", "Highlights", "Balayage", "Brazilian Blowout", "Keratin", "Updos", "Men's Cuts"].map((s) => (<label key={s} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", backgroundColor: license.specialties.includes(s) ? "rgba(205,201,192,0.12)" : "#1a2a32", border: `1px solid ${license.specialties.includes(s) ? "rgba(205,201,192,0.3)" : "rgba(205,201,192,0.1)"}`, borderRadius: "6px", padding: "6px 10px" }}><input type="checkbox" checked={license.specialties.includes(s)} onChange={(e) => { if (e.target.checked) setLicense({ ...license, specialties: [...license.specialties, s] }); else setLicense({ ...license, specialties: license.specialties.filter((x) => x !== s) }); }} style={{ accentColor: "#CDC9C0", width: "14px", height: "14px" }} /><span style={{ fontSize: "12px", color: "#CDC9C0" }}>{s}</span></label>))}</div></div>
                {tdlrChecking && (<div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#1a2a32", borderRadius: "8px", padding: "12px 16px", border: "1px solid rgba(205,201,192,0.08)" }}><svg style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#CDC9C0" strokeWidth="2" opacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="#CDC9C0" strokeWidth="2" strokeLinecap="round" /></svg><style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style><span style={{ fontSize: "12px", color: "#CDC9C0" }}>Verifying with TDLR...</span></div>)}
                {tdlrResult && !tdlrChecking && (<div style={{ backgroundColor: tdlrResult.statusColor === "green" ? "rgba(16,185,129,0.08)" : tdlrResult.statusColor === "red" ? "rgba(239,68,68,0.08)" : "rgba(234,179,8,0.08)", border: `1px solid ${tdlrResult.statusColor === "green" ? "rgba(16,185,129,0.25)" : tdlrResult.statusColor === "red" ? "rgba(239,68,68,0.25)" : "rgba(234,179,8,0.25)"}`, borderRadius: "8px", padding: "12px 16px" }}>{tdlrResult.found ? (<div><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", backgroundColor: tdlrResult.statusColor === "green" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", color: tdlrResult.statusColor === "green" ? "#10B981" : "#EF4444" }}>{tdlrResult.statusColor === "green" ? "TDLR Verified" : "TDLR " + tdlrResult.status}</span>{tdlrResult.holderName && <p style={{ fontSize: "12px", color: "#94A3B8", margin: "6px 0 0" }}>Holder: <strong style={{ color: "#CDC9C0" }}>{tdlrResult.holderName}</strong></p>}{tdlrResult.expirationDate && <p style={{ fontSize: "12px", color: "#94A3B8", margin: "2px 0 0" }}>Expires: {new Date(tdlrResult.expirationDate).toLocaleDateString()}</p>}</div>) : (<p style={{ fontSize: "12px", color: "#EAB308", margin: 0 }}>License not found in TDLR database.</p>)}</div>)}
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}><button type="button" onClick={() => setStep(2)} style={{ ...btnSecondary, flex: 1 }}>Back</button><button type="button" onClick={handleNext} disabled={saving || !license.licenseNumber} style={{ ...btnPrimary, flex: 2, opacity: saving || !license.licenseNumber ? 0.5 : 1 }}>{saving ? "Saving..." : "Continue"}</button></div>
            </div>
          )}

          {/* Step 4: W-9 */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>W-9 Tax Information</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Required for tax reporting. This information is encrypted and secure.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div><label style={labelStyle}>Legal Name (as shown on tax return) *</label><input value={w9.w9LegalName} onChange={(e) => setW9({ ...w9, w9LegalName: e.target.value })} placeholder="Full legal name" style={inputStyle} /></div>
                <div><label style={labelStyle}>Business Name (if different)</label><input value={w9.w9BusinessName} onChange={(e) => setW9({ ...w9, w9BusinessName: e.target.value })} placeholder="Optional" style={inputStyle} /></div>
                <div><label style={labelStyle}>Tax Classification</label><select value={w9.w9TaxClassification} onChange={(e) => setW9({ ...w9, w9TaxClassification: e.target.value })} style={selectStyle}><option value="individual">Individual / Sole Proprietor</option><option value="llc_single">LLC - Single Member</option><option value="llc_partnership">LLC - Partnership</option><option value="llc_corp">LLC - C Corporation</option><option value="llc_scorp">LLC - S Corporation</option><option value="other">Other</option></select></div>
                <div><label style={labelStyle}>Social Security Number (SSN) *</label><input type="password" value={w9.w9Ssn} onChange={(e) => setW9({ ...w9, w9Ssn: e.target.value })} placeholder="XXX-XX-XXXX" maxLength={11} style={inputStyle} /></div>
                <div><label style={labelStyle}>EIN (if applicable)</label><input value={w9.w9Ein} onChange={(e) => setW9({ ...w9, w9Ein: e.target.value })} placeholder="Optional" style={inputStyle} /></div>
                <div><label style={labelStyle}>Address</label><input value={w9.w9Address} onChange={(e) => setW9({ ...w9, w9Address: e.target.value })} placeholder="Tax filing address" style={inputStyle} /></div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}><button type="button" onClick={() => setStep(3)} style={{ ...btnSecondary, flex: 1 }}>Back</button><button type="button" onClick={handleNext} disabled={saving || !w9.w9LegalName || !w9.w9Ssn} style={{ ...btnPrimary, flex: 2, opacity: saving || !w9.w9LegalName || !w9.w9Ssn ? 0.5 : 1 }}>{saving ? "Saving..." : "Continue"}</button></div>
            </div>
          )}

          {/* Step 5: Fortune 500 Consents */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>Acknowledgments &amp; Consents</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Please review and acknowledge each item below.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <CheckboxRow checked={consents.ackBackgroundCheck} onChange={(v) => setConsents({ ...consents, ackBackgroundCheck: v })} text="I consent to Salon Envy conducting a background check as a condition of engagement. I understand this may include criminal history, identity verification, and professional license verification." />
                <CheckboxRow checked={consents.ackDrugFree} onChange={(v) => setConsents({ ...consents, ackDrugFree: v })} text="I acknowledge Salon Envy maintains a drug-free workplace policy. I agree to comply with this policy and understand that violation is grounds for immediate termination." />
                <CheckboxRow checked={consents.ackSocialMedia} onChange={(v) => setConsents({ ...consents, ackSocialMedia: v })} text="I have read and agree to the Salon Envy Social Media Policy. I understand I must tag @salonenvyusa in all work posts, may not post client photos without consent, and may not make disparaging posts about the salon." />
                <CheckboxRow checked={consents.ackSanitation} onChange={(v) => setConsents({ ...consents, ackSanitation: v })} text="I certify that I am trained in and will comply with all TDLR sanitation requirements including proper tool disinfection, single-use item policies, and safe chemical handling." />
                <CheckboxRow checked={consents.ackEquipment} onChange={(v) => setConsents({ ...consents, ackEquipment: v })} text="I acknowledge I am responsible for my own hot tools and implements. I will not use Salon equipment without explicit permission." />
                <div style={{ borderTop: "1px solid rgba(205,201,192,0.1)", paddingTop: "14px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Photo/Media Consent</div>
                  <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.4, margin: "0 0 10px" }}>I grant Salon Envy USA LLC permission to photograph/video me at work for use in marketing, social media, and training materials.</p>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}><input type="radio" name="mediaConsent" value="yes" checked={consents.mediaConsent === "yes"} onChange={() => setConsents({ ...consents, mediaConsent: "yes" })} style={{ accentColor: "#CDC9C0" }} /><span style={{ fontSize: "13px", color: "#94A3B8" }}>Yes, I consent</span></label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}><input type="radio" name="mediaConsent" value="no" checked={consents.mediaConsent === "no"} onChange={() => setConsents({ ...consents, mediaConsent: "no" })} style={{ accentColor: "#CDC9C0" }} /><span style={{ fontSize: "13px", color: "#94A3B8" }}>No, I decline</span></label>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid rgba(205,201,192,0.1)", paddingTop: "14px" }}>
                  <CheckboxRow checked={consents.ackDirectDeposit} onChange={(v) => setConsents({ ...consents, ackDirectDeposit: v })} text="I authorize Salon Envy USA LLC and its payroll processor to initiate electronic credits to the bank account I provide below. This authorization will remain in effect until I provide written notice to cancel." />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}><button type="button" onClick={() => setStep(4)} style={{ ...btnSecondary, flex: 1 }}>Back</button><button type="button" onClick={handleNext} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Continue"}</button></div>
            </div>
          )}

          {/* Step 6: Direct Deposit with validation */}
          {step === 6 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>Direct Deposit</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Banking info is used for direct deposit only and is stored securely.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Bank Name *</label>
                  <input value={dd.ddBankName} onChange={(e) => { setDd({ ...dd, ddBankName: e.target.value }); setBankWarnAck(false); }} placeholder="Bank of America, Chase, etc." style={fieldErrors.ddBankName ? (fieldErrors.ddBankName === "warn" ? { ...inputStyle, border: "1px solid rgba(234,179,8,0.5)" } : inputErrorStyle) : inputStyle} />
                  {fieldErrors.ddBankName === "warn" && !bankWarnAck && (<div style={{ marginTop: "6px" }}><p style={warnText}>Please enter your full bank name (e.g. Chase Bank, Wells Fargo)</p><button type="button" onClick={() => { setBankWarnAck(true); setFieldErrors({}); }} style={{ background: "none", border: "none", color: "#eab308", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0, marginTop: "2px" }}>I confirm this is correct</button></div>)}
                  {fieldErrors.ddBankName && fieldErrors.ddBankName !== "warn" && <p style={errText}>{fieldErrors.ddBankName}</p>}
                </div>
                <div><label style={labelStyle}>Name on Account *</label><input value={dd.ddNameOnAccount} onChange={(e) => setDd({ ...dd, ddNameOnAccount: e.target.value })} placeholder="Name as it appears on account" style={fieldErrors.ddNameOnAccount === "warn" ? { ...inputStyle, border: "1px solid rgba(234,179,8,0.5)" } : fieldErrors.ddNameOnAccount ? inputErrorStyle : inputStyle} />{fieldErrors.ddNameOnAccount === "warn" && <p style={warnText}>Account holder name should match your legal name</p>}{fieldErrors.ddNameOnAccount && fieldErrors.ddNameOnAccount !== "warn" && <p style={errText}>{fieldErrors.ddNameOnAccount}</p>}</div>
                <div><label style={labelStyle}>Account Type</label><select value={dd.ddAccountType} onChange={(e) => setDd({ ...dd, ddAccountType: e.target.value })} style={selectStyle}><option value="checking">Checking</option><option value="savings">Savings</option></select></div>
                <div><label style={labelStyle}>Routing Number *</label><input type="password" value={dd.ddRoutingNumber} onChange={(e) => setDd({ ...dd, ddRoutingNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="9-digit routing number" maxLength={9} style={fieldErrors.ddRoutingNumber ? inputErrorStyle : inputStyle} />{fieldErrors.ddRoutingNumber && <p style={errText}>{fieldErrors.ddRoutingNumber}</p>}</div>
                <div><label style={labelStyle}>Confirm Routing Number *</label><input type="password" value={dd.ddRoutingConfirm} onChange={(e) => setDd({ ...dd, ddRoutingConfirm: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="Re-enter routing number" maxLength={9} style={fieldErrors.ddRoutingConfirm ? inputErrorStyle : inputStyle} />{fieldErrors.ddRoutingConfirm && <p style={errText}>{fieldErrors.ddRoutingConfirm}</p>}</div>
                <div><label style={labelStyle}>Account Number *</label><input type="password" value={dd.ddAccountNumber} onChange={(e) => setDd({ ...dd, ddAccountNumber: e.target.value.replace(/\D/g, "").slice(0, 17) })} placeholder="Account number" maxLength={17} style={fieldErrors.ddAccountNumber ? inputErrorStyle : inputStyle} />{fieldErrors.ddAccountNumber && <p style={errText}>{fieldErrors.ddAccountNumber}</p>}</div>
                <div><label style={labelStyle}>Confirm Account Number *</label><input type="password" value={dd.ddAccountConfirm} onChange={(e) => setDd({ ...dd, ddAccountConfirm: e.target.value.replace(/\D/g, "").slice(0, 17) })} placeholder="Re-enter account number" maxLength={17} style={fieldErrors.ddAccountConfirm ? inputErrorStyle : inputStyle} />{fieldErrors.ddAccountConfirm && <p style={errText}>{fieldErrors.ddAccountConfirm}</p>}</div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}><button type="button" onClick={() => setStep(5)} style={{ ...btnSecondary, flex: 1 }}>Back</button><button type="button" onClick={handleNext} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Continue"}</button></div>
            </div>
          )}

          {/* Step 7: Emergency Contact Confirm */}
          {step === 7 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>Confirm Emergency Contact</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Please confirm the emergency contact you entered earlier.</p>
              <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", padding: "16px", border: "1px solid rgba(205,201,192,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><span style={{ fontSize: "13px", color: "#94A3B8" }}>Name</span><span style={{ fontSize: "13px", color: "#FBFBFB", fontWeight: 600 }}>{personal.emergencyName}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "13px", color: "#94A3B8" }}>Phone</span><span style={{ fontSize: "13px", color: "#FBFBFB", fontWeight: 600 }}>{personal.emergencyPhone}</span></div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}><button type="button" onClick={() => setStep(6)} style={{ ...btnSecondary, flex: 1 }}>Back</button><button type="button" onClick={handleNext} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Continue"}</button></div>
            </div>
          )}

          {/* Step 8: Agreement */}
          {step === 8 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 8px" }}>{enrollment?.role === "MANAGER" ? "Manager Contractor Agreement" : "Hair Stylist Agreement"}</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 20px" }}>Please review the agreement below and sign.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div><label style={labelStyle}>Agreement Date</label><input type="date" value={agreement.agreementTopDate} onChange={(e) => setAgreement({ ...agreement, agreementTopDate: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Full Legal Name</label><input value={agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "")} onChange={(e) => setAgreement({ ...agreement, agreementContractorName: e.target.value })} placeholder="Full legal name" style={inputStyle} /></div>
              </div>
              <div style={{ maxHeight: "260px", overflowY: "auto", backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "8px", padding: "16px", marginBottom: "20px", fontSize: "12px", color: "#94A3B8", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                {enrollment?.role === "MANAGER"
                  ? getManagerAgreement({ name: agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : ""), location: enrollment?.locationName || "", startDate: agreement.agreementTopDate ? new Date(agreement.agreementTopDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "___________", commissionRate: 40, managementFee: 200 })
                  : getStylistAgreement({ name: agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : ""), location: enrollment?.locationName || "", startDate: agreement.agreementTopDate ? new Date(agreement.agreementTopDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "___________", commissionRate: 40 })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                {[
                  { key: "ackPolicies" as const, text: "I have read and agree to all Salon Envy workplace policies" },
                  { key: "ackConfidentiality" as const, text: "I agree to maintain confidentiality of all proprietary information" },
                  { key: "ackAtWill" as const, text: "I understand this is an at-will independent contractor engagement" },
                  { key: "ackSafetyProtocol" as const, text: "I agree to comply with all safety, health, and sanitation protocols" },
                  { key: "ackTechPolicy" as const, text: "I agree to the branding, social media, and media ownership policies" },
                ].map((item) => (
                  <CheckboxRow key={item.key} checked={agreement[item.key]} onChange={(v) => setAgreement({ ...agreement, [item.key]: v })} text={item.text} />
                ))}
              </div>
              <div style={{ marginBottom: "16px" }}><label style={labelStyle}>Signature</label><div style={{ position: "relative", backgroundColor: "#1a2a32", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.15)" }}><canvas ref={canvasRef} width={500} height={150} style={{ width: "100%", height: "120px", borderRadius: "8px", touchAction: "none", cursor: "crosshair" }} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />{!hasSigned && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "rgba(205,201,192,0.25)", fontSize: "13px", pointerEvents: "none" }}>Sign here</div>}<button type="button" onClick={clearSignature} style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.4)", border: "none", color: "#94A3B8", fontSize: "10px", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Clear</button></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div><label style={labelStyle}>Full Legal Name</label><input value={agreement.agreementSignedName || agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "")} onChange={(e) => setAgreement({ ...agreement, agreementSignedName: e.target.value })} placeholder="Full legal name" style={inputStyle} /></div>
                <div><label style={labelStyle}>SSN Last 4</label><input type="password" value={agreement.signedSsnLast4} onChange={(e) => setAgreement({ ...agreement, signedSsnLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="XXXX" maxLength={4} style={fieldErrors.signedSsnLast4 ? inputErrorStyle : inputStyle} />{fieldErrors.signedSsnLast4 && <p style={errText}>{fieldErrors.signedSsnLast4}</p>}</div>
                <div><label style={labelStyle}>Date</label><input type="date" value={agreement.signedDate} onChange={(e) => setAgreement({ ...agreement, signedDate: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)", padding: "16px", marginBottom: "20px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Salon Envy USA LLC (Pre-Executed)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><div style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)", marginBottom: "2px" }}>Authorized Signor</div><div style={{ fontSize: "14px", fontWeight: 700, color: "#CDC9C0", fontStyle: "italic" }}>Robert R. Reyna</div></div><div><div style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)", marginBottom: "2px" }}>Date</div><div style={{ fontSize: "14px", color: "#CDC9C0" }}>{agreement.agreementTopDate ? new Date(agreement.agreementTopDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}</div></div></div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}><button type="button" onClick={() => setStep(7)} style={{ ...btnSecondary, flex: 1 }}>Back</button><button type="button" onClick={handleNext} disabled={saving || !agreementValid} style={{ ...btnPrimary, flex: 2, opacity: saving || !agreementValid ? 0.5 : 1 }}>{saving ? "Submitting..." : "Sign & Complete"}</button></div>
            </div>
          )}

          {/* Step 9: Complete */}
          {step === 9 && enrollment && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "rgba(34,197,94,0.1)", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}><span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#22c55e" }}>check_circle</span></div>
              <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#FBFBFB", margin: "0 0 12px" }}>Enrollment Complete!</h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>Thank you, {enrollment.firstName}. Your enrollment has been submitted successfully.</p>
              {verificationCode && (<div style={{ backgroundColor: "#1a2a32", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid rgba(205,201,192,0.15)" }}><div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8px" }}>Your Verification Code</div><div style={{ fontSize: "36px", fontWeight: 900, color: "#CDC9C0", letterSpacing: "0.15em", fontFamily: "monospace" }}>{verificationCode}</div><p style={{ fontSize: "12px", color: "#94A3B8", margin: "12px 0 0" }}>Save this code. You may be asked for it on your first day.</p></div>)}
              <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", padding: "16px", textAlign: "left", border: "1px solid rgba(205,201,192,0.08)" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>What happens next</div>
                {["Your information will be reviewed by management", "You will receive an email with your login credentials", "On your first day, bring your ID and license for verification"].map((item, i) => (<div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}><span style={{ color: "#CDC9C0", fontSize: "13px", fontWeight: 700, minWidth: "18px" }}>{i + 1}.</span><span style={{ fontSize: "13px", color: "#94A3B8" }}>{item}</span></div>))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
