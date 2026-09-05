import type { Request } from 'express';
import { Router } from 'express';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  bulkPayPayoutsSchema,
  bulkProcessPayoutsSchema,
  payoutHistoryQuerySchema,
  payoutIdParamsSchema,
  payoutListQuerySchema,
  updatePayoutStatusSchema,
} from './payout.schemas.js';
import {
  bulkPayPayouts,
  bulkProcessPayouts,
  getPayout,
  listPayoutHistory,
  listPayouts,
  updatePayoutStatus,
} from './payout.service.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

export const payoutRouter = Router();
payoutRouter.use(authenticate);

payoutRouter.get(
  '/',
  requireAnyPermission('payouts:read:self', 'payouts:read:any'),
  validate({ query: payoutListQuerySchema }),
  async (req, res) => {
    const result = await listPayouts(payoutListQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

payoutRouter.post(
  '/bulk/process',
  requirePermission('payouts:manage'),
  validate({ body: bulkProcessPayoutsSchema }),
  async (req, res) => {
    res.json({ data: await bulkProcessPayouts(bulkProcessPayoutsSchema.parse(req.body), req.user!, auditContext(req)) });
  },
);

payoutRouter.post(
  '/bulk/pay',
  requirePermission('payouts:manage'),
  validate({ body: bulkPayPayoutsSchema }),
  async (req, res) => {
    res.json({ data: await bulkPayPayouts(bulkPayPayoutsSchema.parse(req.body), req.user!, auditContext(req)) });
  },
);

payoutRouter.get(
  '/:id',
  requireAnyPermission('payouts:read:self', 'payouts:read:any'),
  validate({ params: payoutIdParamsSchema }),
  async (req, res) => res.json({ data: await getPayout(stringParam(req, 'id'), req.user!) }),
);

payoutRouter.get(
  '/:id/history',
  requireAnyPermission('payouts:read:self', 'payouts:read:any'),
  validate({ params: payoutIdParamsSchema, query: payoutHistoryQuerySchema }),
  async (req, res) => {
    const result = await listPayoutHistory(stringParam(req, 'id'), payoutHistoryQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

payoutRouter.patch(
  '/:id/status',
  requirePermission('payouts:manage'),
  validate({ params: payoutIdParamsSchema, body: updatePayoutStatusSchema }),
  async (req, res) => {
    const result = await updatePayoutStatus(
      stringParam(req, 'id'),
      updatePayoutStatusSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);
