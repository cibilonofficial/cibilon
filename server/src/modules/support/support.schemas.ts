import { z } from 'zod';

const ticketStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const ticketPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const ticketCategories = ['APPLICATION_QUERY', 'DOCUMENT_ISSUE', 'PAYOUT_QUERY', 'ACCOUNT_ACCESS', 'PRODUCT_INFORMATION', 'OTHER'] as const;

export const ticketIdParamsSchema = z.object({ id: z.string().uuid() });

export const ticketListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  advisorId: z.string().uuid().optional(),
  assignedStaffId: z.string().uuid().optional(),
  unassigned: z.enum(['true', 'false']).optional().transform((value) => value === undefined ? undefined : value === 'true'),
  applicationId: z.string().uuid().optional(),
  payoutId: z.string().uuid().optional(),
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  category: z.enum(ticketCategories).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'ticketNumber', 'status', 'priority']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).refine((input) => !(input.assignedStaffId && input.unassigned), {
  message: 'assignedStaffId and unassigned=true cannot be combined',
});

export const createTicketSchema = z.object({
  advisorId: z.string().uuid().optional(),
  subject: z.string().trim().min(3).max(200),
  category: z.enum(ticketCategories),
  priority: z.enum(ticketPriorities).default('NORMAL'),
  applicationId: z.string().uuid().nullable().optional(),
  payoutId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(10000),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(ticketStatuses).optional(),
    priority: z.enum(ticketPriorities).optional(),
    assignedStaffId: z.string().uuid().nullable().optional(),
    note: z.string().trim().min(2).max(5000).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')
  .refine((input) => !input.status || !['RESOLVED', 'CLOSED'].includes(input.status) || Boolean(input.note), {
    path: ['note'], message: 'A note is required when resolving or closing a ticket',
  });

export const createTicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  internal: z.boolean().default(false),
});

export const ticketMessageListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateTicketMessageInput = z.infer<typeof createTicketMessageSchema>;
export type TicketMessageListQuery = z.infer<typeof ticketMessageListQuerySchema>;
