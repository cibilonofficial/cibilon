import type { Prisma } from '../../../generated/prisma/client.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import {
  decryptSensitive,
  encryptSensitive,
  lastFour,
  maskedLastFour,
} from '../../lib/sensitive-data.js';
import type { RequestUser } from '../../types/express.js';
import type { AuditContext } from '../audit/audit.service.js';
import type {
  AdvisorBankAccountInput,
  AdvisorBankReviewInput,
  AdvisorListQuery,
  AdvisorStatusInput,
  CreateAdvisorInput,
  UpdateAdvisorInput,
} from './advisor.schemas.js';

const advisorInclude = {
  user: { select: { id: true, name: true, email: true, mobile: true, status: true, lastLoginAt: true } },
  bankAccount: { include: { reviewedBy: { select: { id: true, name: true, email: true } } } },
  _count: { select: { customers: true, leads: true, applications: true } },
} satisfies Prisma.AdvisorInclude;

type AdvisorRecord = Prisma.AdvisorGetPayload<{ include: typeof advisorInclude }>;

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function serializeBankAccount(bank: AdvisorRecord['bankAccount']) {
  if (!bank) return null;
  const {
    accountNumberEncrypted: _encrypted,
    accountNumberLastFour: _lastFour,
    ...safe
  } = bank;
  void _encrypted;
  void _lastFour;
  return { ...safe, accountNumberMasked: maskedLastFour(bank.accountNumberLastFour) };
}

function serializeAdvisor(advisor: AdvisorRecord) {
  const { panEncrypted: _pan, panLastFour: _panLastFour, bankAccount, ...safe } = advisor;
  void _pan;
  void _panLastFour;
  return {
    ...safe,
    status: advisor.user.status,
    panMasked: maskedLastFour(advisor.panLastFour),
    bankAccount: serializeBankAccount(bankAccount),
  };
}

function auditData(user: RequestUser, context: AuditContext) {
  return {
    actorUserId: user.id,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

export async function listAdvisors(query: AdvisorListQuery) {
  const where: Prisma.AdvisorWhereInput = {
    ...(query.status ? { user: { status: query.status } } : {}),
    ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
    ...(query.state ? { state: { equals: query.state, mode: 'insensitive' } } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { agency: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
            { user: { name: { contains: query.search, mode: 'insensitive' } } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { user: { mobile: { contains: query.search } } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.advisor.findMany({
      where,
      include: advisorInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.advisor.count({ where }),
  ]);
  return {
    items: items.map(serializeAdvisor),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function getAdvisor(id: string) {
  const advisor = await prisma.advisor.findUnique({ where: { id }, include: advisorInclude });
  if (!advisor) throw notFound('Advisor not found');
  return serializeAdvisor(advisor);
}

export async function createAdvisor(
  input: CreateAdvisorInput,
  user: RequestUser,
  context: AuditContext,
) {
  const role = await prisma.role.findUnique({ where: { slug: 'advisor' }, select: { id: true } });
  if (!role) throw new Error('Advisor role seed is missing');
  const passwordHash = await hashPassword(input.password);
  try {
    const advisorId = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          mobile: normalizeMobile(input.mobile),
          passwordHash,
          userRoles: { create: { roleId: role.id } },
          advisorProfile: {
            create: {
              code: input.code,
              agency: input.agency,
              gstin: input.gstin,
              ...(input.pan
                ? { panEncrypted: encryptSensitive(input.pan), panLastFour: lastFour(input.pan) }
                : {}),
              addressLine: input.addressLine,
              city: input.city,
              state: input.state,
              pincode: input.pincode,
              photoUrl: input.photoUrl,
            },
          },
        },
        select: { advisorProfile: { select: { id: true } } },
      });
      const id = created.advisorProfile!.id;
      await tx.auditLog.create({
        data: {
          ...auditData(user, context),
          action: 'ADVISOR_CREATED',
          entityType: 'advisor',
          entityId: id,
          metadata: { code: input.code },
        },
      });
      return id;
    });
    return getAdvisor(advisorId);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('Advisor email, mobile, or code is already in use');
    }
    throw error;
  }
}

export async function updateAdvisor(
  id: string,
  input: UpdateAdvisorInput,
  user: RequestUser,
  context: AuditContext,
) {
  const isSelf = user.advisorId === id;
  if (isSelf && input.code !== undefined) throw forbidden('Advisor codes can only be changed by an administrator');
  try {
    await prisma.$transaction(async (tx) => {
      const advisor = await tx.advisor.findUnique({ where: { id }, select: { userId: true } });
      if (!advisor) throw notFound('Advisor not found');
      const userData: Prisma.UserUpdateInput = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.mobile !== undefined ? { mobile: normalizeMobile(input.mobile) } : {}),
      };
      if (Object.keys(userData).length) await tx.user.update({ where: { id: advisor.userId }, data: userData });
      await tx.advisor.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.agency !== undefined ? { agency: input.agency } : {}),
          ...(input.gstin !== undefined ? { gstin: input.gstin } : {}),
          ...(input.pan !== undefined
            ? { panEncrypted: encryptSensitive(input.pan), panLastFour: lastFour(input.pan) }
            : {}),
          ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
          ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
          ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          ...auditData(user, context),
          action: 'ADVISOR_UPDATED',
          entityType: 'advisor',
          entityId: id,
          metadata: { fields: Object.keys(input), selfService: isSelf },
        },
      });
    });
    return getAdvisor(id);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('Advisor email, mobile, or code is already in use');
    }
    throw error;
  }
}

