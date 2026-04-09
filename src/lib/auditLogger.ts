import { prisma } from "./prisma"
import type { Prisma } from "@prisma/client"

type AuditLogParams = {
  action: string
  entity: string
  entityId?: string
  userId?: string
  userEmail?: string
  userRole?: string
  locationId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export async function logAction(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        userId: params.userId,
        userEmail: params.userEmail,
        userRole: params.userRole,
        locationId: params.locationId,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: params.ipAddress,
      },
    })
  } catch {
    // Fire-and-forget — never block the calling function
  }
}

export const AUDIT_ACTIONS = {
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  STAFF_INVITED: "STAFF_INVITED",
  STAFF_ENROLLED: "STAFF_ENROLLED",
  STAFF_UPDATED: "STAFF_UPDATED",
  STAFF_DEACTIVATED: "STAFF_DEACTIVATED",
  SCHEDULE_SUBMITTED: "SCHEDULE_SUBMITTED",
  SCHEDULE_APPROVED: "SCHEDULE_APPROVED",
  SCHEDULE_REJECTED: "SCHEDULE_REJECTED",
  PO_CREATED: "PO_CREATED",
  PO_APPROVED: "PO_APPROVED",
  PO_REJECTED: "PO_REJECTED",
  INVENTORY_ADDED: "INVENTORY_ADDED",
  INVENTORY_UPDATED: "INVENTORY_UPDATED",
  PAYROLL_MARKED_PAID: "PAYROLL_MARKED_PAID",
  PAYROLL_EXPORTED: "PAYROLL_EXPORTED",
  ALERT_CREATED: "ALERT_CREATED",
  ALERT_DELETED: "ALERT_DELETED",
  CONDUCT_RECORD_CREATED: "CONDUCT_RECORD_CREATED",
  COMPLAINT_SUBMITTED: "COMPLAINT_SUBMITTED",
  ONBOARDING_COMPLETED: "ONBOARDING_COMPLETED",
  POS_TRANSACTION_COMPLETED: "POS_TRANSACTION_COMPLETED",
  APPROVAL_REVIEWED: "APPROVAL_REVIEWED",
} as const
