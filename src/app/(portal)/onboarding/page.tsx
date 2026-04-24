"use client";

import { useEffect, useState, useCallback } from "react";
import { useUserRole } from "@/hooks/useUserRole";

type Enrollment = {
  id: string;
  inviteToken: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  verificationCode: string | null;
  completedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  location: { id: string; name: string };
};

type Location = { id: string; name: string };

const LOCATIONS: Location[] = [
  { id: "LTJSA6QR1HGW6", name: "Corpus Christi" },
  { id: "LXJYXDXWR0XZF", name: "San Antonio" },
];

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "rgba(234, 179, 8, 0.12)", color: "#ca8a04", label: "Pending" },
  in_progress: { bg: "rgba(59, 130, 246, 0.12)", color: "#2563eb", label: "In Progress" },
  completed: { bg: "rgba(34, 197, 94, 0.12)", color: "#16a34a", label: "Completed" },
  expired: { bg: "rgba(148, 163, 184, 0.12)", color: "#64748b", label: "Expired" },
  cancelled: { bg: "rgba(239, 68, 68, 0.12)", color: "#dc2626", label: "Cancelled" },
};

export default function OnboardingManagementPage() {
  const { isOwner, isManager } = useUserRole();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [locations, setLocations] = useState<Location[]>(LOCATIONS);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [newEnroll, setNewEnroll] = useState({ firstName: "", lastName: "", email: "", locationId: "", enrollRole: "STYLIST" });
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [toast, setToast] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Enrollment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [resendOpen, setResendOpen] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();
      if (data.enrollments) {
        setEnrollments(data.enrollments);
        // Merge any additional locations from enrollments with hardcoded list
        const locs = data.enrollments.reduce((acc: Location[], e: Enrollment) => {
          if (e.location && !acc.find((l: Location) => l.id === e.location.id)) {
            acc.push(e.location);
          }
          return acc;
        }, [...LOCATIONS] as Location[]);
        setLocations(locs);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      if (data.locations && data.locations.length > 0) {
        // Merge API locations with hardcoded, keeping hardcoded as baseline
        const merged = [...LOCATIONS];
        for (const loc of data.locations as Location[]) {
          if (!merged.find((l) => l.id === loc.id)) merged.push(loc);
        }
        setLocations(merged);
      }
    } catch {
      // Keep hardcoded LOCATIONS as fallback
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleSend = async () => {
    if (!newEnroll.firstName || !newEnroll.lastName || !newEnroll.email || !newEnroll.locationId) {
      setMessage("All fields are required");
      return;
    }
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEnroll),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        setNewEnroll({ firstName: "", lastName: "", email: "", locationId: "", enrollRole: "STYLIST" });
        await fetchEnrollments();
      } else {
        setMessage(data.error || "Failed to create enrollment");
      }
    } catch {
      setMessage("Network error");
    }
    setSending(false);
  };

  const copyLink = (token: string) => {
    const base = window.location.origin;
    navigator.clipboard.writeText(`${base}/onboarding/enroll/${token}`);
    setCopiedId(token);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/onboarding/${cancelTarget.id}/cancel`, { method: "POST" });
      if (res.ok) {
        setEnrollments((prev) => prev.filter((e) => e.id !== cancelTarget.id));
        setToast("Enrollment cancelled");
        setCancelTarget(null);
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to cancel");
      }
    } catch { setMessage("Network error"); }
    setCancelling(false);
  };

  const handleResend = async (enrollmentId: string, method: "email" | "sms") => {
    setResending(true);
    try {
      const res = await fetch(`/api/onboarding/${enrollmentId}/resend?method=${method}`, { method: "POST" });
      if (res.ok) {
        setToast(`Invitation resent via ${method === "sms" ? "SMS" : "email"}`);
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to resend");
      }
    } catch { setMessage("Network error"); }
    setResending(false);
    setResendOpen(null);
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!isOwner && !isManager) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: "#94A3B8", fontSize: "14px" }}>You do not have access to this page.</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    backgroundColor: "#FBFBFB",
    border: "1px solid rgba(26,19,19,0.07)",
    borderRadius: 8,
    color: "#1A1313",
    fontSize: "14px",
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

  return (
    <div style={{ padding: "24px 20px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A1313", margin: "0 0 4px" }}>Onboarding</h1>
          <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>Manage stylist enrollment invitations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#CDC9C0",
            color: "#0f1d24",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>person_add</span>
          New Enrollment
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {["pending", "in_progress", "completed", "expired"].map((s) => {
          const info = statusColors[s];
          const count = enrollments.filter((e) => e.status === s).length;
          return (
            <div key={s} style={{ backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "28px", fontWeight: 900, color: info.color }}>{count}</div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(26,19,19,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "4px" }}>{info.label}</div>
            </div>
          );
        })}
      </div>

      {/* Enrollments list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "20px 0" }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 80, background: "#F4F5F7", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "60px 20px", backgroundColor: "#FBFBFB", borderRadius: 12, border: "1px solid rgba(26,19,19,0.07)", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(26,19,19,0.2)", marginBottom: "12px", display: "block" }}>person_add</span>
          <p style={{ color: "rgba(26,19,19,0.55)", fontSize: "14px", fontWeight: 600, margin: "0 0 4px" }}>No enrollments yet</p>
          <p style={{ color: "rgba(26,19,19,0.4)", fontSize: "12px", margin: 0 }}>Send your first enrollment invitation to get started</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {enrollments.map((e) => {
            const st = statusColors[e.status] || statusColors.pending;
            return (
              <div key={e.id} style={{ backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)", transition: "background-color 0.15s" }} onMouseOver={(ev) => (ev.currentTarget.style.backgroundColor = "rgba(26,19,19,0.02)")} onMouseOut={(ev) => (ev.currentTarget.style.backgroundColor = "#FBFBFB")}>
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#1A1313" }}>{e.firstName} {e.lastName}</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{e.email}</div>
                </div>
                <div style={{ minWidth: "100px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(26,19,19,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Location</div>
                  <div style={{ fontSize: "13px", color: "#CDC9C0", marginTop: "2px" }}>{e.location?.name || "N/A"}</div>
                </div>
                <div style={{ minWidth: "80px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(26,19,19,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Role</div>
                  <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "2px" }}>{e.role}</div>
                </div>
                <div>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>
                {e.status === "completed" && e.verificationCode && (
                  <div style={{ minWidth: "80px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(26,19,19,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Code</div>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: "#CDC9C0", fontFamily: "monospace", marginTop: "2px" }}>{e.verificationCode}</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => copyLink(e.inviteToken)}
                    style={{
                      padding: "4px 10px",
                      backgroundColor: copiedId === e.inviteToken ? "rgba(34,197,94,0.15)" : "rgba(205,201,192,0.06)",
                      border: "1px solid rgba(26,19,19,0.06)",
                      borderRadius: "6px",
                      color: copiedId === e.inviteToken ? "#22c55e" : "#94A3B8",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      {copiedId === e.inviteToken ? "check" : "content_copy"}
                    </span>
                    {copiedId === e.inviteToken ? "Copied" : "Copy Link"}
                  </button>
                  {(e.status === "pending" || e.status === "in_progress") && (
                    <>
                      {/* Resend dropdown */}
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setResendOpen(resendOpen === e.id ? null : e.id)}
                          disabled={resending}
                          style={{ padding: "4px 10px", background: "transparent", border: "1px solid rgba(26,19,19,0.1)", borderRadius: "6px", color: "#7a8f96", fontSize: "10px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", opacity: resending ? 0.5 : 1 }}
                        >
                          Resend
                        </button>
                        {resendOpen === e.id && (
                          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "4px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.1)", borderRadius: "8px", padding: "4px", zIndex: 50, minWidth: "140px" }}>
                            <button onClick={() => handleResend(e.id, "email")} style={{ display: "block", width: "100%", padding: "8px 12px", background: "transparent", border: "none", color: "#94A3B8", fontSize: "12px", cursor: "pointer", textAlign: "left", borderRadius: "4px" }} onMouseOver={(ev) => (ev.currentTarget.style.backgroundColor = "rgba(26,19,19,0.04)")} onMouseOut={(ev) => (ev.currentTarget.style.backgroundColor = "transparent")}>Resend Email</button>
                            <button onClick={() => handleResend(e.id, "sms")} style={{ display: "block", width: "100%", padding: "8px 12px", background: "transparent", border: "none", color: "#94A3B8", fontSize: "12px", cursor: "pointer", textAlign: "left", borderRadius: "4px" }} onMouseOver={(ev) => (ev.currentTarget.style.backgroundColor = "rgba(26,19,19,0.04)")} onMouseOut={(ev) => (ev.currentTarget.style.backgroundColor = "transparent")}>Send SMS Link</button>
                          </div>
                        )}
                      </div>
                      {/* Cancel button */}
                      <button
                        onClick={() => setCancelTarget(e)}
                        style={{ padding: "4px 10px", background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#ef4444", fontSize: "10px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", backgroundColor: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "12px 20px", color: "#22c55e", fontSize: "13px", fontWeight: 600, zIndex: 200 }}>
          {toast}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <>
          <div onClick={() => setCancelTarget(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "90%", maxWidth: "400px", backgroundColor: "#FBFBFB", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: "28px", zIndex: 101, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#ef4444", margin: "0 0 12px" }}>Cancel Enrollment</h2>
            <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, margin: "0 0 20px" }}>
              Cancel <strong style={{ color: "#1A1313" }}>{cancelTarget.firstName} {cancelTarget.lastName}</strong>&apos;s enrollment? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: "12px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.2)", borderRadius: "8px", color: "#CDC9C0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                Keep
              </button>
              <button onClick={handleCancel} disabled={cancelling} style={{ flex: 1, padding: "12px", backgroundColor: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", color: "#ef4444", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", opacity: cancelling ? 0.5 : 1 }}>
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* New Enrollment Modal */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "90%", maxWidth: "440px", backgroundColor: "#FBFBFB", border: "1px solid rgba(26,19,19,0.07)", borderRadius: 16, padding: "28px", zIndex: 101, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1A1313", margin: "0 0 20px" }}>New Enrollment Invitation</h2>
            {message && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", color: "#f87171", fontSize: "12px" }}>
                {message}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input value={newEnroll.firstName} onChange={(e) => setNewEnroll({ ...newEnroll, firstName: e.target.value })} placeholder="First" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input value={newEnroll.lastName} onChange={(e) => setNewEnroll({ ...newEnroll, lastName: e.target.value })} placeholder="Last" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={newEnroll.email} onChange={(e) => setNewEnroll({ ...newEnroll, email: e.target.value })} placeholder="email@example.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <select
                  value={newEnroll.locationId}
                  onChange={(e) => setNewEnroll({ ...newEnroll, locationId: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">Select location...</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select
                  value={newEnroll.enrollRole}
                  onChange={(e) => setNewEnroll({ ...newEnroll, enrollRole: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="STYLIST">Stylist</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", backgroundColor: "transparent", border: "1px solid rgba(205,201,192,0.2)", borderRadius: "8px", color: "#CDC9C0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSend} disabled={sending} style={{ flex: 2, padding: "12px", backgroundColor: "#CDC9C0", color: "#0f1d24", fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: "8px", border: "none", cursor: "pointer", opacity: sending ? 0.5 : 1 }}>
                {sending ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