export async function updateAdvisorStatus(
  id: string,
  input: AdvisorStatusInput,
  user: RequestUser,
  context: AuditContext,
) {
  await prisma.$transaction(async (tx) => {
    const advisor = await tx.advisor.findUnique({ where: { id }, select: { userId: true, code: true } });
    if (!advisor) throw notFound('Advisor not found');
    await tx.user.update({ where: { id: advisor.userId }, data: { status: input.status } });
    if (input.status !== 'ACTIVE') {
      await tx.session.updateMany({ where: { userId: advisor.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: `ADVISOR_${input.status}`,
        entityType: 'advisor',
        entityId: id,
        metadata: { code: advisor.code, reason: input.reason },
      },
    });
  });
  return getAdvisor(id);
}

export async function upsertAdvisorBankAccount(
  advisorId: string,
  input: AdvisorBankAccountInput,
  user: RequestUser,
  context: AuditContext,
) {
  const encrypted = encryptSensitive(input.accountNumber);
  await prisma.$transaction(async (tx) => {
    const advisor = await tx.advisor.findUnique({ where: { id: advisorId }, select: { id: true } });
    if (!advisor) throw notFound('Advisor not found');
    await tx.advisorBankAccount.upsert({
      where: { advisorId },
      update: {
        accountHolder: input.accountHolder,
        bankName: input.bankName,
        accountNumberEncrypted: encrypted,
        accountNumberLastFour: lastFour(input.accountNumber),
        ifsc: input.ifsc,
        status: 'PENDING_VERIFICATION',
        rejectionReason: null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
      create: {
        advisorId,
        accountHolder: input.accountHolder,
        bankName: input.bankName,
        accountNumberEncrypted: encrypted,
        accountNumberLastFour: lastFour(input.accountNumber),
        ifsc: input.ifsc,
      },
    });
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: 'ADVISOR_BANK_ACCOUNT_UPDATED',
        entityType: 'advisor',
        entityId: advisorId,
        metadata: { selfService: user.advisorId === advisorId },
      },
    });
  });
  return getAdvisor(advisorId);
}

export async function reviewAdvisorBankAccount(
  advisorId: string,
  input: AdvisorBankReviewInput,
  user: RequestUser,
  context: AuditContext,
) {
  await prisma.$transaction(async (tx) => {
    const bank = await tx.advisorBankAccount.findUnique({ where: { advisorId } });
    if (!bank) throw notFound('Advisor bank account not found');
    await tx.advisorBankAccount.update({
      where: { advisorId },
      data: {
        status: input.status,
        rejectionReason: input.status === 'REJECTED' ? input.reason : null,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: `ADVISOR_BANK_ACCOUNT_${input.status}`,
        entityType: 'advisor',
        entityId: advisorId,
      },
    });
  });
  return getAdvisor(advisorId);
}

export async function getAdvisorSensitive(
  advisorId: string,
  user: RequestUser,
  context: AuditContext,
) {
  const advisor = await prisma.advisor.findUnique({
    where: { id: advisorId },
    include: { bankAccount: true },
  });
  if (!advisor) throw notFound('Advisor not found');
  await prisma.auditLog.create({
    data: {
      ...auditData(user, context),
      action: 'ADVISOR_SENSITIVE_DATA_ACCESSED',
      entityType: 'advisor',
      entityId: advisorId,
      metadata: { selfService: user.advisorId === advisorId },
    },
  });
  return {
    advisorId,
    pan: advisor.panEncrypted ? decryptSensitive(advisor.panEncrypted) : null,
    bankAccount: advisor.bankAccount
      ? {
          accountHolder: advisor.bankAccount.accountHolder,
          bankName: advisor.bankAccount.bankName,
          accountNumber: decryptSensitive(advisor.bankAccount.accountNumberEncrypted),
          ifsc: advisor.bankAccount.ifsc,
          status: advisor.bankAccount.status,
        }
      : null,
  };
}
