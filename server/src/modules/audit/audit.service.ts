import { prisma } from '../../lib/prisma.js';

export interface AuditContext {
  actorUserId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface WriteAuditInput extends AuditContext {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAudit(input: WriteAuditInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: (input.metadata ?? undefined) as never,
    },
  });
}
