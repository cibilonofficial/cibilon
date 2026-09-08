import type { Prisma } from '../../../generated/prisma/client.js';
import { badRequest, conflict, notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import type { AuditContext } from '../audit/audit.service.js';
import type {
  CommissionListQuery,
  CreateCommissionRuleInput,
  CreateLenderInput,
  CreateProductInput,
  LenderListQuery,
  ProductLenderMappingsInput,
  ProductListQuery,
  UpdateLenderInput,
  UpdateProductInput,
} from './catalog.schemas.js';

const lenderInclude = {
  _count: { select: { productMappings: true, commissionRules: true } },
} satisfies Prisma.LenderInclude;

const productInclude = {
  lenders: {
    include: { lender: true },
    orderBy: { lender: { name: 'asc' as const } },
  },
  eligibility: { orderBy: [{ sortOrder: 'asc' as const }, { rule: 'asc' as const }] },
  documents: { orderBy: [{ sortOrder: 'asc' as const }, { displayName: 'asc' as const }] },
  commissionRules: {
    where: { active: true },
    include: { lender: { select: { id: true, name: true } } },
    orderBy: [{ effectiveFrom: 'desc' as const }, { version: 'desc' as const }],
  },
  _count: { select: { commissionRules: true } },
} satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function auditData(user: RequestUser, context: AuditContext) {
  return {
    actorUserId: user.id,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

function isPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function serializeProduct(product: ProductRecord) {
  const now = new Date();
  const defaultCommissionRule = product.commissionRules.find(
    (rule) => rule.lenderId === null && rule.effectiveFrom <= now && (!rule.effectiveTo || rule.effectiveTo > now),
  );
  const currentCommissionRules = product.commissionRules.filter(
    (rule) => rule.effectiveFrom <= now && (!rule.effectiveTo || rule.effectiveTo > now),
  );
  return {
    ...product,
    minAmount: product.minAmount?.toString() ?? null,
    maxAmount: product.maxAmount?.toString() ?? null,
    interestFrom: product.interestFrom?.toString() ?? null,
    interestTo: product.interestTo?.toString() ?? null,
    defaultCommissionRule: defaultCommissionRule
      ? serializeCommissionRule(defaultCommissionRule)
      : null,
    commissionOptions: currentCommissionRules.map(serializeCommissionRule),
    commissionRules: undefined,
    lenders: product.lenders.map((mapping) => ({
      productId: mapping.productId,
      lenderId: mapping.lenderId,
      active: mapping.active,
      turnaroundDays: mapping.turnaroundDays,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
      lender: mapping.lender,
    })),
  };
}

function serializeCommissionRule<
  T extends {
    percentageRate: { toString(): string } | null;
    flatAmount: { toString(): string } | null;
  },
>(rule: T) {
  return {
    ...rule,
    percentageRate: rule.percentageRate?.toString() ?? null,
    flatAmount: rule.flatAmount?.toString() ?? null,
  };
}

export async function listLenders(query: LenderListQuery) {
  const where: Prisma.LenderWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { contactPerson: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.lender.findMany({ where, include: lenderInclude, orderBy: { [query.sortBy]: query.sortOrder }, skip, take: query.pageSize }),
    prisma.lender.count({ where }),
  ]);
  return {
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function getLender(id: string) {
  const lender = await prisma.lender.findUnique({ where: { id }, include: lenderInclude });
  if (!lender) throw notFound('Lender not found');
  return lender;
}

export async function createLender(input: CreateLenderInput, user: RequestUser, context: AuditContext) {
  try {
    const id = await prisma.$transaction(async (tx) => {
      const lender = await tx.lender.create({ data: input, select: { id: true } });
      await tx.auditLog.create({
        data: { ...auditData(user, context), action: 'LENDER_CREATED', entityType: 'lender', entityId: lender.id, metadata: { name: input.name } },
      });
      return lender.id;
    });
    return getLender(id);
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) throw conflict('A lender with this name already exists');
    throw error;
  }
}

export async function updateLender(id: string, input: UpdateLenderInput, user: RequestUser, context: AuditContext) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.lender.findUnique({ where: { id }, select: { id: true } });
      if (!current) throw notFound('Lender not found');
      await tx.lender.update({ where: { id }, data: input });
      if (input.status === 'INACTIVE') {
        await tx.productLender.updateMany({ where: { lenderId: id, active: true }, data: { active: false } });
      }
      await tx.auditLog.create({
        data: { ...auditData(user, context), action: 'LENDER_UPDATED', entityType: 'lender', entityId: id, metadata: { fields: Object.keys(input) } },
      });
    });
    return getLender(id);
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) throw conflict('A lender with this name already exists');
    throw error;
  }
}

