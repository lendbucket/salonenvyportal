"use client"
export default function DashboardPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ color: "#f5f5f5", fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Dashboard
      </h1>
      <p style={{ color: "#888" }}>Welcome back, Robert</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "2rem" }}>
        {["Revenue This Week", "Services", "New Clients", "Pending Approvals"].map((label) => (
          <div key={label} style={{ backgroundColor: "#1f1f1f", border: "1px solid #2a2a2a", borderRadius: "0.75rem", padding: "1.5rem" }}>
            <p style={{ color: "#888", fontSize: "0.875rem", margin: "0 0 0.5rem" }}>{label}</p>
            <p style={{ color: "#C9A84C", fontSize: "2rem", fontWeight: "bold", margin: 0 }}>0</p>
          </div>
        ))}
      </div>
    </div>
  )
}
