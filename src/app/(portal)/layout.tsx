import PortalShell from "./portal-shell"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PortalShell>
      <div style={{ animation: "fadeIn 0.2s ease" }}>
        {children}
      </div>
    </PortalShell>
  )
}
