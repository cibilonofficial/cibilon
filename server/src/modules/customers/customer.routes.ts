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
  archiveCustomer,
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from './customer.service.js';
import {
  createCustomerSchema,
  customerIdParamsSchema,
  customerListQuerySchema,
  updateCustomerSchema,
} from './customer.schemas.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

const customerOwner = async (req: Request) =>
  (
    await prisma.customer.findUnique({
      where: { id: stringParam(req, 'id') },
      select: { advisorId: true },
    })
  )?.advisorId ?? null;

export const customerRouter = Router();
customerRouter.use(authenticate);

customerRouter.get(
  '/',
  requireAnyPermission('customers:read:self', 'customers:read:any'),
  validate({ query: customerListQuerySchema }),
  async (req, res) => {
    const result = await listCustomers(customerListQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

customerRouter.post(
  '/',
  requirePermission('customers:create'),
  validate({ body: createCustomerSchema }),
  async (req, res) => {
    const result = await createCustomer(
      createCustomerSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);

customerRouter.get(
  '/:id',
  requireAnyPermission('customers:read:self', 'customers:read:any'),
  validate({ params: customerIdParamsSchema }),
  requireAdvisorOwnership({
    resolveAdvisorId: customerOwner,
    bypassPermissions: ['customers:read:any'],
  }),
  async (req, res) => {
    res.json({ data: await getCustomer(stringParam(req, 'id')) });
  },
);

customerRouter.patch(
  '/:id',
  requireAnyPermission('customers:update:self', 'customers:update:any'),
  validate({ params: customerIdParamsSchema, body: updateCustomerSchema }),
  requireAdvisorOwnership({
    resolveAdvisorId: customerOwner,
    bypassPermissions: ['customers:update:any'],
  }),
  async (req, res) => {
    const result = await updateCustomer(
      stringParam(req, 'id'),
      updateCustomerSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

customerRouter.delete(
  '/:id',
  requireAnyPermission('customers:update:self', 'customers:update:any'),
  validate({ params: customerIdParamsSchema }),
  requireAdvisorOwnership({
    resolveAdvisorId: customerOwner,
    bypassPermissions: ['customers:update:any'],
  }),
  async (req, res) => {
    await archiveCustomer(stringParam(req, 'id'), req.user!, auditContext(req));
    res.status(204).send();
  },
);
