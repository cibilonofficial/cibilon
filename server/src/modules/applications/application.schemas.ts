import { z } from 'zod';
import {
  APPLICATION_ACTIVITY_KINDS,
  APPLICATION_STATUSES,
  SERVICE_TYPES,
} from '../../common/domain.js';

export const applicationIdParamsSchema = z.object({ id: z.string().uuid() });

export const applicationListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    advisorId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    assignedStaffId: z.string().uuid().optional(),
    unassigned: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === 'true')),
    status: z.enum(APPLICATION_STATUSES).optional(),
    serviceType: z.enum(SERVICE_TYPES).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'submittedAt', 'requestedAmount', 'applicationNumber', 'status'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((input) => !(input.assignedStaffId && input.unassigned), {
    message: 'assignedStaffId and unassigned=true cannot be combined',
  })
  .refine((input) => !(input.dateFrom && input.dateTo && input.dateFrom > input.dateTo), {
    message: 'dateFrom must be before or equal to dateTo',
  });

export const updateApplicationStatusSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES),
    remarks: z.string().trim().max(5000).optional(),
    lenderId: z.string().uuid().optional(),
    disbursedAmount: z.coerce.number().min(0).max(9999999999999.99).optional(),
  })
  .refine(
    (input) => !['REJECTED', 'CANCELLED'].includes(input.status) || Boolean(input.remarks),
    { path: ['remarks'], message: 'Remarks are required when rejecting or cancelling' },
  )
  .superRefine((input, context) => {
    if (input.status === 'APPROVED' || input.status === 'DISBURSED') {
      if (!input.lenderId) {
        context.addIssue({ code: 'custom', path: ['lenderId'], message: 'Lender is required for approval and disbursal' });
      }
      if (input.status === 'DISBURSED' && input.disbursedAmount === undefined) {
        context.addIssue({ code: 'custom', path: ['disbursedAmount'], message: 'Actual disbursed amount is required' });
      }
      if (input.status === 'APPROVED' && input.disbursedAmount !== undefined) {
        context.addIssue({ code: 'custom', path: ['disbursedAmount'], message: 'Actual disbursed amount is only accepted when status is DISBURSED' });
      }
    } else if (input.lenderId !== undefined || input.disbursedAmount !== undefined) {
      context.addIssue({ code: 'custom', message: 'Lender details are only accepted when approving or disbursing' });
    }
  });

export const updateApplicationAssignmentSchema = z.object({
  staffId: z.string().uuid().nullable(),
  note: z.string().trim().max(5000).optional(),
});

export const createApplicationRemarkSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  internal: z.boolean().default(true),
});

export const createApplicationActivitySchema = z.object({
  kind: z.enum(APPLICATION_ACTIVITY_KINDS),
  note: z.string().trim().min(1).max(5000),
  internal: z.boolean().default(false),
});

export const applicationEventListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const applicationActivityListQuerySchema = applicationEventListQuerySchema.extend({
  kind: z
    .enum([
      'SUBMISSION',
      'STATUS_CHANGE',
      'ASSIGNMENT',
      'REMARK',
      ...APPLICATION_ACTIVITY_KINDS,
    ])
    .optional(),
  internal: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const applicationRemarkListQuerySchema = applicationEventListQuerySchema.extend({
  internal: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const applicationStatusHistoryListQuerySchema = applicationEventListQuerySchema.extend({
  fromStatus: z.enum(APPLICATION_STATUSES).optional(),
  toStatus: z.enum(APPLICATION_STATUSES).optional(),
});

export const staffWorkloadQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['name', 'openApplications', 'totalApplications']).default('openApplications'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ApplicationListQuery = z.infer<typeof applicationListQuerySchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type UpdateApplicationAssignmentInput = z.infer<typeof updateApplicationAssignmentSchema>;
export type CreateApplicationRemarkInput = z.infer<typeof createApplicationRemarkSchema>;
export type CreateApplicationActivityInput = z.infer<typeof createApplicationActivitySchema>;
export type ApplicationEventListQuery = z.infer<typeof applicationEventListQuerySchema>;
export type ApplicationActivityListQuery = z.infer<typeof applicationActivityListQuerySchema>;
export type ApplicationRemarkListQuery = z.infer<typeof applicationRemarkListQuerySchema>;
export type ApplicationStatusHistoryListQuery = z.infer<typeof applicationStatusHistoryListQuerySchema>;
export type StaffWorkloadQuery = z.infer<typeof staffWorkloadQuerySchema>;
