import type { Request } from 'express';
import { Router } from 'express';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import { createRateCardEntrySchema, rateCardIdSchema, updateRateCardEntrySchema } from './rate-card.schemas.js';
import { createRateCardEntry, listRateCardEntries, updateRateCardEntry } from './rate-card.service.js';

const auditContext = (req: Request): AuditContext => ({ requestId: String(req.id), ipAddress: req.ip, userAgent: req.get('user-agent')?.slice(0, 512) ?? null });
export const rateCardRouter = Router();
rateCardRouter.use(authenticate);
rateCardRouter.get('/', requirePermission('products:read'), async (_req, res) => res.json({ data: await listRateCardEntries() }));
rateCardRouter.post('/', requireRole('admin'), requirePermission('products:manage'), validate({ body: createRateCardEntrySchema }), async (req, res) => {
  res.status(201).json({ data: await createRateCardEntry(createRateCardEntrySchema.parse(req.body), req.user!, auditContext(req)) });
});
rateCardRouter.patch('/:id', requireRole('admin'), requirePermission('products:manage'), validate({ params: rateCardIdSchema, body: updateRateCardEntrySchema }), async (req, res) => {
  res.json({ data: await updateRateCardEntry(stringParam(req, 'id'), updateRateCardEntrySchema.parse(req.body), req.user!, auditContext(req)) });
});
