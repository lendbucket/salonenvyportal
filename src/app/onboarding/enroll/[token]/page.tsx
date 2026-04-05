"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
};

const STEPS = [
  "Welcome",
  "Personal Info",
  "License",
  "W-9",
  "Direct Deposit",
  "Emergency Contact",
  "Agreement",
  "Complete",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  backgroundColor: "#1a2a32",
  border: "1px solid rgba(205,201,192,0.15)",
  borderRadius: "8px",
  color: "#FFFFFF",
  fontSize: "16px",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  color: "#CDC9C0",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: "6px",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23CDC9C0' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: "32px",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  backgroundColor: "#CDC9C0",
  color: "#0f1d24",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "14px",
  backgroundColor: "transparent",
  border: "1px solid rgba(205,201,192,0.2)",
  borderRadius: "8px",
  color: "#CDC9C0",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  cursor: "pointer",
};

export default function EnrollmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  // Form state
  const [personal, setPersonal] = useState({
    phone: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [license, setLicense] = useState({
    licenseNumber: "",
    licenseState: "",
    licenseExpiration: "",
    licenseType: "cosmetology",
  });
  const [w9, setW9] = useState({
    w9LegalName: "",
    w9BusinessName: "",
    w9TaxClassification: "individual",
    w9Ssn: "",
    w9Ein: "",
    w9Address: "",
  });
  const [dd, setDd] = useState({
    ddBankName: "",
    ddRoutingNumber: "",
    ddAccountNumber: "",
    ddAccountType: "checking",
    ddNameOnAccount: "",
  });
  const [emergency, setEmergency] = useState({
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
  });
  const [agreement, setAgreement] = useState({
    agreementTopDate: new Date().toISOString().split("T")[0],
    agreementContractorName: "",
    ackPolicies: false,
    ackConfidentiality: false,
    ackAtWill: false,
    ackSafetyProtocol: false,
    ackTechPolicy: false,
    agreementSignedName: "",
    signedSsnLast4: "",
    signedDate: new Date().toISOString().split("T")[0],
  });

  // TDLR verification
  const [tdlrResult, setTdlrResult] = useState<{
    found: boolean;
    holderName?: string;
    licenseType?: string;
    status?: string;
    isActive?: boolean;
    expirationDate?: string;
    statusColor?: "green" | "red" | "yellow";
  } | null>(null);
  const [tdlrChecking, setTdlrChecking] = useState(false);

  const verifyTdlr = async (licenseNum: string) => {
    if (!licenseNum) return;
    setTdlrChecking(true);
    setTdlrResult(null);
    try {
      const res = await fetch(`/api/tdlr/verify?license=${encodeURIComponent(licenseNum)}`);
      const data = await res.json();
      setTdlrResult(data);
      // Auto-fill expiration if found
      if (data.found && data.expirationDate && !license.licenseExpiration) {
        setLicense((prev) => ({
          ...prev,
          licenseExpiration: new Date(data.expirationDate).toISOString().split("T")[0],
        }));
      }
    } catch {
      setTdlrResult({ found: false });
    } finally {
      setTdlrChecking(false);
    }
  };

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  // Fetch enrollment
  useEffect(() => {
    if (!token) return;
    fetch(`/api/onboarding/enroll/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        const e = data.enrollment;
        setEnrollment(e);

        if (e.status === "completed") {
          setStep(7);
          setVerificationCode(e.verificationCode || "");
        }

        // Pre-fill form state from existing data
        if (e.phone) setPersonal((p) => ({ ...p, phone: e.phone || "", dateOfBirth: e.dateOfBirth || "", address: e.address || "", city: e.city || "", state: e.state || "", zip: e.zip || "" }));
        if (e.licenseNumber) setLicense({ licenseNumber: e.licenseNumber || "", licenseState: e.licenseState || "", licenseExpiration: e.licenseExpiration || "", licenseType: e.licenseType || "cosmetology" });
        if (e.w9LegalName) setW9((p) => ({ ...p, w9LegalName: e.w9LegalName || "", w9BusinessName: e.w9BusinessName || "", w9TaxClassification: e.w9TaxClassification || "individual", w9Address: e.w9Address || "" }));
        if (e.ddBankName) setDd((p) => ({ ...p, ddBankName: e.ddBankName || "", ddAccountType: e.ddAccountType || "checking", ddNameOnAccount: e.ddNameOnAccount || "" }));
        if (e.emergencyName) setEmergency({ emergencyName: e.emergencyName || "", emergencyRelationship: e.emergencyRelationship || "", emergencyPhone: e.emergencyPhone || "" });

        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load enrollment");
        setLoading(false);
      });
  }, [token]);

  const saveStep = useCallback(
    async (stepName: string, data: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/onboarding/enroll/${token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: stepName, data }),
        });
        const result = await res.json();
        if (!res.ok) {
          setError(result.error || "Failed to save");
          setSaving(false);
          return false;
        }
        if (result.verificationCode) {
          setVerificationCode(result.verificationCode);
        }
        setSaving(false);
        return true;
      } catch {
        setError("Network error");
        setSaving(false);
        return false;
      }
    },
    [token]
  );

  // Canvas drawing
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#CDC9C0";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const endDraw = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // Handler for next step
  const handleNext = async () => {
    setError("");
    switch (step) {
      case 0: // Welcome -> Personal
        setStep(1);
        break;
      case 1: { // Personal Info
        const ok = await saveStep("personal", personal);
        if (ok) setStep(2);
        break;
      }
      case 2: { // License
        const ok = await saveStep("license", license);
        if (ok) setStep(3);
        break;
      }
      case 3: { // W-9
        const ok = await saveStep("w9", w9);
        if (ok) setStep(4);
        break;
      }
      case 4: { // Direct Deposit
        const ok = await saveStep("direct_deposit", dd);
        if (ok) setStep(5);
        break;
      }
      case 5: { // Emergency
        const ok = await saveStep("emergency", emergency);
        if (ok) setStep(6);
        break;
      }
      case 6: { // Agreement
        const sigData = canvasRef.current?.toDataURL("image/png") || "";
        const ok = await saveStep("agreement", {
          ...agreement,
          signedLegalName: resolvedSignedName,
          signatureData: sigData,
        });
        if (ok) {
          // Complete
          const ok2 = await saveStep("complete", {});
          if (ok2) setStep(7);
        }
        break;
      }
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0f1d24", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#CDC9C0", fontSize: "14px", fontWeight: 600 }}>Loading...</div>
      </div>
    );
  }

  if (error && !enrollment) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0f1d24", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#128274;</div>
          <h2 style={{ color: "#FFFFFF", fontSize: "22px", fontWeight: 800, margin: "0 0 8px" }}>Link Unavailable</h2>
          <p style={{ color: "#94A3B8", fontSize: "14px" }}>{error}</p>
        </div>
      </div>
    );
  }

  const allAcked = agreement.ackPolicies && agreement.ackConfidentiality && agreement.ackAtWill && agreement.ackSafetyProtocol && agreement.ackTechPolicy;
  const resolvedSignedName = agreement.agreementSignedName || agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "");
  const agreementValid = allAcked && hasSigned && resolvedSignedName && agreement.signedSsnLast4.length === 4 && agreement.signedDate;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1d24" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />

      {/* Security Banner */}
      <div style={{ backgroundColor: "#0a1520", borderBottom: "1px solid rgba(205,201,192,0.08)", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#22c55e" }}>lock</span>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>256-bit SSL encrypted</span>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px 48px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "24px", paddingTop: "8px" }}>
          <img src="/images/logo-white.png" alt="Salon Envy" style={{ height: "50px", width: "auto" }} />
        </div>

        {/* Progress Bar */}
        {step < 7 && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#CDC9C0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Step {step + 1} of 8
              </span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(205,201,192,0.4)", letterSpacing: "0.05em" }}>
                {STEPS[step]}
              </span>
            </div>
            <div style={{ height: "3px", backgroundColor: "rgba(205,201,192,0.1)", borderRadius: "4px" }}>
              <div style={{ height: "100%", width: `${((step + 1) / 8) * 100}%`, backgroundColor: "#CDC9C0", borderRadius: "4px", transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", color: "#f87171", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: "#142127", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "12px", padding: "28px 24px" }}>
          {/* Step 0: Welcome */}
          {step === 0 && enrollment && (
            <div>
              <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>
                Welcome, {enrollment.firstName}!
              </h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>
                You have been invited to join <strong style={{ color: "#CDC9C0" }}>Salon Envy - {enrollment.locationName}</strong> as a <strong style={{ color: "#CDC9C0" }}>{enrollment.role === "MANAGER" ? "Manager" : "Stylist"}</strong>.
              </p>
              <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>
                This enrollment process will collect your personal information, licensing details, tax information, and direct deposit setup. All data is transmitted securely.
              </p>
              <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", padding: "16px", marginBottom: "24px", border: "1px solid rgba(205,201,192,0.08)" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>What you will need</div>
                {["Government-issued photo ID", "Cosmetology license number", "Social Security Number (for W-9)", "Bank account details (for direct deposit)", "Emergency contact information"].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#CDC9C0" }}>check_circle</span>
                    <span style={{ fontSize: "13px", color: "#94A3B8" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleNext} style={btnPrimary}>
                Begin Enrollment
              </button>
            </div>
          )}

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>Personal Information</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Please provide your contact and address details.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input type="tel" value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} placeholder="(xxx) xxx-xxxx" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" value={personal.dateOfBirth} onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Street Address</label>
                  <input value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} placeholder="123 Main St" style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input value={personal.city} onChange={(e) => setPersonal({ ...personal, city: e.target.value })} placeholder="City" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input value={personal.state} onChange={(e) => setPersonal({ ...personal, state: e.target.value })} placeholder="TX" maxLength={2} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input value={personal.zip} onChange={(e) => setPersonal({ ...personal, zip: e.target.value })} placeholder="78401" style={inputStyle} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="button" onClick={() => setStep(0)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={saving || !personal.phone} style={{ ...btnPrimary, flex: 2, opacity: saving || !personal.phone ? 0.5 : 1 }}>
                  {saving ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: License */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>License Information</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Your professional cosmetology license details.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>License Type</label>
                  <select value={license.licenseType} onChange={(e) => setLicense({ ...license, licenseType: e.target.value })} style={selectStyle}>
                    <option value="cosmetology">Cosmetology</option>
                    <option value="barber">Barber</option>
                    <option value="esthetician">Esthetician</option>
                    <option value="nail_tech">Nail Technician</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>License Number</label>
                  <input
                    value={license.licenseNumber}
                    onChange={(e) => setLicense({ ...license, licenseNumber: e.target.value })}
                    onBlur={() => {
                      if (license.licenseNumber && license.licenseState?.toUpperCase() === "TX") {
                        verifyTdlr(license.licenseNumber);
                      }
                    }}
                    placeholder="License number"
                    style={inputStyle}
                  />
                  {license.licenseState?.toUpperCase() === "TX" && (
                    <p style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4px" }}>Texas licenses are auto-verified via TDLR when you tab out.</p>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>State Issued</label>
                    <input value={license.licenseState} onChange={(e) => setLicense({ ...license, licenseState: e.target.value })} placeholder="TX" maxLength={2} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Expiration Date</label>
                    <input type="date" value={license.licenseExpiration} onChange={(e) => setLicense({ ...license, licenseExpiration: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                {/* TDLR Verification Result */}
                {tdlrChecking && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#1a2a32", borderRadius: "8px", padding: "12px 16px", border: "1px solid rgba(205,201,192,0.08)" }}>
                    <svg style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#CDC9C0" strokeWidth="2" opacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#CDC9C0" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    <span style={{ fontSize: "12px", color: "#CDC9C0" }}>Verifying with TDLR...</span>
                  </div>
                )}
                {tdlrResult && !tdlrChecking && (
                  <div style={{
                    backgroundColor: tdlrResult.statusColor === "green" ? "rgba(16,185,129,0.08)" : tdlrResult.statusColor === "red" ? "rgba(239,68,68,0.08)" : "rgba(234,179,8,0.08)",
                    border: `1px solid ${tdlrResult.statusColor === "green" ? "rgba(16,185,129,0.25)" : tdlrResult.statusColor === "red" ? "rgba(239,68,68,0.25)" : "rgba(234,179,8,0.25)"}`,
                    borderRadius: "8px",
                    padding: "12px 16px",
                  }}>
                    {tdlrResult.found ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "10px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            backgroundColor: tdlrResult.statusColor === "green" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                            color: tdlrResult.statusColor === "green" ? "#10B981" : "#EF4444",
                          }}>
                            {tdlrResult.statusColor === "green" ? "TDLR Verified" : "TDLR " + tdlrResult.status}
                          </span>
                        </div>
                        {tdlrResult.holderName && (
                          <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 2px" }}>Holder: <strong style={{ color: "#CDC9C0" }}>{tdlrResult.holderName}</strong></p>
                        )}
                        {tdlrResult.licenseType && (
                          <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 2px" }}>Type: {tdlrResult.licenseType}</p>
                        )}
                        {tdlrResult.expirationDate && (
                          <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>Expires: {new Date(tdlrResult.expirationDate).toLocaleDateString()}</p>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: "12px", color: "#EAB308", margin: 0 }}>License not found in TDLR database. Please double-check your license number.</p>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="button" onClick={() => setStep(1)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={saving || !license.licenseNumber} style={{ ...btnPrimary, flex: 2, opacity: saving || !license.licenseNumber ? 0.5 : 1 }}>
                  {saving ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: W-9 */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>W-9 Tax Information</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Required for tax reporting purposes. This information is encrypted and secure.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Legal Name (as shown on tax return)</label>
                  <input value={w9.w9LegalName} onChange={(e) => setW9({ ...w9, w9LegalName: e.target.value })} placeholder="Full legal name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Business Name (if different)</label>
                  <input value={w9.w9BusinessName} onChange={(e) => setW9({ ...w9, w9BusinessName: e.target.value })} placeholder="Optional" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tax Classification</label>
                  <select value={w9.w9TaxClassification} onChange={(e) => setW9({ ...w9, w9TaxClassification: e.target.value })} style={selectStyle}>
                    <option value="individual">Individual / Sole Proprietor</option>
                    <option value="llc_single">LLC - Single Member</option>
                    <option value="llc_partnership">LLC - Partnership</option>
                    <option value="llc_corp">LLC - C Corporation</option>
                    <option value="llc_scorp">LLC - S Corporation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Social Security Number (SSN)</label>
                  <input type="password" value={w9.w9Ssn} onChange={(e) => setW9({ ...w9, w9Ssn: e.target.value })} placeholder="XXX-XX-XXXX" maxLength={11} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>EIN (if applicable)</label>
                  <input value={w9.w9Ein} onChange={(e) => setW9({ ...w9, w9Ein: e.target.value })} placeholder="Optional" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Address</label>
                  <input value={w9.w9Address} onChange={(e) => setW9({ ...w9, w9Address: e.target.value })} placeholder="Tax filing address" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="button" onClick={() => setStep(2)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={saving || !w9.w9LegalName || !w9.w9Ssn} style={{ ...btnPrimary, flex: 2, opacity: saving || !w9.w9LegalName || !w9.w9Ssn ? 0.5 : 1 }}>
                  {saving ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Direct Deposit */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>Direct Deposit</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Set up your bank account for payroll deposits.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Bank Name</label>
                  <input value={dd.ddBankName} onChange={(e) => setDd({ ...dd, ddBankName: e.target.value })} placeholder="Bank of America, Chase, etc." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Name on Account</label>
                  <input value={dd.ddNameOnAccount} onChange={(e) => setDd({ ...dd, ddNameOnAccount: e.target.value })} placeholder="Name as it appears on account" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Account Type</label>
                  <select value={dd.ddAccountType} onChange={(e) => setDd({ ...dd, ddAccountType: e.target.value })} style={selectStyle}>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Routing Number</label>
                  <input type="password" value={dd.ddRoutingNumber} onChange={(e) => setDd({ ...dd, ddRoutingNumber: e.target.value })} placeholder="9-digit routing number" maxLength={9} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Account Number</label>
                  <input type="password" value={dd.ddAccountNumber} onChange={(e) => setDd({ ...dd, ddAccountNumber: e.target.value })} placeholder="Account number" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="button" onClick={() => setStep(3)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={saving || !dd.ddBankName || !dd.ddRoutingNumber || !dd.ddAccountNumber} style={{ ...btnPrimary, flex: 2, opacity: saving || !dd.ddBankName || !dd.ddRoutingNumber || !dd.ddAccountNumber ? 0.5 : 1 }}>
                  {saving ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Emergency Contact */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>Emergency Contact</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 24px" }}>Please provide an emergency contact person.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input value={emergency.emergencyName} onChange={(e) => setEmergency({ ...emergency, emergencyName: e.target.value })} placeholder="Emergency contact name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Relationship</label>
                  <select value={emergency.emergencyRelationship} onChange={(e) => setEmergency({ ...emergency, emergencyRelationship: e.target.value })} style={selectStyle}>
                    <option value="">Select...</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent</option>
                    <option value="sibling">Sibling</option>
                    <option value="child">Child</option>
                    <option value="partner">Partner</option>
                    <option value="friend">Friend</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input type="tel" value={emergency.emergencyPhone} onChange={(e) => setEmergency({ ...emergency, emergencyPhone: e.target.value })} placeholder="(xxx) xxx-xxxx" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="button" onClick={() => setStep(4)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={saving || !emergency.emergencyName || !emergency.emergencyPhone} style={{ ...btnPrimary, flex: 2, opacity: saving || !emergency.emergencyName || !emergency.emergencyPhone ? 0.5 : 1 }}>
                  {saving ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Agreement */}
          {step === 6 && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 8px" }}>Employment Agreement</h2>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 20px" }}>Please fill in your details and review the agreement below.</p>

              {/* Agreement date and contractor name ABOVE the scrollable text */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={labelStyle}>Agreement Date</label>
                  <input
                    type="date"
                    value={agreement.agreementTopDate}
                    onChange={(e) => setAgreement({ ...agreement, agreementTopDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Full Legal Name</label>
                  <input
                    value={agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "")}
                    onChange={(e) => setAgreement({ ...agreement, agreementContractorName: e.target.value })}
                    placeholder="Full legal name"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Scrollable contract text */}
              <div style={{ maxHeight: "200px", overflowY: "auto", backgroundColor: "#1a2a32", border: "1px solid rgba(205,201,192,0.1)", borderRadius: "8px", padding: "16px", marginBottom: "20px", fontSize: "12px", color: "#94A3B8", lineHeight: 1.7 }}>
                <p style={{ margin: "0 0 12px", fontWeight: 700, color: "#CDC9C0" }}>SALON ENVY INDEPENDENT CONTRACTOR / EMPLOYMENT AGREEMENT</p>
                <p style={{ margin: "0 0 8px" }}>This Agreement is entered into on <strong style={{ color: "#CDC9C0" }}>{agreement.agreementTopDate ? new Date(agreement.agreementTopDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "___________"}</strong> between Salon Envy USA LLC (&ldquo;Company&rdquo;) and <strong style={{ color: "#CDC9C0" }}>{agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "") || "___________"}</strong> (&ldquo;Contractor/Employee&rdquo;).</p>
                <p style={{ margin: "0 0 8px" }}><strong style={{ color: "#CDC9C0" }}>1. Employment At-Will.</strong> Employment with Salon Envy is at-will, meaning either party may terminate the relationship at any time, with or without cause or notice, subject to applicable law.</p>
                <p style={{ margin: "0 0 8px" }}><strong style={{ color: "#CDC9C0" }}>2. Confidentiality.</strong> You agree to maintain the confidentiality of all proprietary information, client lists, pricing, formulas, and business practices of Salon Envy. This obligation survives termination.</p>
                <p style={{ margin: "0 0 8px" }}><strong style={{ color: "#CDC9C0" }}>3. Workplace Policies.</strong> You agree to comply with all Salon Envy workplace policies, including but not limited to: dress code, attendance, client interaction standards, health and safety protocols, and anti-harassment policies.</p>
                <p style={{ margin: "0 0 8px" }}><strong style={{ color: "#CDC9C0" }}>4. Safety &amp; Health.</strong> You acknowledge responsibility for maintaining a safe working environment, proper sanitization of tools and workstations, and compliance with OSHA and state cosmetology board regulations.</p>
                <p style={{ margin: "0 0 8px" }}><strong style={{ color: "#CDC9C0" }}>5. Technology &amp; Social Media.</strong> Company devices, systems, and accounts are for business use. You agree to Salon Envy&apos;s social media policy and will not post proprietary information or disparaging content about the company.</p>
                <p style={{ margin: "0 0 8px" }}><strong style={{ color: "#CDC9C0" }}>6. Compensation.</strong> Your compensation structure will be detailed in a separate compensation agreement. Direct deposit authorization provided herein authorizes Salon Envy to deposit compensation into the designated bank account.</p>
                <p style={{ margin: "0 0 8px" }}><strong style={{ color: "#CDC9C0" }}>7. Licensing.</strong> You warrant that you hold a valid cosmetology license in the state of operation and agree to maintain its active status throughout employment.</p>
                <p style={{ margin: "0" }}><strong style={{ color: "#CDC9C0" }}>8. Governing Law.</strong> This Agreement shall be governed by the laws of the State of Texas.</p>
              </div>

              {/* 5 Acknowledgment checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                {[
                  { key: "ackPolicies" as const, text: "I have read and agree to all Salon Envy workplace policies" },
                  { key: "ackConfidentiality" as const, text: "I agree to maintain confidentiality of all proprietary information" },
                  { key: "ackAtWill" as const, text: "I understand this is at-will employment" },
                  { key: "ackSafetyProtocol" as const, text: "I agree to comply with all safety and health protocols" },
                  { key: "ackTechPolicy" as const, text: "I agree to the technology and social media policies" },
                ].map((item) => (
                  <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={agreement[item.key]}
                      onChange={(e) => setAgreement({ ...agreement, [item.key]: e.target.checked })}
                      style={{ marginTop: "2px", accentColor: "#CDC9C0", width: "16px", height: "16px", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.4 }}>{item.text}</span>
                  </label>
                ))}
              </div>

              {/* Signature Canvas */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Signature</label>
                <div style={{ position: "relative", backgroundColor: "#1a2a32", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.15)" }}>
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={150}
                    style={{ width: "100%", height: "120px", borderRadius: "8px", touchAction: "none", cursor: "crosshair" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  {!hasSigned && (
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "rgba(205,201,192,0.25)", fontSize: "13px", pointerEvents: "none" }}>
                      Sign here
                    </div>
                  )}
                  <button type="button" onClick={clearSignature} style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.4)", border: "none", color: "#94A3B8", fontSize: "10px", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Clear</button>
                </div>
              </div>

              {/* Legal name, SSN last 4, Date */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={labelStyle}>Full Legal Name</label>
                  <input
                    value={agreement.agreementSignedName || agreement.agreementContractorName || (enrollment ? `${enrollment.firstName} ${enrollment.lastName}`.trim() : "")}
                    onChange={(e) => setAgreement({ ...agreement, agreementSignedName: e.target.value })}
                    placeholder="Full legal name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SSN Last 4</label>
                  <input type="password" value={agreement.signedSsnLast4} onChange={(e) => setAgreement({ ...agreement, signedSsnLast4: e.target.value })} placeholder="XXXX" maxLength={4} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={agreement.signedDate} onChange={(e) => setAgreement({ ...agreement, signedDate: e.target.value })} style={inputStyle} />
                </div>
              </div>

              {/* Salon Envy Pre-Executed Signor */}
              <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", border: "1px solid rgba(205,201,192,0.1)", padding: "16px", marginBottom: "20px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Salon Envy USA LLC (Pre-Executed)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)", marginBottom: "2px" }}>Authorized Signor</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#CDC9C0", fontStyle: "italic" }}>Robert R. Reyna</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "rgba(205,201,192,0.4)", marginBottom: "2px" }}>Date</div>
                    <div style={{ fontSize: "14px", color: "#CDC9C0" }}>
                      {agreement.agreementTopDate ? new Date(agreement.agreementTopDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={() => setStep(5)} style={{ ...btnSecondary, flex: 1 }}>Back</button>
                <button type="button" onClick={handleNext} disabled={saving || !agreementValid} style={{ ...btnPrimary, flex: 2, opacity: saving || !agreementValid ? 0.5 : 1 }}>
                  {saving ? "Submitting..." : "Sign & Complete"}
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Complete */}
          {step === 7 && enrollment && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "rgba(34,197,94,0.1)", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#22c55e" }}>check_circle</span>
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 12px" }}>Enrollment Complete!</h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>
                Thank you, {enrollment.firstName}. Your enrollment has been submitted successfully.
              </p>

              {verificationCode && (
                <div style={{ backgroundColor: "#1a2a32", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid rgba(205,201,192,0.15)" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8px" }}>Your Verification Code</div>
                  <div style={{ fontSize: "36px", fontWeight: 900, color: "#CDC9C0", letterSpacing: "0.15em", fontFamily: "monospace" }}>{verificationCode}</div>
                  <p style={{ fontSize: "12px", color: "#94A3B8", margin: "12px 0 0" }}>
                    Save this code. You may be asked for it on your first day.
                  </p>
                </div>
              )}

              <div style={{ backgroundColor: "#1a2a32", borderRadius: "8px", padding: "16px", textAlign: "left", border: "1px solid rgba(205,201,192,0.08)" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>What happens next</div>
                {["Your information will be reviewed by management", "You will receive an email with your login credentials", "On your first day, bring your ID and license for verification"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ color: "#CDC9C0", fontSize: "13px", fontWeight: 700, minWidth: "18px" }}>{i + 1}.</span>
                    <span style={{ fontSize: "13px", color: "#94A3B8" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
