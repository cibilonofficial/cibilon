import { z } from 'zod';
import { strongPassword } from '../auth/auth.schemas.js';

const profileFields = {
  name: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  mobile: z.string().trim().regex(/^\+?[0-9\s()-]{10,20}$/).optional(),
  agency: z.string().trim().max(160).nullable().optional(),
  gstin: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/).nullable().optional(),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  addressLine: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/).nullable().optional(),
  photoUrl: z.string().url().max(1000).nullable().optional(),
};

export const advisorIdParamsSchema = z.object({ id: z.string().uuid() });

export const advisorListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'code', 'agency']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createAdvisorSchema = z.object({
  ...profileFields,
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(320),
  mobile: z.string().trim().regex(/^\+?[0-9\s()-]{10,20}$/),
  password: strongPassword,
  code: z.string().trim().min(2).max(40),
});

export const updateAdvisorSchema = z
  .object({ code: z.string().trim().min(2).max(40).optional(), ...profileFields })
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');

export const advisorStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  reason: z.string().trim().min(2).max(2000).optional(),
});

export const advisorBankAccountSchema = z.object({
  accountHolder: z.string().trim().min(2).max(160),
  bankName: z.string().trim().min(2).max(160),
  accountNumber: z.string().trim().regex(/^[0-9]{9,18}$/),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
});

export const advisorBankReviewSchema = z
  .object({
    status: z.enum(['VERIFIED', 'REJECTED']),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((input) => input.status !== 'REJECTED' || Boolean(input.reason), {
    path: ['reason'],
    message: 'A rejection reason is required',
  });

export type AdvisorListQuery = z.infer<typeof advisorListQuerySchema>;
export type CreateAdvisorInput = z.infer<typeof createAdvisorSchema>;
export type UpdateAdvisorInput = z.infer<typeof updateAdvisorSchema>;
export type AdvisorStatusInput = z.infer<typeof advisorStatusSchema>;
export type AdvisorBankAccountInput = z.infer<typeof advisorBankAccountSchema>;
export type AdvisorBankReviewInput = z.infer<typeof advisorBankReviewSchema>;
