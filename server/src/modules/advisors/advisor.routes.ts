import type { Request } from 'express';
import { Router } from 'express';
import { forbidden } from '../../common/errors.js';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { requireAdvisorOwnership } from '../../middleware/ownership.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  advisorBankAccountSchema,
  advisorBankReviewSchema,
  advisorIdParamsSchema,
  advisorListQuerySchema,
  advisorStatusSchema,
  createAdvisorSchema,
  updateAdvisorSchema,
} from './advisor.schemas.js';
import {
  createAdvisor,
  getAdvisor,
  getAdvisorSensitive,
  listAdvisors,
  reviewAdvisorBankAccount,
  updateAdvisor,
  updateAdvisorStatus,
  upsertAdvisorBankAccount,
} from './advisor.service.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

const advisorOwner = async (req: Request) => stringParam(req, 'id');

const readAdvisor = [
  requireAnyPermission('advisors:read:self', 'advisors:read:any'),
  requireAdvisorOwnership({ resolveAdvisorId: advisorOwner, bypassPermissions: ['advisors:read:any'] }),
];

const updateOwnedAdvisor = [
  requireAnyPermission('advisors:update:self', 'advisors:update:any'),
  requireAdvisorOwnership({ resolveAdvisorId: advisorOwner, bypassPermissions: ['advisors:update:any'] }),
];

const readSensitiveAdvisor = [
  requireAnyPermission('advisors:sensitive:read:self', 'advisors:sensitive:read:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: advisorOwner,
    bypassPermissions: ['advisors:sensitive:read:any'],
  }),
];

function ownAdvisorId(req: Request) {
  if (!req.user?.advisorId) throw forbidden('An advisor profile is required');
  return req.user.advisorId;
}

export const advisorRouter = Router();
advisorRouter.use(authenticate);

advisorRouter.get('/me', requirePermission('advisors:read:self'), async (req, res) => {
  res.json({ data: await getAdvisor(ownAdvisorId(req)) });
});

advisorRouter.patch(
  '/me',
  requirePermission('advisors:update:self'),
  validate({ body: updateAdvisorSchema }),
  async (req, res) => {
    const result = await updateAdvisor(
      ownAdvisorId(req),
      updateAdvisorSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

advisorRouter.get('/me/bank-account', requirePermission('advisors:read:self'), async (req, res) => {
  const advisor = await getAdvisor(ownAdvisorId(req));
  res.json({ data: advisor.bankAccount });
});

advisorRouter.put(
  '/me/bank-account',
  requirePermission('advisors:update:self'),
  validate({ body: advisorBankAccountSchema }),
  async (req, res) => {
    const result = await upsertAdvisorBankAccount(
      ownAdvisorId(req),
      advisorBankAccountSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result.bankAccount });
  },
);

advisorRouter.get(
  '/me/sensitive',
  requirePermission('advisors:sensitive:read:self'),
  async (req, res) => {
    res.json({ data: await getAdvisorSensitive(ownAdvisorId(req), req.user!, auditContext(req)) });
  },
);

advisorRouter.get(
  '/',
  requirePermission('advisors:read:any'),
  validate({ query: advisorListQuerySchema }),
  async (req, res) => {
    const result = await listAdvisors(advisorListQuerySchema.parse(req.query));
    res.json({ data: result.items, pagination: result.pagination });
  },
);

advisorRouter.post(
  '/',
  requirePermission('advisors:create'),
  validate({ body: createAdvisorSchema }),
  async (req, res) => {
    const result = await createAdvisor(
      createAdvisorSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);

advisorRouter.get(
  '/:id',
  validate({ params: advisorIdParamsSchema }),
  ...readAdvisor,
  async (req, res) => res.json({ data: await getAdvisor(stringParam(req, 'id')) }),
);

advisorRouter.patch(
  '/:id',
  validate({ params: advisorIdParamsSchema, body: updateAdvisorSchema }),
  ...updateOwnedAdvisor,
  async (req, res) => {
    const result = await updateAdvisor(
      stringParam(req, 'id'),
      updateAdvisorSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

advisorRouter.patch(
  '/:id/status',
  validate({ params: advisorIdParamsSchema, body: advisorStatusSchema }),
  requirePermission('advisors:status:update'),
  async (req, res) => {
    const result = await updateAdvisorStatus(
      stringParam(req, 'id'),
      advisorStatusSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

advisorRouter.get(
  '/:id/bank-account',
  validate({ params: advisorIdParamsSchema }),
  ...readAdvisor,
  async (req, res) => {
    const advisor = await getAdvisor(stringParam(req, 'id'));
    res.json({ data: advisor.bankAccount });
  },
);

advisorRouter.put(
  '/:id/bank-account',
  validate({ params: advisorIdParamsSchema, body: advisorBankAccountSchema }),
  ...updateOwnedAdvisor,
  async (req, res) => {
    const result = await upsertAdvisorBankAccount(
      stringParam(req, 'id'),
      advisorBankAccountSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result.bankAccount });
  },
);

advisorRouter.patch(
  '/:id/bank-account/status',
  validate({ params: advisorIdParamsSchema, body: advisorBankReviewSchema }),
  requirePermission('advisors:bank:verify'),
  async (req, res) => {
    const result = await reviewAdvisorBankAccount(
      stringParam(req, 'id'),
      advisorBankReviewSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result.bankAccount });
  },
);

advisorRouter.get(
  '/:id/sensitive',
  validate({ params: advisorIdParamsSchema }),
  ...readSensitiveAdvisor,
  async (req, res) => {
    res.json({
      data: await getAdvisorSensitive(stringParam(req, 'id'), req.user!, auditContext(req)),
    });
  },
);
