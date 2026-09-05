import { z } from 'zod';
import { ACTIVITY_KINDS, LEAD_STAGES, SERVICE_TYPES } from '../../common/domain.js';
import { createCustomerSchema, customerDraftSchema } from '../customers/customer.schemas.js';

const creditScoreSchema = z.union([
  z.coerce.number().int().min(300).max(900),
  z.enum([
    'Below 600',
    '600 – 650',
    '650 – 700',
    '700 – 750',
    '750 – 800',
    'Above 800',
    'Not known',
  ]),
]);

export const employmentSchema = z
  .object({
    employmentType: z.enum(['Salaried', 'Self Employed', 'Business', 'Other']).optional(),
    monthlyIncome: z.coerce.number().nonnegative().optional(),
    organisation: z.string().trim().max(200).optional(),
    experience: z.string().trim().max(50).optional(),
    designation: z.string().trim().max(100).optional(),
    businessVintage: z.string().trim().max(50).optional(),
    businessType: z.string().trim().max(100).optional(),
    gstin: z.string().trim().toUpperCase().max(15).optional(),
    natureOfWork: z.string().trim().max(200).optional(),
    existingLoans: z.enum(['Yes', 'No']).optional(),
    existingEmi: z.coerce.number().nonnegative().optional(),
    creditScore: creditScoreSchema.optional(),
    bankName: z.string().trim().max(160).optional(),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/).optional(),
    ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
  })
  .strict();

export const serviceDetailsSchema = z
  .object({
    tenure: z.string().trim().max(50).optional(),
    purpose: z.string().trim().max(160).optional(),
    preferredLender: z.string().trim().max(160).optional(),
    cardCategory: z.string().trim().max(100).optional(),
    existingCards: z.string().trim().max(500).optional(),
    insuranceType: z.string().trim().max(100).optional(),
    sumAssured: z.coerce.number().nonnegative().optional(),
    premiumFrequency: z.string().trim().max(50).optional(),
    serviceNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

const commonLeadFields = {
  advisorId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  requestedAmount: z.coerce.number().positive().max(999_999_999_999).optional(),
  employment: employmentSchema.optional(),
  serviceDetails: serviceDetailsSchema.optional(),
  source: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(5000).optional(),
  nextFollowUpAt: z.coerce.date().optional(),
};

export const createDraftLeadSchema = z
  .object({ ...commonLeadFields, customer: customerDraftSchema.optional() })
  .strict()
  .refine((input) => !(input.customerId && input.customer), {
    message: 'Provide customerId or customer, not both',
  });

export const createLeadSchema = z
  .object({ ...commonLeadFields, customer: createCustomerSchema.omit({ advisorId: true }).optional() })
  .strict()
  .refine((input) => !(input.customerId && input.customer), {
    message: 'Provide customerId or customer, not both',
  })
  .refine((input) => Boolean(input.customerId || input.customer), {
    path: ['customer'],
    message: 'customerId or customer is required',
  })
  .refine((input) => Boolean(input.serviceType), {
    path: ['serviceType'],
    message: 'serviceType is required',
  });

export const updateLeadSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    customer: customerDraftSchema.optional(),
    serviceType: z.enum(SERVICE_TYPES).optional(),
    requestedAmount: z.coerce.number().positive().max(999_999_999_999).nullable().optional(),
    employment: employmentSchema.optional(),
    serviceDetails: serviceDetailsSchema.optional(),
    source: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    nextFollowUpAt: z.coerce.date().nullable().optional(),
    stage: z.enum(LEAD_STAGES).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')
  .refine((input) => !(input.customerId && input.customer), {
    message: 'Provide customerId or customer, not both',
  });

export const leadIdParamsSchema = z.object({ id: z.string().uuid() });
export const followUpParamsSchema = z.object({ id: z.string().uuid(), activityId: z.string().uuid() });

export const leadListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  advisorId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CONVERTED', 'ARCHIVED']).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  followUpFrom: z.coerce.date().optional(),
  followUpTo: z.coerce.date().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'requestedAmount', 'nextFollowUpAt', 'stage'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createActivitySchema = z
  .object({
    kind: z.enum(ACTIVITY_KINDS).exclude(['CONVERSION', 'STAGE_CHANGE']),
    note: z.string().trim().min(1).max(5000),
    dueAt: z.coerce.date().optional(),
  })
  .refine((input) => input.kind !== 'FOLLOW_UP' || input.dueAt, {
    path: ['dueAt'],
    message: 'dueAt is required for a follow-up',
  });

export const createFollowUpSchema = z.object({
  note: z.string().trim().min(1).max(5000),
  dueAt: z.coerce.date(),
});

export const convertLeadSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
});

export const activityListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  kind: z.enum(ACTIVITY_KINDS).optional(),
  completed: z.enum(['true', 'false']).optional().transform((value) =>
    value === undefined ? undefined : value === 'true',
  ),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'dueAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateDraftLeadInput = z.infer<typeof createDraftLeadSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
