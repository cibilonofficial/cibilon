import type { Request, Response } from 'express';
import { Router } from 'express';
import { AppError } from '../../common/errors.js';
import { stringParam } from '../../common/request.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middleware/authorize.js';
import { requireAdvisorOwnership } from '../../middleware/ownership.js';
import { requireStaffAssignment } from '../../middleware/staff-assignment.js';
import { validate } from '../../middleware/validate.js';
import type { AuditContext } from '../audit/audit.service.js';
import {
  applicationDocumentListQuerySchema,
  applicationIdParamsSchema,
  createDocumentRequestSchema,
  documentIdParamsSchema,
  documentListQuerySchema,
  documentVersionListQuerySchema,
  documentVersionParamsSchema,
  initialUploadBodySchema,
  updateDocumentStatusSchema,
} from './document.schemas.js';
import {
  createDocumentRequest,
  getDocument,
  getDocumentDownload,
  listApplicationDocuments,
  listDocuments,
  listDocumentVersions,
  reuploadDocument,
  updateDocumentStatus,
  uploadInitialDocument,
} from './document.service.js';
import { documentUpload } from './document-upload.js';

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

const documentOwner = async (req: Request) =>
  (
    await prisma.document.findUnique({
      where: { id: stringParam(req, 'id') },
      select: { application: { select: { advisorId: true } } },
    })
  )?.application.advisorId ?? null;

const documentAssignee = async (req: Request) =>
  (
    await prisma.document.findUnique({
      where: { id: stringParam(req, 'id') },
      select: { application: { select: { assignedStaffId: true } } },
    })
  )?.application.assignedStaffId ?? null;

const readApplicationDocuments = [
  requireAnyPermission('documents:read:self', 'documents:read:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: applicationOwner,
    bypassPermissions: ['documents:read:any'],
  }),
  requireStaffAssignment({ resolveAssignedStaffId: applicationAssignee }),
];

const uploadApplicationDocument = [
  requireAnyPermission('documents:upload:self', 'documents:upload:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: applicationOwner,
    bypassPermissions: ['documents:upload:any'],
  }),
  requireStaffAssignment({ resolveAssignedStaffId: applicationAssignee }),
];

const readDocument = [
  requireAnyPermission('documents:read:self', 'documents:read:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: documentOwner,
    bypassPermissions: ['documents:read:any'],
  }),
  requireStaffAssignment({ resolveAssignedStaffId: documentAssignee }),
];

const uploadDocumentVersion = [
  requireAnyPermission('documents:upload:self', 'documents:upload:any'),
  requireAdvisorOwnership({
    resolveAdvisorId: documentOwner,
    bypassPermissions: ['documents:upload:any'],
  }),
  requireStaffAssignment({ resolveAssignedStaffId: documentAssignee }),
];

function requireFile(req: Request) {
  if (!req.file) throw new AppError(422, 'DOCUMENT_FILE_REQUIRED', 'A document file is required');
  return req.file;
}

async function sendDownload(
  req: Request,
  res: Response,
  versionId?: string,
) {
  const download = await getDocumentDownload(
    stringParam(req, 'id'),
    versionId,
    req.user!,
    auditContext(req),
  );
  if (download.target.kind === 'signed-url') {
    res.json({
      data: {
        url: download.target.url,
        expiresIn: download.target.expiresIn,
        fileName: download.fileName,
      },
    });
    return;
  }
  const safeName = download.fileName.replace(/[^\x20-\x7e]|[\r\n"]/g, '_');
  const encodedName = encodeURIComponent(download.fileName).replace(/['()*]/g, (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`);
  res.set({
    'Content-Type': download.mimeType,
    'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'private, no-store',
  });
  res.send(download.target.body);
}

export const applicationDocumentRouter = Router();
applicationDocumentRouter.use(authenticate);

applicationDocumentRouter.get(
  '/:id/documents',
  validate({ params: applicationIdParamsSchema, query: applicationDocumentListQuerySchema }),
  ...readApplicationDocuments,
  async (req, res) => {
    const result = await listApplicationDocuments(
      stringParam(req, 'id'),
      applicationDocumentListQuerySchema.parse(req.query),
    );
    res.json({ data: result.items, pagination: result.pagination });
  },
);

applicationDocumentRouter.post(
  '/:id/document-requests',
  validate({ params: applicationIdParamsSchema, body: createDocumentRequestSchema }),
  requirePermission('documents:request'),
  requireStaffAssignment({ resolveAssignedStaffId: applicationAssignee }),
  async (req, res) => {
    const result = await createDocumentRequest(
      stringParam(req, 'id'),
      createDocumentRequestSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);

applicationDocumentRouter.post(
  '/:id/documents',
  validate({ params: applicationIdParamsSchema }),
  ...uploadApplicationDocument,
  documentUpload.single('file'),
  validate({ body: initialUploadBodySchema }),
  async (req, res) => {
    const result = await uploadInitialDocument(
      stringParam(req, 'id'),
      initialUploadBodySchema.parse(req.body).documentRequestId,
      requireFile(req),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);

export const documentRouter = Router();
documentRouter.use(authenticate);

documentRouter.get(
  '/',
  requireAnyPermission('documents:read:self', 'documents:read:any'),
  validate({ query: documentListQuerySchema }),
  async (req, res) => {
    const result = await listDocuments(documentListQuerySchema.parse(req.query), req.user!);
    res.json({ data: result.items, pagination: result.pagination });
  },
);

documentRouter.get(
  '/:id',
  validate({ params: documentIdParamsSchema }),
  ...readDocument,
  async (req, res) => {
    res.json({ data: await getDocument(stringParam(req, 'id')) });
  },
);

documentRouter.patch(
  '/:id/status',
  validate({ params: documentIdParamsSchema, body: updateDocumentStatusSchema }),
  requirePermission('documents:verify'),
  requireStaffAssignment({ resolveAssignedStaffId: documentAssignee }),
  async (req, res) => {
    const result = await updateDocumentStatus(
      stringParam(req, 'id'),
      updateDocumentStatusSchema.parse(req.body),
      req.user!,
      auditContext(req),
    );
    res.json({ data: result });
  },
);

documentRouter.get(
  '/:id/versions',
  validate({ params: documentIdParamsSchema, query: documentVersionListQuerySchema }),
  ...readDocument,
  async (req, res) => {
    const result = await listDocumentVersions(
      stringParam(req, 'id'),
      documentVersionListQuerySchema.parse(req.query),
    );
    res.json({ data: result.items, pagination: result.pagination });
  },
);

documentRouter.post(
  '/:id/versions',
  validate({ params: documentIdParamsSchema }),
  ...uploadDocumentVersion,
  documentUpload.single('file'),
  async (req, res) => {
    const result = await reuploadDocument(
      stringParam(req, 'id'),
      requireFile(req),
      req.user!,
      auditContext(req),
    );
    res.status(201).json({ data: result });
  },
);

documentRouter.get(
  '/:id/download',
  validate({ params: documentIdParamsSchema }),
  ...readDocument,
  async (req, res) => {
    await sendDownload(req, res);
  },
);

documentRouter.get(
  '/:id/versions/:versionId/download',
  validate({ params: documentVersionParamsSchema }),
  ...readDocument,
  async (req, res) => {
    await sendDownload(req, res, stringParam(req, 'versionId'));
  },
);
