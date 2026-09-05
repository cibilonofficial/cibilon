import { z } from 'zod';

export const payoutIdParamsSchema = z.object({ id: z.string().uuid() });

export const payoutListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  advisorId: z.string().uuid().optional(),
  lenderId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'payoutNumber', 'payoutAmount', 'status', 'paidAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).refine((input) => !(input.dateFrom && input.dateTo && input.dateFrom > input.dateTo), {
  message: 'dateFrom must be before or equal to dateTo',
});

export const payoutHistoryQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const updatePayoutStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED']),
    paymentReference: z.string().trim().min(3).max(160).optional(),
    paymentMethod: z.string().trim().min(2).max(50).optional(),
    paidAt: z.coerce.date().optional(),
    note: z.string().trim().min(2).max(5000).optional(),
  })
  .superRefine((input, context) => {
    if (input.status === 'PAID' && !input.paymentReference) {
      context.addIssue({ code: 'custom', path: ['paymentReference'], message: 'UTR or payment reference is required' });
    }
    if (input.status !== 'PAID' && (input.paymentReference || input.paymentMethod || input.paidAt)) {
      context.addIssue({ code: 'custom', message: 'Payment details are only accepted when marking a payout PAID' });
    }
    if (['FAILED', 'CANCELLED'].includes(input.status) && !input.note) {
      context.addIssue({ code: 'custom', path: ['note'], message: 'A note is required for failed or cancelled payouts' });
    }
  });

const payoutIds = z.array(z.string().uuid()).min(1).max(100).refine(
  (ids) => new Set(ids).size === ids.length,
  'Payout IDs must be unique',
);

export const bulkProcessPayoutsSchema = z.object({
  payoutIds,
  note: z.string().trim().min(2).max(5000).optional(),
});

export const bulkPayPayoutsSchema = z.object({
  payments: z
    .array(z.object({
      payoutId: z.string().uuid(),
      paymentReference: z.string().trim().min(3).max(160),
      paymentMethod: z.string().trim().min(2).max(50).optional(),
      paidAt: z.coerce.date().optional(),
    }))
    .min(1)
    .max(100)
    .refine((items) => new Set(items.map((item) => item.payoutId)).size === items.length, 'Payout IDs must be unique'),
  note: z.string().trim().min(2).max(5000).optional(),
});

export type PayoutListQuery = z.infer<typeof payoutListQuerySchema>;
export type PayoutHistoryQuery = z.infer<typeof payoutHistoryQuerySchema>;
export type UpdatePayoutStatusInput = z.infer<typeof updatePayoutStatusSchema>;
export type BulkProcessPayoutsInput = z.infer<typeof bulkProcessPayoutsSchema>;
export type BulkPayPayoutsInput = z.infer<typeof bulkPayPayoutsSchema>;