export async function deactivateLender(id: string, user: RequestUser, context: AuditContext) {
  await prisma.$transaction(async (tx) => {
    const lender = await tx.lender.findUnique({ where: { id }, select: { name: true } });
    if (!lender) throw notFound('Lender not found');
    await tx.lender.update({ where: { id }, data: { status: 'INACTIVE' } });
    await tx.productLender.updateMany({ where: { lenderId: id, active: true }, data: { active: false } });
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'LENDER_DEACTIVATED', entityType: 'lender', entityId: id, metadata: { name: lender.name } },
    });
  });
}

export async function listProducts(query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {
    ...(query.active !== undefined ? { active: query.active } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(query.lenderId ? { lenders: { some: { lenderId: query.lenderId } } } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
    ...(query.search
      ? { OR: [{ serviceType: { contains: query.search, mode: 'insensitive' } }, { tagline: { contains: query.search, mode: 'insensitive' } }] }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: productInclude, orderBy: { [query.sortBy]: query.sortOrder }, skip, take: query.pageSize }),
    prisma.product.count({ where }),
  ]);
  return {
    items: items.map(serializeProduct),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw notFound('Product not found');
  return serializeProduct(product);
}

function scalarProductData(input: CreateProductInput | UpdateProductInput) {
  const { eligibility: _eligibility, documents: _documents, ...scalars } = input;
  void _eligibility;
  void _documents;
  return scalars;
}

export async function createProduct(input: CreateProductInput, user: RequestUser, context: AuditContext) {
  try {
    const id = await prisma.$transaction(async (tx) => {
      const { eligibility, documents, ...scalars } = input;
      const product = await tx.product.create({
        data: {
          ...scalars,
          ...(eligibility
            ? { eligibility: { create: [...new Set(eligibility)].map((rule, index) => ({ rule, sortOrder: index })) } }
            : {}),
          ...(documents
            ? { documents: { create: documents.map((document, index) => ({ ...document, sortOrder: document.sortOrder ?? index })) } }
            : {}),
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: { ...auditData(user, context), action: 'PRODUCT_CREATED', entityType: 'product', entityId: product.id, metadata: { serviceType: input.serviceType } },
      });
      return product.id;
    });
    return getProduct(id);
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) throw conflict('A product for this service type already exists');
    throw error;
  }
}

function valueAsNumber(value: { toString(): string } | number | null | undefined) {
  return value == null ? null : Number(value.toString());
}

export async function updateProduct(id: string, input: UpdateProductInput, user: RequestUser, context: AuditContext) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id } });
      if (!current) throw notFound('Product not found');
      const minAmount = input.minAmount === undefined ? valueAsNumber(current.minAmount) : input.minAmount;
      const maxAmount = input.maxAmount === undefined ? valueAsNumber(current.maxAmount) : input.maxAmount;
      const minTenure = input.minTenureMonths === undefined ? current.minTenureMonths : input.minTenureMonths;
      const maxTenure = input.maxTenureMonths === undefined ? current.maxTenureMonths : input.maxTenureMonths;
      const interestFrom = input.interestFrom === undefined ? valueAsNumber(current.interestFrom) : input.interestFrom;
      const interestTo = input.interestTo === undefined ? valueAsNumber(current.interestTo) : input.interestTo;
      if (
        (minAmount != null && maxAmount != null && minAmount > maxAmount) ||
        (minTenure != null && maxTenure != null && minTenure > maxTenure) ||
        (interestFrom != null && interestTo != null && interestFrom > interestTo)
      ) {
        throw badRequest('Minimum values cannot exceed maximum values');
      }
      await tx.product.update({ where: { id }, data: scalarProductData(input) });
      if (input.eligibility !== undefined) {
        await tx.productEligibility.deleteMany({ where: { productId: id } });
        const rules = [...new Set(input.eligibility)];
        if (rules.length) await tx.productEligibility.createMany({ data: rules.map((rule, sortOrder) => ({ productId: id, rule, sortOrder })) });
      }
      if (input.documents !== undefined) {
        await tx.productDocument.deleteMany({ where: { productId: id } });
        if (input.documents.length) {
          await tx.productDocument.createMany({
            data: input.documents.map((document, index) => ({ productId: id, ...document, sortOrder: document.sortOrder ?? index })),
          });
        }
      }
      await tx.auditLog.create({
        data: { ...auditData(user, context), action: 'PRODUCT_UPDATED', entityType: 'product', entityId: id, metadata: { fields: Object.keys(input) } },
      });
    });
    return getProduct(id);
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) throw conflict('A product for this service type already exists');
    throw error;
  }
}

