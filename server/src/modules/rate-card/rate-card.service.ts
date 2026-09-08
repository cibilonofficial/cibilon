import { randomUUID } from 'node:crypto';
import { notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import type { AuditContext } from '../audit/audit.service.js';
import type { CreateRateCardEntryInput, UpdateRateCardEntryInput } from './rate-card.schemas.js';

const serialize = <T extends { percentageRate: { toString(): string } | null }>(entry: T) => ({
  ...entry, percentageRate: entry.percentageRate?.toString() ?? null,
});

export async function listRateCardEntries() {
  return (await prisma.payoutRateCardEntry.findMany({
    orderBy: [{ categoryName: 'asc' }, { sortOrder: 'asc' }, { providerName: 'asc' }],
  })).map(serialize);
}

export async function createRateCardEntry(input: CreateRateCardEntryInput, user: RequestUser, context: AuditContext) {
  const entry = await prisma.$transaction(async (tx) => {
    const sortOrder = await tx.payoutRateCardEntry.count({ where: { categoryId: input.categoryId } });
    const created = await tx.payoutRateCardEntry.create({ data: { ...input, sourceKey: `manual-${randomUUID()}`, sortOrder } });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'PAYOUT_RATE_CARD_ENTRY_CREATED', entityType: 'payout_rate_card_entry', entityId: created.id, requestId: context.requestId, ipAddress: context.ipAddress, userAgent: context.userAgent, metadata: { categoryId: input.categoryId, providerName: input.providerName } } });
    return created;
  });
  return serialize(entry);
}

export async function updateRateCardEntry(id: string, input: UpdateRateCardEntryInput, user: RequestUser, context: AuditContext) {
  const current = await prisma.payoutRateCardEntry.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound('Payout rate-card entry not found');
  const entry = await prisma.$transaction(async (tx) => {
    const updated = await tx.payoutRateCardEntry.update({ where: { id }, data: input });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'PAYOUT_RATE_CARD_ENTRY_UPDATED', entityType: 'payout_rate_card_entry', entityId: id, requestId: context.requestId, ipAddress: context.ipAddress, userAgent: context.userAgent, metadata: { fields: Object.keys(input) } } });
    return updated;
  });
  return serialize(entry);
}
