import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  const alerts = await prisma.adminAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <DashboardClient
      userName={session?.user?.name ?? "there"}
      alerts={alerts.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        severity: a.severity,
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
