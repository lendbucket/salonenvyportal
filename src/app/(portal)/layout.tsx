import { PortalShell } from "./portal-shell"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PortalShell userName="Robert" userEmail="ceo@36west.org" userRole="OWNER">
      {children}
    </PortalShell>
  )
}
