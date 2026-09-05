import { z } from 'zod';

const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const listBase = {
  search: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED']).optional(),
  required: booleanQuery,
  uploaded: booleanQuery,
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['requestedAt', 'displayName', 'status']).default('requestedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const applicationDocumentListQuerySchema = z.object(listBase);

export const documentListQuerySchema = z.object({
  ...listBase,
  applicationId: z.string().uuid().optional(),
  advisorId: z.string().uuid().optional(),
  documentType: z.string().trim().max(100).optional(),
  malwareScanStatus: z.enum(['PENDING', 'CLEAN', 'INFECTED', 'FAILED']).optional(),
});

export const applicationIdParamsSchema = z.object({ id: z.string().uuid() });
export const documentIdParamsSchema = z.object({ id: z.string().uuid() });
export const documentVersionParamsSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const initialUploadBodySchema = z.object({ documentRequestId: z.string().uuid() });

export const createDocumentRequestSchema = z.object({
  documentType: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{1,99}$/, 'Use a lowercase document-type identifier'),
  displayName: z.string().trim().min(2).max(200),
  required: z.boolean().default(true),
  remarks: z.string().trim().max(2000).optional(),
});

export const updateDocumentStatusSchema = z
  .object({
    status: z.enum(['VERIFIED', 'REJECTED']),
    reason: z.string().trim().max(5000).optional(),
  })
  .refine((input) => input.status !== 'REJECTED' || Boolean(input.reason), {
    path: ['reason'],
    message: 'A rejection reason is required',
  });

export const documentVersionListQuerySchema = z.object({
  malwareScanStatus: z.enum(['PENDING', 'CLEAN', 'INFECTED', 'FAILED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ApplicationDocumentListQuery = z.infer<typeof applicationDocumentListQuerySchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
export type CreateDocumentRequestInput = z.infer<typeof createDocumentRequestSchema>;
export type UpdateDocumentStatusInput = z.infer<typeof updateDocumentStatusSchema>;
export type DocumentVersionListQuery = z.infer<typeof documentVersionListQuerySchema>;
