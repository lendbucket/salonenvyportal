/**
 * HRIS event dispatcher.
 * Queues sync events for active HRIS integrations.
 */

export async function onEnrollmentActivated(enrollmentId: string, staffMemberId: string): Promise<void> {
  await queueEvent("employee.created", enrollmentId, staffMemberId)
}

export async function onProfileUpdated(staffMemberId: string, changes: Record<string, unknown>): Promise<void> {
  await queueEvent("employee.updated", null, staffMemberId, changes)
}

export async function onEmployeeTerminated(staffMemberId: string): Promise<void> {
  await queueEvent("employee.terminated", null, staffMemberId)
}

async function queueEvent(
  eventType: string,
  enrollmentId: string | null,
  staffMemberId: string | null,
  extraPayload?: Record<string, unknown>,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma")

  const integrations = await prisma.hrisIntegration.findMany({
    where: { status: "active" },
  })

  for (const integration of integrations) {
    await prisma.hrisSyncEvent.create({
      data: {
        integrationId: integration.id,
        enrollmentId,
        staffMemberId,
        eventType,
        payload: { eventType, enrollmentId, staffMemberId, ...(extraPayload || {}), timestamp: new Date().toISOString() },
      },
    })
  }
}
