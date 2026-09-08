import type { PayoutStatus, Prisma } from '../../../generated/prisma/client.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import type { AuditContext } from '../audit/audit.service.js';
import { scopedAdvisorId } from '../advisors/advisor-access.js';
import type {
  BulkPayPayoutsInput,
  BulkProcessPayoutsInput,
  PayoutHistoryQuery,
  PayoutListQuery,
  UpdatePayoutStatusInput,
} from './payout.schemas.js';

const payoutSummaryInclude = {
  application: {
    select: {
      id: true,
      applicationNumber: true,
      serviceType: true,
      status: true,
      disbursedAt: true,
      customer: { select: { id: true, fullName: true } },
    },
  },
  advisor: { include: { user: { select: { id: true, name: true, email: true } } } },
  lender: { select: { id: true, name: true, type: true } },
  commissionRule: {
    select: { id: true, version: true, effectiveFrom: true, effectiveTo: true },
  },
} satisfies Prisma.PayoutInclude;

const payoutDetailInclude = {
  ...payoutSummaryInclude,
  statusHistory: {
    include: { changedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.PayoutInclude;

type PayoutSummary = Prisma.PayoutGetPayload<{ include: typeof payoutSummaryInclude }>;
type PayoutDetail = Prisma.PayoutGetPayload<{ include: typeof payoutDetailInclude }>;

const payoutTransitions: Record<PayoutStatus, readonly PayoutStatus[]> = {
  PENDING: ['PROCESSING', 'PAID', 'CANCELLED'],
  PROCESSING: ['PAID', 'FAILED', 'CANCELLED'],
  FAILED: ['PROCESSING', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

function auditData(user: RequestUser, context: AuditContext) {
  return {
    actorUserId: user.id,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

function serializePayout<T extends PayoutSummary | PayoutDetail>(payout: T) {
  return {
    ...payout,
    estimated: payout.application.status !== 'DISBURSED',
    disbursedAmount: payout.disbursedAmount.toString(),
    payoutAmount: payout.payoutAmount.toString(),
    percentageRate: payout.percentageRate?.toString() ?? null,
    flatAmount: payout.flatAmount?.toString() ?? null,
  };
}

function decimalToScaled(value: string, scale: number) {
  const [whole, fraction = ''] = value.split('.');
  const factor = 10n ** BigInt(scale);
  return BigInt(whole ?? '0') * factor + BigInt(fraction.padEnd(scale, '0').slice(0, scale) || '0');
}

function scaledToDecimal(value: bigint, scale: number) {
  const factor = 10n ** BigInt(scale);
  const whole = value / factor;
  const fraction = (value % factor).toString().padStart(scale, '0');
  return `${whole}.${fraction}`;
}

export function calculatePayoutAmount(
  calculationType: 'PERCENTAGE' | 'FLAT',
  disbursedAmount: number,
  percentageRate: { toString(): string } | null,
  flatAmount: { toString(): string } | null,
) {
  if (calculationType === 'FLAT') {
    if (!flatAmount) throw conflict('The selected flat commission rule is incomplete');
    return scaledToDecimal(decimalToScaled(flatAmount.toString(), 2), 2);
  }
  if (!percentageRate) throw conflict('The selected percentage commission rule is incomplete');
  const amountPaise = decimalToScaled(disbursedAmount.toFixed(2), 2);
  const rateMicros = decimalToScaled(percentageRate.toString(), 6);
  const denominator = 100_000_000n;
  const payoutPaise = (amountPaise * rateMicros + denominator / 2n) / denominator;
  return scaledToDecimal(payoutPaise, 2);
}

async function resolveCommission(
  tx: Prisma.TransactionClient,
  serviceType: string,
  lenderId: string,
  amount: number,
  occurredAt: Date,
) {
  const product = await tx.product.findUnique({ where: { serviceType } });
  if (!product) throw conflict(`No product configuration exists for ${serviceType}`);
  const mapping = await tx.productLender.findUnique({
    where: { productId_lenderId: { productId: product.id, lenderId } },
    include: { lender: { select: { name: true, status: true } } },
  });
  if (!mapping || !mapping.active) throw conflict('The selected lender is not active for this product');
  if (mapping.lender.status === 'INACTIVE') throw conflict('The selected lender is inactive');
  const effectiveWhere = {
    productId: product.id, active: true,
    effectiveFrom: { lte: occurredAt },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: occurredAt } }],
  } satisfies Prisma.CommissionRuleWhereInput;
  let commissionRule = await tx.commissionRule.findFirst({
    where: { ...effectiveWhere, lenderId }, orderBy: { version: 'desc' },
  });
  commissionRule ??= await tx.commissionRule.findFirst({
    where: { ...effectiveWhere, lenderId: null }, orderBy: { version: 'desc' },
  });
  if (!commissionRule) throw conflict('No effective commission rule is configured for this product and lender');
  return {
    commissionRule,
    payoutAmount: calculatePayoutAmount(
      commissionRule.calculationType, amount, commissionRule.percentageRate, commissionRule.flatAmount,
    ),
  };
}

export async function createPayoutForApproval(
  tx: Prisma.TransactionClient,
  application: {
    id: string; applicationNumber: string; advisorId: string; serviceType: string;
    requestedAmount: { toString(): string } | null; advisor: { userId: string };
  },
  lenderId: string,
  changedByUserId: string,
  occurredAt: Date,
) {
  const amount = Number(application.requestedAmount?.toString() ?? 0);
  const { commissionRule, payoutAmount } = await resolveCommission(
    tx, application.serviceType, lenderId, amount, occurredAt,
  );
  // Some service categories (for example CIBIL repair and registrations) do
  // not have a meaningful requested amount. A flat rule can still be
  // estimated at approval, but a percentage rule needs an actual transaction
  // value and is therefore deferred until disbursal.
  if (amount <= 0 && commissionRule.calculationType === 'PERCENTAGE') return null;
  const payout = await tx.payout.create({
    data: {
      payoutNumber: `PO-${application.applicationNumber}`,
      applicationId: application.id,
      advisorId: application.advisorId,
      lenderId,
      commissionRuleId: commissionRule.id,
      commissionVersion: commissionRule.version,
      calculationType: commissionRule.calculationType,
      percentageRate: commissionRule.percentageRate,
      flatAmount: commissionRule.flatAmount,
      disbursedAmount: amount.toFixed(2),
      payoutAmount,
      statusHistory: {
        create: { fromStatus: null, toStatus: 'PENDING', note: 'Estimated on application approval', changedByUserId },
      },
    },
  });
  await tx.notification.create({
    data: {
      recipientUserId: application.advisor.userId,
      type: 'PAYOUT_ACTION',
      title: `Estimated payout for ${application.applicationNumber}`,
      body: `An estimated payout of ₹${payoutAmount} is awaiting application disbursal.`,
      applicationId: application.id,
      payoutId: payout.id,
    },
  });
  return payout;
}

export async function createPayoutForDisbursement(
  tx: Prisma.TransactionClient,
  application: {
    id: string;
    applicationNumber: string;
    advisorId: string;
    serviceType: string;
    advisor: { userId: string };
  },
  lenderId: string,
  disbursedAmount: number,
  changedByUserId: string,
  occurredAt: Date,
) {
  const { commissionRule, payoutAmount } = await resolveCommission(
    tx, application.serviceType, lenderId, disbursedAmount, occurredAt,
  );
  const existing = await tx.payout.findUnique({ where: { applicationId: application.id } });
  if (existing && existing.status !== 'PENDING') {
    throw conflict('This payout has already entered processing and cannot be recalculated');
  }
  const payout = existing ? await tx.payout.update({
    where: { id: existing.id },
    data: {
      lenderId, commissionRuleId: commissionRule.id, commissionVersion: commissionRule.version,
      calculationType: commissionRule.calculationType, percentageRate: commissionRule.percentageRate,
      flatAmount: commissionRule.flatAmount, disbursedAmount: disbursedAmount.toFixed(2), payoutAmount,
    },
  }) : await tx.payout.create({
    data: {
      payoutNumber: `PO-${application.applicationNumber}`,
      applicationId: application.id,
      advisorId: application.advisorId,
      lenderId,
      commissionRuleId: commissionRule.id,
      commissionVersion: commissionRule.version,
      calculationType: commissionRule.calculationType,
      percentageRate: commissionRule.percentageRate,
      flatAmount: commissionRule.flatAmount,
      disbursedAmount: disbursedAmount.toFixed(2),
      payoutAmount,
      statusHistory: {
        create: { fromStatus: null, toStatus: 'PENDING', note: 'Generated automatically on disbursal', changedByUserId },
      },
    },
  });
  await tx.notification.create({
    data: {
      recipientUserId: application.advisor.userId,
      type: 'PAYOUT_ACTION',
      title: `Payout confirmed for ${application.applicationNumber}`,
      body: `Payout ${payout.payoutNumber} is confirmed at ₹${payoutAmount} and pending processing.`,
      applicationId: application.id,
      payoutId: payout.id,
    },
  });
  return payout;
}

/** Indicative default commission before a lender and disbursal are confirmed. */
export async function estimateApplicationPayouts(applications: {
  id: string; serviceType: string; requestedAmount: { toString(): string } | null;
}[]) {
  const now = new Date();
  const rules = await prisma.commissionRule.findMany({
    where: {
      product: { serviceType: { in: [...new Set(applications.map((app) => app.serviceType))] } },
      lenderId: null, active: true, effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    include: { product: { select: { serviceType: true } } },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
  });
  return new Map(applications.map((app) => {
    const rule = rules.find((item) => item.product.serviceType === app.serviceType);
    return [app.id, rule ? calculatePayoutAmount(rule.calculationType,
      Number(app.requestedAmount?.toString() ?? 0), rule.percentageRate, rule.flatAmount) : null];
  }));
}

export async function listPayouts(query: PayoutListQuery, user: RequestUser) {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'payouts:read:any');
  const where: Prisma.PayoutWhereInput = {
    ...(advisorId ? { advisorId } : {}),
    ...(query.lenderId ? { lenderId: query.lenderId } : {}),
    ...(query.applicationId ? { applicationId: query.applicationId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { payoutNumber: { contains: query.search, mode: 'insensitive' } },
            { paymentReference: { contains: query.search, mode: 'insensitive' } },
            { application: { applicationNumber: { contains: query.search, mode: 'insensitive' } } },
            { application: { customer: { fullName: { contains: query.search, mode: 'insensitive' } } } },
            { advisor: { code: { contains: query.search, mode: 'insensitive' } } },
            { lender: { name: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.payout.findMany({ where, include: payoutSummaryInclude, orderBy: { [query.sortBy]: query.sortOrder }, skip, take: query.pageSize }),
    prisma.payout.count({ where }),
  ]);
  return {
    items: items.map(serializePayout),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

async function payoutForUser(id: string, user: RequestUser, detail = false) {
  const payout = detail
    ? await prisma.payout.findUnique({ where: { id }, include: payoutDetailInclude })
    : await prisma.payout.findUnique({ where: { id }, include: payoutSummaryInclude });
  if (!payout) throw notFound('Payout not found');
  if (!user.permissions.includes('payouts:read:any') && payout.advisorId !== user.advisorId) throw forbidden();
  return payout;
}

export async function getPayout(id: string, user: RequestUser) {
  return serializePayout(await payoutForUser(id, user, true));
}

export async function listPayoutHistory(id: string, query: PayoutHistoryQuery, user: RequestUser) {
  await payoutForUser(id, user);
  const where: Prisma.PayoutStatusHistoryWhereInput = {
    payoutId: id,
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.payoutStatusHistory.findMany({
      where,
      include: { changedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: query.sortOrder }, skip, take: query.pageSize,
    }),
    prisma.payoutStatusHistory.count({ where }),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
}

async function changePayoutStatus(
  tx: Prisma.TransactionClient,
  payout: { id: string; payoutNumber: string; status: PayoutStatus; advisor: { userId: string }; applicationId: string },
  input: UpdatePayoutStatusInput,
  user: RequestUser,
) {
  const application = await tx.application.findUnique({
    where: { id: payout.applicationId }, select: { status: true },
  });
  if (application?.status !== 'DISBURSED') {
    throw conflict('Payout can be processed only after the application is disbursed');
  }
  if (payout.status === input.status) throw conflict(`Payout is already ${input.status}`);
  if (!payoutTransitions[payout.status].includes(input.status)) {
    throw conflict(`Invalid payout transition from ${payout.status} to ${input.status}`);
  }
  const paidAt = input.status === 'PAID' ? input.paidAt ?? new Date() : null;
  const changed = await tx.payout.updateMany({
    where: { id: payout.id, status: payout.status },
    data: {
      status: input.status,
      paymentReference: input.status === 'PAID' ? input.paymentReference : null,
      paymentMethod: input.status === 'PAID' ? input.paymentMethod : null,
      paidAt,
    },
  });
  if (changed.count !== 1) throw conflict('Payout status changed concurrently; retry');
  await tx.payoutStatusHistory.create({
    data: { payoutId: payout.id, fromStatus: payout.status, toStatus: input.status, note: input.note, changedByUserId: user.id },
  });
  await tx.notification.create({
    data: {
      recipientUserId: payout.advisor.userId,
      type: 'PAYOUT_ACTION',
      title: `${payout.payoutNumber} ${input.status.toLowerCase()}`,
      body: input.status === 'PAID'
        ? `Payment completed with reference ${input.paymentReference}.`
        : input.note ?? `Payout status changed from ${payout.status} to ${input.status}.`,
      applicationId: payout.applicationId,
      payoutId: payout.id,
    },
  });
}

export async function updatePayoutStatus(id: string, input: UpdatePayoutStatusInput, user: RequestUser, context: AuditContext) {
  await prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({
      where: { id },
      select: { id: true, payoutNumber: true, status: true, applicationId: true, advisor: { select: { userId: true } } },
    });
    if (!payout) throw notFound('Payout not found');
    await changePayoutStatus(tx, payout, input, user);
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: `PAYOUT_${input.status}`, entityType: 'payout', entityId: id, metadata: { payoutNumber: payout.payoutNumber, fromStatus: payout.status, paymentReference: input.paymentReference ?? null } },
    });
  });
  return getPayout(id, user);
}

export async function bulkProcessPayouts(input: BulkProcessPayoutsInput, user: RequestUser, context: AuditContext) {
  await prisma.$transaction(async (tx) => {
    const payouts = await tx.payout.findMany({
      where: { id: { in: input.payoutIds } },
      select: { id: true, payoutNumber: true, status: true, applicationId: true, advisor: { select: { userId: true } } },
    });
    if (payouts.length !== input.payoutIds.length) throw badRequest('One or more payouts do not exist');
    for (const payout of payouts) {
      await changePayoutStatus(tx, payout, { status: 'PROCESSING', note: input.note }, user);
    }
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'PAYOUTS_BULK_PROCESSING_STARTED', entityType: 'payout_batch', metadata: { payoutIds: input.payoutIds } },
    });
  });
  return { processed: input.payoutIds.length };
}

export async function bulkPayPayouts(input: BulkPayPayoutsInput, user: RequestUser, context: AuditContext) {
  const ids = input.payments.map((payment) => payment.payoutId);
  await prisma.$transaction(async (tx) => {
    const payouts = await tx.payout.findMany({
      where: { id: { in: ids } },
      select: { id: true, payoutNumber: true, status: true, applicationId: true, advisor: { select: { userId: true } } },
    });
    if (payouts.length !== ids.length) throw badRequest('One or more payouts do not exist');
    const byId = new Map(payouts.map((payout) => [payout.id, payout]));
    for (const payment of input.payments) {
      await changePayoutStatus(tx, byId.get(payment.payoutId)!, { status: 'PAID', ...payment, note: input.note }, user);
    }
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'PAYOUTS_BULK_PAID', entityType: 'payout_batch', metadata: { payoutIds: ids, paymentReferences: input.payments.map((payment) => payment.paymentReference) } },
    });
  });
  return { paid: ids.length };
}
