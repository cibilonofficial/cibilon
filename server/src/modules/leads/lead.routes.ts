import type { Request } from 'express';
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { requireAdvisorOwnership } from '../../middleware/ownership.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  activityListQuerySchema,
  convertLeadSchema,
  createActivitySchema,
  createDraftLeadSchema,
  createFollowUpSchema,
  createLeadSchema,
  followUpParamsSchema,
  leadIdParamsSchema,
  leadListQuerySchema,
  updateLeadSchema,
} from './lead.schemas.js';
import {
  addActivity,
  archiveLead,
  completeFollowUp,
  convertLead,
  createDraftLead,
  createLead,
  getLead,
  listActivities,
  listLeads,
  updateLead,
} from './lead.service.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

const leadOwner = async (req: Request) =>
  (
    await prisma.lead.findUnique({
      where: { id: stringParam(req, 'id') },
      select: { advisorId: true },
    })
  )?.advisorId ?? null;

const readLead = [
  requireAnyPermission('leads:read:self', 'leads:read:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: leadOwner,
    bypassPermissions: ['leads:read:any'],
  }),
];

const updateOwnedLead = [
  requireAnyPermission('leads:update:self', 'leads:update:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: leadOwner,
    bypassPermissions: ['leads:update:any'],
  }),
];

export const leadRouter = Router();
leadRouter.use(authenticate);

leadRouter.get(
  '/',
  requireAnyPermission('leads:read:self', 'leads:read:any'),
  validate({ query: leadListQuerySchema }),
  async (req, res) => {
    const result = await listLeads(leadListQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

leadRouter.post(
  '/',
  requirePermission('leads:create'),
  validate({ body: createLeadSchema }),
  async (req, res) => {
    const result = await createLead(createLeadSchema.parse(req.body), req.user!, auditContext(req));
    res.status(201).json({ data: result });
  },
);

leadRouter.post(
  '/drafts',
  requirePermission('leads:create'),
  validate({ body: createDraftLeadSchema }),
  async (req, res) => {
    const result = await createDraftLead(
      createDraftLeadSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);

leadRouter.get(
  '/:id',
  validate({ params: leadIdParamsSchema }),
  ...readLead,
  async (req, res) => {
    res.json({ data: await getLead(stringParam(req, 'id')) });
  },
);

leadRouter.patch(
  '/:id',
  validate({ params: leadIdParamsSchema, body: updateLeadSchema }),
  ...updateOwnedLead,
  async (req, res) => {
    const result = await updateLead(
      stringParam(req, 'id'),
      updateLeadSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

leadRouter.put(
  '/:id/draft',
  validate({ params: leadIdParamsSchema, body: updateLeadSchema }),
  ...updateOwnedLead,
  async (req, res) => {
    const result = await updateLead(
      stringParam(req, 'id'),
      updateLeadSchema.parse(req.body),
      req.user!,
      auditContext(req),
      true,
    );
    res.json({ data: result });
  },
);

leadRouter.delete(
  '/:id',
  validate({ params: leadIdParamsSchema }),
  ...updateOwnedLead,
  async (req, res) => {
    await archiveLead(stringParam(req, 'id'), req.user!, auditContext(req));
    res.status(204).send();
  },
);

leadRouter.get(
  '/:id/activities',
  validate({ params: leadIdParamsSchema, query: activityListQuerySchema }),
  ...readLead,
  async (req, res) => {
    const result = await listActivities(
      stringParam(req, 'id'),
      activityListQuerySchema.parse(req.query),
    );
    res.json({ data: result.items, pagination: result.pagination });
  },
);

leadRouter.post(
  '/:id/activities',
  validate({ params: leadIdParamsSchema, body: createActivitySchema }),
  ...updateOwnedLead,
  async (req, res) => {
    const activity = await addActivity(
      stringParam(req, 'id'),
      createActivitySchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: activity });
  },
);

leadRouter.post(
  '/:id/follow-ups',
  validate({ params: leadIdParamsSchema, body: createFollowUpSchema }),
  ...updateOwnedLead,
  async (req, res) => {
    const input = createFollowUpSchema.parse(req.body);
    const activity = await addActivity(
      stringParam(req, 'id'),
      { kind: 'FOLLOW_UP', note: input.note, dueAt: input.dueAt },
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: activity });
  },
);

leadRouter.patch(
  '/:id/follow-ups/:activityId/complete',
  validate({ params: followUpParamsSchema }),
  ...updateOwnedLead,
  async (req, res) => {
    const activity = await completeFollowUp(
      stringParam(req, 'id'),
      stringParam(req, 'activityId'),
      req.user!,
      auditContext(req),
    );
    res.json({ data: activity });
  },
);

leadRouter.post(
  '/:id/convert',
  validate({ params: leadIdParamsSchema, body: convertLeadSchema }),
  ...updateOwnedLead,
  async (req, res) => {
    const input = convertLeadSchema.parse(req.body);
    const application = await convertLead(
      stringParam(req, 'id'),
      input.remarks,
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: application });
  },
);
