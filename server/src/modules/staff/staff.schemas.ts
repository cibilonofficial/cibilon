import { z } from 'zod';
import { strongPassword } from '../auth/auth.schemas.js';

export const STAFF_ROLES = [
  'OPERATIONS_MANAGER',
  'CREDIT_ANALYST',
  'VERIFICATION_OFFICER',
  'PAYOUT_EXECUTIVE',
  'RELATIONSHIP_MANAGER',
] as const;

export const staffIdParamsSchema = z.object({ id: z.string().uuid() });

export const staffListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  department: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'code', 'department', 'role']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const staffFields = {
  name: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  mobile: z.string().trim().regex(/^\+?[0-9\s()-]{10,20}$/).optional(),
  code: z.string().trim().min(2).max(40).optional(),
  department: z.string().trim().min(2).max(100).optional(),
  role: z.enum(STAFF_ROLES).optional(),
};

export const createStaffSchema = z.object({
  ...staffFields,
  name: staffFields.name.unwrap(),
  email: staffFields.email.unwrap(),
  mobile: staffFields.mobile.unwrap(),
  code: staffFields.code.unwrap(),
  department: staffFields.department.unwrap(),
  role: staffFields.role.unwrap(),
  password: strongPassword,
  permissionCodes: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
});

export const updateStaffSchema = z
  .object(staffFields)
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');

export const staffStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  reason: z.string().trim().min(2).max(2000).optional(),
});

export const staffPermissionsSchema = z.object({
  permissionCodes: z.array(z.string().trim().min(1).max(100)).max(100),
});

export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffStatusInput = z.infer<typeof staffStatusSchema>;
