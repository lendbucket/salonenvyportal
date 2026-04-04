import { auth } from "@/lib/auth";

import { PortalShell } from "./portal-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <PortalShell userName={session?.user?.name} userEmail={session?.user?.email}>
      {children}
    </PortalShell>
  );
}
