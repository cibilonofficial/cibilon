import { z } from 'zod';

const booleanQuery = z.enum(['true', 'false']).optional().transform(
  (value) => (value === undefined ? undefined : value === 'true'),
);

export const notificationIdParamsSchema = z.object({ id: z.string().uuid() });

export const notificationListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  type: z.enum([
    'APPLICATION_CREATED', 'APPLICATION_ASSIGNED', 'LEAD_ASSIGNED', 'FOLLOW_UP_DUE',
    'STATUS_CHANGED', 'DOCUMENT_ACTION', 'PAYOUT_ACTION', 'SUPPORT_ACTION', 'REPORT_ACTION', 'SECURITY',
  ]).optional(),
  isRead: booleanQuery,
  applicationId: z.string().uuid().optional(),
  payoutId: z.string().uuid().optional(),
  ticketId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'isRead', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).refine((input) => !(input.dateFrom && input.dateTo && input.dateFrom > input.dateTo), {
  message: 'dateFrom must be before or equal to dateTo',
});

export const updateNotificationReadSchema = z.object({ isRead: z.boolean() });

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
