import type { Request } from 'express';
import { Router } from 'express';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  createTicketMessageSchema,
  createTicketSchema,
  ticketIdParamsSchema,
  ticketListQuerySchema,
  ticketMessageListQuerySchema,
  updateTicketSchema,
} from './support.schemas.js';
import {
  addTicketMessage,
  createTicket,
  getTicket,
  listTicketMessages,
  listTickets,
  updateTicket,
} from './support.service.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

export const supportRouter = Router();
supportRouter.use(authenticate);

supportRouter.get(
  '/tickets',
  requireAnyPermission('support:read:self', 'support:read:any'),
  validate({ query: ticketListQuerySchema }),
  async (req, res) => {
    const result = await listTickets(ticketListQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

supportRouter.post(
  '/tickets',
  requireAnyPermission('support:create:self', 'support:manage'),
  validate({ body: createTicketSchema }),
  async (req, res) => {
    const result = await createTicket(createTicketSchema.parse(req.body), req.user!, auditContext(req));
    res.status(201).json({ data: result });
  },
);

supportRouter.get(
  '/tickets/:id',
  requireAnyPermission('support:read:self', 'support:read:any'),
  validate({ params: ticketIdParamsSchema }),
  async (req, res) => res.json({ data: await getTicket(stringParam(req, 'id'), req.user!) }),
);

supportRouter.patch(
  '/tickets/:id',
  requirePermission('support:manage'),
  validate({ params: ticketIdParamsSchema, body: updateTicketSchema }),
  async (req, res) => {
    const result = await updateTicket(stringParam(req, 'id'), updateTicketSchema.parse(req.body), req.user!, auditContext(req));
    res.json({ data: result });
  },
);

supportRouter.get(
  '/tickets/:id/messages',
  requireAnyPermission('support:read:self', 'support:read:any'),
  validate({ params: ticketIdParamsSchema, query: ticketMessageListQuerySchema }),
  async (req, res) => {
    const result = await listTicketMessages(stringParam(req, 'id'), ticketMessageListQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

supportRouter.post(
  '/tickets/:id/messages',
  requireAnyPermission('support:message:self', 'support:manage'),
  validate({ params: ticketIdParamsSchema, body: createTicketMessageSchema }),
  async (req, res) => {
    const result = await addTicketMessage(
      stringParam(req, 'id'),
      createTicketMessageSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);
