import { z } from 'zod';
import { APPLICATION_STATUSES, SERVICE_TYPES } from '../../common/domain.js';

const baseFilters = {
  search: z.string().trim().max(100).optional(),
  advisorId: z.string().uuid().optional(),
  lenderId: z.string().uuid().optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
};

export const dashboardQuerySchema = z.object({
  ...baseFilters,
}).refine((input) => !(input.dateFrom && input.dateTo && input.dateFrom > input.dateTo), {
  message: 'dateFrom must be before or equal to dateTo',
});

export const applicationReportQuerySchema = z.object({
  ...baseFilters,
  status: z.enum(APPLICATION_STATUSES).optional(),
  sortBy: z.enum(['createdAt', 'applicationNumber', 'status', 'requestedAmount', 'disbursedAmount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const advisorReportQuerySchema = z.object({
  ...baseFilters,
  sortBy: z.enum(['name', 'applications', 'disbursed', 'disbursedVolume', 'payoutAmount']).default('payoutAmount'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const payoutReportQuerySchema = z.object({
  ...baseFilters,
  status: z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED']).optional(),
  sortBy: z.enum(['createdAt', 'payoutNumber', 'status', 'payoutAmount', 'paidAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const lenderReportQuerySchema = z.object({
  ...baseFilters,
  sortBy: z.enum(['name', 'applications', 'disbursed', 'disbursedVolume', 'payoutAmount']).default('disbursedVolume'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const createExportJobSchema = z.object({
  reportType: z.enum(['APPLICATIONS', 'ADVISORS', 'PAYOUTS', 'LENDERS']),
  format: z.enum(['CSV', 'PDF']),
  filters: z.object({ ...baseFilters, status: z.string().trim().max(50).optional() }).default({}),
});

export const exportJobListQuerySchema = z.object({
  status: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  reportType: z.enum(['APPLICATIONS', 'ADVISORS', 'PAYOUTS', 'LENDERS']).optional(),
  format: z.enum(['CSV', 'PDF']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const exportJobIdParamsSchema = z.object({ id: z.string().uuid() });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type ApplicationReportQuery = z.infer<typeof applicationReportQuerySchema>;
export type AdvisorReportQuery = z.infer<typeof advisorReportQuerySchema>;
export type PayoutReportQuery = z.infer<typeof payoutReportQuerySchema>;
export type LenderReportQuery = z.infer<typeof lenderReportQuerySchema>;
export type CreateExportJobInput = z.infer<typeof createExportJobSchema>;
export type ExportJobListQuery = z.infer<typeof exportJobListQuerySchema>;
