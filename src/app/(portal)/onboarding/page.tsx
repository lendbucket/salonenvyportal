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
  pending: { bg: "rgba(234,179,8,0.12)", color: "#eab308", label: "Pending" },
  in_progress: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", label: "In Progress" },
  completed: { bg: "rgba(34,197,94,0.12)", color: "#22c55e", label: "Completed" },
  expired: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "Expired" },
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
    backgroundColor: "#1a2a32",
    border: "1px solid rgba(205,201,192,0.15)",
    borderRadius: "7px",
    color: "#FFFFFF",
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
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px" }}>Onboarding</h1>
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
            <div key={s} style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "28px", fontWeight: 900, color: info.color }}>{count}</div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "4px" }}>{info.label}</div>
            </div>
          );
        })}
      </div>

      {/* Enrollments list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "20px 0" }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 80, background: "#1a2a32", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#0d1117", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)", marginBottom: "12px", display: "block" }}>person_add</span>
          <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 4px" }}>No enrollments yet</p>
          <p style={{ color: "rgba(205,201,192,0.4)", fontSize: "12px", margin: 0 }}>Send your first enrollment invitation to get started</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {enrollments.map((e) => {
            const st = statusColors[e.status] || statusColors.pending;
            return (
              <div key={e.id} style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF" }}>{e.firstName} {e.lastName}</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{e.email}</div>
                </div>
                <div style={{ minWidth: "100px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Location</div>
                  <div style={{ fontSize: "13px", color: "#CDC9C0", marginTop: "2px" }}>{e.location?.name || "N/A"}</div>
                </div>
                <div style={{ minWidth: "80px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Role</div>
                  <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "2px" }}>{e.role}</div>
                </div>
                <div>
                  <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", backgroundColor: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>
                {e.status === "completed" && e.verificationCode && (
                  <div style={{ minWidth: "80px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(205,201,192,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Code</div>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: "#CDC9C0", fontFamily: "monospace", marginTop: "2px" }}>{e.verificationCode}</div>
                  </div>
                )}
                <button
                  onClick={() => copyLink(e.inviteToken)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: copiedId === e.inviteToken ? "rgba(34,197,94,0.15)" : "rgba(205,201,192,0.06)",
                    border: "1px solid rgba(255,255,255,0.06)",
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
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "90%", maxWidth: "440px", backgroundColor: "#0d1117", border: "1px solid rgba(205,201,192,0.15)", borderRadius: "14px", padding: "28px", zIndex: 101 }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 20px" }}>New Enrollment Invitation</h2>
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
