import type { Customer, Prisma } from '../../../generated/prisma/client.js';
import { conflict, notFound } from '../../common/errors.js';
import { encryptSensitive, lastFour, maskedLastFour } from '../../lib/sensitive-data.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import { resolveAdvisorForWrite, scopedAdvisorId } from '../advisors/advisor-access.js';
import type {
  CreateCustomerInput,
  CustomerDraftInput,
  CustomerListQuery,
} from './customer.schemas.js';
import type { AuditContext } from '../audit/audit.service.js';

export function customerData(input: CustomerDraftInput): Prisma.CustomerUncheckedUpdateInput {
  return {
    ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
    ...(input.mobile !== undefined ? { mobile: `+91${input.mobile}` } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.dateOfBirth !== undefined
      ? { dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`) }
      : {}),
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    ...(input.pan !== undefined
      ? { panEncrypted: encryptSensitive(input.pan), panLastFour: lastFour(input.pan) }
      : {}),
    ...(input.aadhaar !== undefined
      ? {
          aadhaarEncrypted: encryptSensitive(input.aadhaar),
          aadhaarLastFour: lastFour(input.aadhaar),
        }
      : {}),
    ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.state !== undefined ? { state: input.state } : {}),
    ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
  };
}

export function serializeCustomer(customer: Customer) {
  const {
    panEncrypted: _pan,
    aadhaarEncrypted: _aadhaar,
    panLastFour: _panLastFour,
    aadhaarLastFour: _aadhaarLastFour,
    ...safe
  } = customer;
  void _pan;
  void _aadhaar;
  void _panLastFour;
  void _aadhaarLastFour;
  return {
    ...safe,
    dateOfBirth: customer.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    panMasked: maskedLastFour(customer.panLastFour),
    aadhaarMasked: maskedLastFour(customer.aadhaarLastFour),
  };
}

export async function createCustomer(
  input: CreateCustomerInput,
  user: RequestUser,
  context: AuditContext,
) {
  const advisorId = await resolveAdvisorForWrite(user, input.advisorId);
  try {
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          advisorId,
          createdByUserId: user.id,
          ...customerData(input),
        } as Prisma.CustomerUncheckedCreateInput,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'CUSTOMER_CREATED',
          entityType: 'customer',
          entityId: created.id,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { advisorId },
        },
      });
      return created;
    });
    return serializeCustomer(customer);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('A customer with this mobile number already exists for the advisor');
    }
    throw error;
  }
}

export async function listCustomers(query: CustomerListQuery, user: RequestUser) {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'customers:read:any');
  const where: Prisma.CustomerWhereInput = {
    ...(advisorId ? { advisorId } : {}),
    ...(query.archived ? { archivedAt: { not: null } } : { archivedAt: null }),
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
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { mobile: { contains: query.search } },
            { city: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.customer.count({ where }),
  ]);
  return {
    items: items.map(serializeCustomer),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound('Customer not found');
  return serializeCustomer(customer);
}

export async function updateCustomer(
  id: string,
  input: CustomerDraftInput,
  user: RequestUser,
  context: AuditContext,
) {
  try {
    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({ where: { id }, data: customerData(input) });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'CUSTOMER_UPDATED',
          entityType: 'customer',
          entityId: id,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { fields: Object.keys(input) },
        },
      });
      return updated;
    });
    return serializeCustomer(customer);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('A customer with this mobile number already exists for the advisor');
    }
    throw error;
  }
}

export async function archiveCustomer(
  id: string,
  user: RequestUser,
  context: AuditContext,
) {
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'CUSTOMER_ARCHIVED',
        entityType: 'customer',
        entityId: id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  });
}
