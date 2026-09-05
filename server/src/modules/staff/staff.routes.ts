import type { Request } from 'express';
import { Router } from 'express';
import { forbidden } from '../../common/errors.js';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  createStaffSchema,
  staffIdParamsSchema,
  staffListQuerySchema,
  staffPermissionsSchema,
  staffStatusSchema,
  updateStaffSchema,
} from './staff.schemas.js';
import {
  createStaff,
  getStaff,
  listPermissionCatalog,
  listStaff,
  replaceStaffPermissions,
  updateStaff,
  updateStaffStatus,
} from './staff.service.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

export const staffRouter = Router();
staffRouter.use(authenticate);

staffRouter.get('/me', async (req, res) => {
  if (!req.user?.staffId) throw forbidden('A staff profile is required');
  res.json({ data: await getStaff(req.user.staffId) });
});

staffRouter.get('/permissions/catalog', requirePermission('staff:read:any'), async (_req, res) => {
  res.json({ data: await listPermissionCatalog() });
});

staffRouter.get(
  '/',
  requirePermission('staff:read:any'),
  validate({ query: staffListQuerySchema }),
  async (req, res) => {
    const result = await listStaff(staffListQuerySchema.parse(req.query));
    res.json({ data: result.items, pagination: result.pagination });
  },
);

staffRouter.post(
  '/',
  requireRole('admin'),
  requirePermission('staff:manage'),
  validate({ body: createStaffSchema }),
  async (req, res) => {
    const result = await createStaff(createStaffSchema.parse(req.body), req.user!, auditContext(req));
    res.status(201).json({ data: result });
  },
);

staffRouter.get(
  '/:id',
  requirePermission('staff:read:any'),
  validate({ params: staffIdParamsSchema }),
  async (req, res) => res.json({ data: await getStaff(stringParam(req, 'id')) }),
);

staffRouter.patch(
  '/:id',
  requireRole('admin'),
  requirePermission('staff:manage'),
  validate({ params: staffIdParamsSchema, body: updateStaffSchema }),
  async (req, res) => {
    const result = await updateStaff(
      stringParam(req, 'id'), updateStaffSchema.parse(req.body), req.user!, auditContext(req),
    );
    res.json({ data: result });
  },
);

staffRouter.patch(
  '/:id/status',
  requireRole('admin'),
  requirePermission('staff:manage'),
  validate({ params: staffIdParamsSchema, body: staffStatusSchema }),
  async (req, res) => {
    const result = await updateStaffStatus(
      stringParam(req, 'id'), staffStatusSchema.parse(req.body), req.user!, auditContext(req),
    );
    res.json({ data: result });
  },
);

staffRouter.put(
  '/:id/permissions',
  requireRole('admin'),
  requirePermission('staff:manage'),
  validate({ params: staffIdParamsSchema, body: staffPermissionsSchema }),
  async (req, res) => {
    const input = staffPermissionsSchema.parse(req.body);
    const result = await replaceStaffPermissions(
      stringParam(req, 'id'), input.permissionCodes, req.user!, auditContext(req),
    );
    res.json({ data: result });
  },
);
