import type { Request } from 'express';
import { Router } from 'express';
import { stringParam } from '../../common/request.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission, requireRole } from '../../middleware/authorize.js';
import { requireAdvisorOwnership } from '../../middleware/ownership.js';
import { requireStaffAssignment } from '../../middleware/staff-assignment.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  applicationActivityListQuerySchema,
  applicationRemarkListQuerySchema,
  applicationStatusHistoryListQuerySchema,
  applicationIdParamsSchema,
  applicationListQuerySchema,
  createApplicationActivitySchema,
  createApplicationRemarkSchema,
  staffWorkloadQuerySchema,
  updateApplicationAssignmentSchema,
  updateApplicationStatusSchema,
} from './application.schemas.js';
import {
  addApplicationActivity,
  addApplicationRemark,
  getApplication,
  getApplicationTimeline,
  listApplicationActivities,
  listApplicationRemarks,
  listApplications,
  listApplicationStatusHistory,
  listStaffWorkload,
  updateApplicationAssignment,
  updateApplicationStatus,
} from './application.service.js';

const auditContext = (req: Request): AuditContext => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

const applicationOwner = async (req: Request) =>
  (
    await prisma.application.findUnique({
      where: { id: stringParam(req, 'id') },
      select: { advisorId: true },
    })
  )?.advisorId ?? null;

const applicationAssignee = async (req: Request) =>
  (
    await prisma.application.findUnique({
      where: { id: stringParam(req, 'id') },
      select: { assignedStaffId: true },
    })
  )?.assignedStaffId ?? null;

const readApplication = [
  requireAnyPermission('applications:read:self', 'applications:read:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: applicationOwner,
    bypassPermissions: ['applications:read:any'],
  }),
  requireStaffAssignment({ resolveAssignedStaffId: applicationAssignee }),
];

const contributeToApplication = [
  requireAnyPermission('applications:activity:create', 'applications:remarks:create'),
  requireAdvisorOwnership({
    resolveAdvisorId: applicationOwner,
    bypassPermissions: ['applications:read:any'],
  }),
  requireStaffAssignment({ resolveAssignedStaffId: applicationAssignee }),
];

export const applicationRouter = Router();
applicationRouter.use(authenticate);

applicationRouter.get(
  '/workload',
  requirePermission('applications:workload:read'),
  validate({ query: staffWorkloadQuerySchema }),
  async (req, res) => {
    const result = await listStaffWorkload(staffWorkloadQuerySchema.parse(req.query));
    res.json({ data: result.items, pagination: result.pagination });
  },
);

applicationRouter.get(
  '/',
  requireAnyPermission('applications:read:self', 'applications:read:any'),
  validate({ query: applicationListQuerySchema }),
  async (req, res) => {
    const result = await listApplications(applicationListQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

applicationRouter.get(
  '/:id',
  validate({ params: applicationIdParamsSchema }),
  ...readApplication,
  async (req, res) => {
    res.json({ data: await getApplication(stringParam(req, 'id'), req.user!) });
  },
);

applicationRouter.patch(
  '/:id/status',
  validate({ params: applicationIdParamsSchema, body: updateApplicationStatusSchema }),
  requirePermission('applications:status:update'),
  requireStaffAssignment({ resolveAssignedStaffId: applicationAssignee }),
  async (req, res) => {
    const result = await updateApplicationStatus(
      stringParam(req, 'id'),
      updateApplicationStatusSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

applicationRouter.put(
  '/:id/assignment',
  validate({ params: applicationIdParamsSchema, body: updateApplicationAssignmentSchema }),
  requireRole('admin'),
  requirePermission('applications:assign'),
  async (req, res) => {
    const result = await updateApplicationAssignment(
      stringParam(req, 'id'),
      updateApplicationAssignmentSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

applicationRouter.get(
  '/:id/status-history',
  validate({ params: applicationIdParamsSchema, query: applicationStatusHistoryListQuerySchema }),
  ...readApplication,
  async (req, res) => {
    const result = await listApplicationStatusHistory(
      stringParam(req, 'id'),
      applicationStatusHistoryListQuerySchema.parse(req.query),
    );
    res.json({ data: result.items, pagination: result.pagination });
  },
);

applicationRouter.get(
  '/:id/timeline',
  validate({ params: applicationIdParamsSchema, query: applicationActivityListQuerySchema }),
  ...readApplication,
  async (req, res) => {
    const result = await getApplicationTimeline(
      stringParam(req, 'id'),
      applicationActivityListQuerySchema.parse(req.query),
      req.user!,
    );
    res.json({ data: result.items, pagination: result.pagination });
  },
);

applicationRouter.get(
  '/:id/activities',
  validate({ params: applicationIdParamsSchema, query: applicationActivityListQuerySchema }),
  ...readApplication,
  async (req, res) => {
    const result = await listApplicationActivities(
      stringParam(req, 'id'),
      applicationActivityListQuerySchema.parse(req.query),
      req.user!,
    );
    res.json({ data: result.items, pagination: result.pagination });
  },
);

applicationRouter.post(
  '/:id/activities',
  validate({ params: applicationIdParamsSchema, body: createApplicationActivitySchema }),
  ...contributeToApplication,
  async (req, res) => {
    const result = await addApplicationActivity(
      stringParam(req, 'id'),
      createApplicationActivitySchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);

applicationRouter.get(
  '/:id/remarks',
  validate({ params: applicationIdParamsSchema, query: applicationRemarkListQuerySchema }),
  ...readApplication,
  async (req, res) => {
    const result = await listApplicationRemarks(
      stringParam(req, 'id'),
      applicationRemarkListQuerySchema.parse(req.query),
      req.user!,
    );
    res.json({ data: result.items, pagination: result.pagination });
  },
);

applicationRouter.post(
  '/:id/remarks',
  validate({ params: applicationIdParamsSchema, body: createApplicationRemarkSchema }),
  ...contributeToApplication,
  async (req, res) => {
    const result = await addApplicationRemark(
      stringParam(req, 'id'),
      createApplicationRemarkSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);
