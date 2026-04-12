"use client";

import { useEffect, useState } from "react";

interface PendingUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  locationId: string | null;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/approvals/pending")
      .then((r) => r.json())
      .then((data: { users?: PendingUser[] }) => {
        setPending(data.users ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const approve = async (userId: string) => {
    await fetch("/api/approvals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "approve" }),
    });
    setPending((prev) => prev.filter((u) => u.id !== userId));
  };

  const reject = async (userId: string) => {
    await fetch("/api/approvals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "reject" }),
    });
    setPending((prev) => prev.filter((u) => u.id !== userId));
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
      />

      <div style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 6px",
            letterSpacing: "-0.02em",
          }}
        >
          Approvals
        </h1>
        <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>Review and approve access requests from your team.</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "20px 0" }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 80, background: "#1a2a32", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "pulse 2s infinite" }} />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div
          style={{
            backgroundColor: "#1a2a32",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
            padding: "60px",
            textAlign: "center",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "48px", color: "rgba(205,201,192,0.2)", display: "block", marginBottom: "16px" }}
          >
            task_alt
          </span>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 8px" }}>All caught up!</p>
          <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>No pending approval requests.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {pending.map((user) => (
            <div
              key={user.id}
              style={{
                backgroundColor: "#1a2a32",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(205,201,192,0.1)",
                  border: "1px solid rgba(205,201,192,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#CDC9C0",
                  fontSize: "16px",
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {user.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) ?? "?"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>{user.name ?? user.email}</div>
                <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "6px" }}>{user.email}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: "20px",
                      backgroundColor: "rgba(205,201,192,0.1)",
                      color: "#CDC9C0",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {user.role}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => void reject(user.id)}
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "transparent",
                    border: "1px solid rgba(239,68,68,0.4)",
                    borderRadius: "7px",
                    color: "#FCA5A5",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => void approve(user.id)}
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "#CDC9C0",
                    border: "none",
                    borderRadius: "7px",
                    color: "#0f1d24",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