export async function deactivateProduct(id: string, user: RequestUser, context: AuditContext) {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, select: { serviceType: true } });
    if (!product) throw notFound('Product not found');
    await tx.product.update({ where: { id }, data: { active: false } });
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'PRODUCT_DEACTIVATED', entityType: 'product', entityId: id, metadata: { serviceType: product.serviceType } },
    });
  });
}

export async function replaceProductLenders(
  productId: string,
  input: ProductLenderMappingsInput,
  user: RequestUser,
  context: AuditContext,
) {
  const lenderIds = input.mappings.map((mapping) => mapping.lenderId);
  const lenders = await prisma.lender.findMany({ where: { id: { in: lenderIds } }, select: { id: true, status: true } });
  if (lenders.length !== lenderIds.length) throw badRequest('One or more lenders do not exist');
  const inactive = lenders.filter((lender) => lender.status === 'INACTIVE').map((lender) => lender.id);
  if (inactive.length) throw badRequest('Inactive lenders cannot be mapped', { lenderIds: inactive });
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw notFound('Product not found');
    await tx.productLender.deleteMany({ where: { productId } });
    if (input.mappings.length) {
      await tx.productLender.createMany({ data: input.mappings.map((mapping) => ({ productId, ...mapping })) });
    }
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'PRODUCT_LENDERS_REPLACED', entityType: 'product', entityId: productId, metadata: { lenderIds } },
    });
  });
  return getProduct(productId);
}

export async function listCommissionRules(productId: string, query: CommissionListQuery) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw notFound('Product not found');
  const where: Prisma.CommissionRuleWhereInput = {
    productId,
    ...(query.lenderId ? { lenderId: query.lenderId } : {}),
    ...(query.active !== undefined ? { active: query.active } : {}),
    ...(query.effectiveAt
      ? { effectiveFrom: { lte: query.effectiveAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: query.effectiveAt } }] }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.commissionRule.findMany({
      where,
      include: { lender: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.commissionRule.count({ where }),
  ]);
  return {
    items: items.map(serializeCommissionRule),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function createCommissionRule(
  productId: string,
  input: CreateCommissionRuleInput,
  user: RequestUser,
  context: AuditContext,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const rule = await prisma.$transaction(
        async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
          if (!product) throw notFound('Product not found');
          if (input.lenderId) {
            const mapping = await tx.productLender.findUnique({
              where: { productId_lenderId: { productId, lenderId: input.lenderId } },
              include: { lender: { select: { status: true } } },
            });
            if (!mapping) throw badRequest('The lender is not mapped to this product');
            if (mapping.lender.status === 'INACTIVE') throw badRequest('Commission rules cannot target an inactive lender');
          }
          const scope = { productId, lenderId: input.lenderId ?? null };
          const latest = await tx.commissionRule.findFirst({ where: scope, orderBy: { version: 'desc' } });
          if (latest && input.effectiveFrom <= latest.effectiveFrom) {
            throw conflict('The new effective date must be later than the latest commission version');
          }
          await tx.commissionRule.updateMany({
            where: { ...scope, active: true },
            data: { active: false, effectiveTo: input.effectiveFrom },
          });
          const created = await tx.commissionRule.create({
            data: {
              ...scope,
              version: (latest?.version ?? 0) + 1,
              calculationType: input.calculationType,
              percentageRate: input.calculationType === 'PERCENTAGE' ? input.percentageRate : null,
              flatAmount: input.calculationType === 'FLAT' ? input.flatAmount : null,
              effectiveFrom: input.effectiveFrom,
              active: true,
              createdByUserId: user.id,
            },
            include: { lender: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true, email: true } } },
          });
          await tx.auditLog.create({
            data: {
              ...auditData(user, context),
              action: 'COMMISSION_RULE_VERSION_CREATED',
              entityType: 'commission_rule',
              entityId: created.id,
              metadata: { productId, lenderId: input.lenderId ?? null, version: created.version },
            },
          });
          return created;
        },
        { isolationLevel: 'Serializable' },
      );
      return serializeCommissionRule(rule);
    } catch (error) {
      if (isPrismaCode(error, 'P2034') && attempt < 2) continue;
      if (isPrismaCode(error, 'P2002')) throw conflict('A commission version was created concurrently; retry the request');
      throw error;
    }
  }
  throw conflict('Could not create commission rule after concurrent updates');
}
