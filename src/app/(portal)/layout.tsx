import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PortalShell } from "./portal-shell"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <PortalShell
      userName={session?.user?.name ?? ""}
      userEmail={session?.user?.email ?? ""}
    >
      {children}
    </PortalShell>
  )
}
