import path from 'node:path';
import type { Request } from 'express';
import { Router } from 'express';
import { stringParam } from '../../common/request.js';
import { env } from '../../config/env.js';
import { forbidden } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  advisorReportQuerySchema,
  applicationReportQuerySchema,
  createExportJobSchema,
  dashboardQuerySchema,
  exportJobIdParamsSchema,
  exportJobListQuerySchema,
  lenderReportQuerySchema,
  payoutReportQuerySchema,
} from './report.schemas.js';
import {
  createExportJob,
  getAdvisorReport,
  getApplicationReport,
  getDashboard,
  getMonthlyComparisons,
  getExportJob,
  getExportJobForDownload,
  getLenderReport,
  getPayoutReport,
  listExportJobs,
} from './report.service.js';

function auditData(req: Request) {
  return {
    actorUserId: req.user!.id,
    requestId: String(req.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
  };
}

export const reportRouter = Router();
reportRouter.use(authenticate);

reportRouter.get('/monthly-comparisons', requireAnyPermission('reports:read:self', 'reports:read:any'), async (req, res) => {
  res.json({ data: await getMonthlyComparisons(req.user!) });
});

reportRouter.get('/dashboard/admin', requirePermission('reports:read:any'), validate({ query: dashboardQuerySchema }), async (req, res) => {
  res.json({ data: await getDashboard(dashboardQuerySchema.parse(req.query), req.user!) });
});

reportRouter.get('/dashboard/advisor', requireAnyPermission('reports:read:self', 'reports:read:any'), validate({ query: dashboardQuerySchema }), async (req, res) => {
  res.json({ data: await getDashboard(dashboardQuerySchema.parse(req.query), req.user!) });
});

reportRouter.get('/applications', requireAnyPermission('reports:read:self', 'reports:read:any'), validate({ query: applicationReportQuerySchema }), async (req, res) => {
  const result = await getApplicationReport(applicationReportQuerySchema.parse(req.query), req.user!);
  res.json({ data: result.items, pagination: result.pagination });
});

reportRouter.get('/advisors', requirePermission('reports:read:any'), validate({ query: advisorReportQuerySchema }), async (req, res) => {
  const result = await getAdvisorReport(advisorReportQuerySchema.parse(req.query), req.user!);
  res.json({ data: result.items, pagination: result.pagination });
});

reportRouter.get('/payouts', requireAnyPermission('reports:read:self', 'reports:read:any'), validate({ query: payoutReportQuerySchema }), async (req, res) => {
  const result = await getPayoutReport(payoutReportQuerySchema.parse(req.query), req.user!);
  res.json({ data: result.items, pagination: result.pagination });
});

reportRouter.get('/lenders', requirePermission('reports:read:any'), validate({ query: lenderReportQuerySchema }), async (req, res) => {
  const result = await getLenderReport(lenderReportQuerySchema.parse(req.query), req.user!);
  res.json({ data: result.items, pagination: result.pagination });
});

reportRouter.post('/exports', requirePermission('reports:export'), validate({ body: createExportJobSchema }), async (req, res) => {
  const job = await createExportJob(createExportJobSchema.parse(req.body), req.user!);
  await prisma.auditLog.create({
    data: { ...auditData(req), action: 'REPORT_EXPORT_QUEUED', entityType: 'export_job', entityId: job.id, metadata: { reportType: job.reportType, format: job.format } },
  });
  res.status(202).json({ data: job });
});

reportRouter.get('/exports', requirePermission('reports:export'), validate({ query: exportJobListQuerySchema }), async (req, res) => {
  const result = await listExportJobs(exportJobListQuerySchema.parse(req.query), req.user!);
  res.json({ data: result.items, pagination: result.pagination });
});

reportRouter.get('/exports/:id', requirePermission('reports:export'), validate({ params: exportJobIdParamsSchema }), async (req, res) => {
  res.json({ data: await getExportJob(stringParam(req, 'id'), req.user!) });
});

reportRouter.get('/exports/:id/download', requirePermission('reports:export'), validate({ params: exportJobIdParamsSchema }), async (req, res) => {
  const job = await getExportJobForDownload(stringParam(req, 'id'), req.user!);
  const root = path.resolve(env.EXPORT_STORAGE_PATH);
  const filePath = path.resolve(job.filePath!);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw forbidden('Export path is invalid');
  await prisma.auditLog.create({
    data: { ...auditData(req), action: 'REPORT_EXPORT_DOWNLOADED', entityType: 'export_job', entityId: job.id, metadata: { reportType: job.reportType, format: job.format } },
  });
  res.download(filePath, job.fileName!);
});
