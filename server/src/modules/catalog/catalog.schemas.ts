import { z } from 'zod';
import { SERVICE_TYPES } from '../../common/domain.js';

const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const nullableMoney = z.coerce.number().min(0).max(9999999999999.99).nullable().optional();
const nullablePositiveInteger = z.coerce.number().int().min(1).max(1200).nullable().optional();
const nullableRate = z.coerce.number().min(0).max(100).nullable().optional();

export const catalogIdParamsSchema = z.object({ id: z.string().uuid() });

export const lenderListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  type: z.enum(['BANK', 'NBFC', 'HFC', 'FINTECH', 'INSURER']).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).optional(),
  city: z.string().trim().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['name', 'type', 'status', 'turnaroundDays', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const lenderFields = {
  name: z.string().trim().min(2).max(200),
  type: z.enum(['BANK', 'NBFC', 'HFC', 'FINTECH', 'INSURER']),
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).optional(),
  turnaroundDays: z.coerce.number().int().min(1).max(365).optional(),
  contactPerson: nullableText(160),
  email: z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  phone: nullableText(20),
  city: nullableText(100),
  notes: nullableText(5000),
};

export const createLenderSchema = z.object(lenderFields);
export const updateLenderSchema = z
  .object({
    name: lenderFields.name.optional(),
    type: lenderFields.type.optional(),
    status: lenderFields.status,
    turnaroundDays: lenderFields.turnaroundDays,
    contactPerson: lenderFields.contactPerson,
    email: lenderFields.email,
    phone: lenderFields.phone,
    city: lenderFields.city,
    notes: lenderFields.notes,
  })
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');

const eligibilitySchema = z.array(z.string().trim().min(2).max(500)).max(50);
const documentsSchema = z
  .array(
    z.object({
      documentType: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/).max(100),
      displayName: z.string().trim().min(2).max(200),
      required: z.boolean().default(true),
      sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
    }),
  )
  .max(100)
  .refine((items) => new Set(items.map((item) => item.documentType)).size === items.length, {
    message: 'Document types must be unique',
  });

const productFields = {
  active: z.boolean().optional(),
  tagline: nullableText(500),
  minAmount: nullableMoney,
  maxAmount: nullableMoney,
  minTenureMonths: nullablePositiveInteger,
  maxTenureMonths: nullablePositiveInteger,
  interestFrom: nullableRate,
  interestTo: nullableRate,
  turnaroundDays: nullablePositiveInteger,
  eligibility: eligibilitySchema.optional(),
  documents: documentsSchema.optional(),
};

function validProductRanges(input: {
  minAmount?: number | null;
  maxAmount?: number | null;
  minTenureMonths?: number | null;
  maxTenureMonths?: number | null;
  interestFrom?: number | null;
  interestTo?: number | null;
}) {
  return !(
    (input.minAmount != null && input.maxAmount != null && input.minAmount > input.maxAmount) ||
    (input.minTenureMonths != null && input.maxTenureMonths != null && input.minTenureMonths > input.maxTenureMonths) ||
    (input.interestFrom != null && input.interestTo != null && input.interestFrom > input.interestTo)
  );
}

export const productListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  active: booleanQuery,
  serviceType: z.enum(SERVICE_TYPES).optional(),
  lenderId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['serviceType', 'active', 'turnaroundDays', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createProductSchema = z
  .object({ serviceType: z.enum(SERVICE_TYPES), ...productFields })
  .refine(validProductRanges, { message: 'Minimum values cannot exceed maximum values' });

export const updateProductSchema = z
  .object({ serviceType: z.enum(SERVICE_TYPES).optional(), ...productFields })
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')
  .refine(validProductRanges, { message: 'Minimum values cannot exceed maximum values' });

export const productLenderMappingsSchema = z
  .object({
    mappings: z.array(
      z.object({
        lenderId: z.string().uuid(),
        active: z.boolean().default(true),
        turnaroundDays: nullablePositiveInteger,
      }),
    ).max(200),
  })
  .refine((input) => new Set(input.mappings.map((item) => item.lenderId)).size === input.mappings.length, {
    path: ['mappings'],
    message: 'Lender mappings must be unique',
  });

export const commissionListQuerySchema = z.object({
  lenderId: z.string().uuid().optional(),
  active: booleanQuery,
  effectiveAt: z.coerce.date().optional(),
  sortBy: z.enum(['version', 'effectiveFrom', 'createdAt']).default('version'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createCommissionRuleSchema = z
  .object({
    lenderId: z.string().uuid().nullable().optional(),
    calculationType: z.enum(['PERCENTAGE', 'FLAT']),
    percentageRate: z.coerce.number().min(0).max(100).nullable().optional(),
    flatAmount: z.coerce.number().min(0).max(9999999999999.99).nullable().optional(),
    effectiveFrom: z.coerce.date(),
  })
  .superRefine((input, context) => {
    if (input.calculationType === 'PERCENTAGE' && input.percentageRate == null) {
      context.addIssue({ code: 'custom', path: ['percentageRate'], message: 'Percentage rate is required' });
    }
    if (input.calculationType === 'PERCENTAGE' && input.flatAmount != null) {
      context.addIssue({ code: 'custom', path: ['flatAmount'], message: 'Flat amount is not allowed for a percentage rule' });
    }
    if (input.calculationType === 'FLAT' && input.flatAmount == null) {
      context.addIssue({ code: 'custom', path: ['flatAmount'], message: 'Flat amount is required' });
    }
    if (input.calculationType === 'FLAT' && input.percentageRate != null) {
      context.addIssue({ code: 'custom', path: ['percentageRate'], message: 'Percentage rate is not allowed for a flat rule' });
    }
  });

export type LenderListQuery = z.infer<typeof lenderListQuerySchema>;
export type CreateLenderInput = z.infer<typeof createLenderSchema>;
export type UpdateLenderInput = z.infer<typeof updateLenderSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductLenderMappingsInput = z.infer<typeof productLenderMappingsSchema>;
export type CommissionListQuery = z.infer<typeof commissionListQuerySchema>;
export type CreateCommissionRuleInput = z.infer<typeof createCommissionRuleSchema>;
