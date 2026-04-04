import { PortalShell } from "./portal-shell"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PortalShell userName="Robert" userEmail="ceo@36west.org" userRole="OWNER">
      <div style={{ animation: "fadeIn 0.2s ease" }}>
        {children}
      </div>
    </PortalShell>
  )
}
