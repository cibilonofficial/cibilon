import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { TERMINAL_APPLICATION_STATUSES } from '../../common/domain.js';
import { AppError, conflict, notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import { scopedAdvisorId } from '../advisors/advisor-access.js';
import type { AuditContext } from '../audit/audit.service.js';
import type {
  ApplicationDocumentListQuery,
  CreateDocumentRequestInput,
  DocumentListQuery,
  DocumentVersionListQuery,
  UpdateDocumentStatusInput,
} from './document.schemas.js';
import { safeOriginalName, validateDocumentFile } from './file-validation.js';
import { malwareScanner } from './malware-scanner.js';
import { documentStorage } from './storage.js';

const requestInclude = {
  reviewedBy: { select: { id: true, name: true, email: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  application: {
    select: {
      id: true,
      applicationNumber: true,
      advisorId: true,
      status: true,
      customer: { select: { fullName: true } },
      advisor: { select: { code: true, user: { select: { id: true, name: true } } } },
    },
  },
  document: {
    include: {
      versions: {
        orderBy: { version: 'desc' as const },
        take: 1,
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      },
    },
  },
} satisfies Prisma.DocumentRequestInclude;

type DocumentRequestRecord = Prisma.DocumentRequestGetPayload<{ include: typeof requestInclude }>;

function serializeVersion(
  version: DocumentRequestRecord['document'] extends infer D
    ? D extends { versions: (infer V)[] }
      ? V
      : never
    : never,
) {
  const { storageKey: _storageKey, checksumSha256: _checksum, ...safe } = version;
  void _storageKey;
  void _checksum;
  return safe;
}

function serializeRequest(request: DocumentRequestRecord) {
  const latestVersion = request.document?.versions[0];
  return {
    id: request.id,
    applicationId: request.applicationId,
    documentType: request.documentType,
    displayName: request.displayName,
    required: request.required,
    status: request.status,
    rejectionReason: request.rejectionReason,
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    application: request.application,
    document: request.document
      ? {
          id: request.document.id,
          createdAt: request.document.createdAt,
          updatedAt: request.document.updatedAt,
          latestVersion: latestVersion ? serializeVersion(latestVersion) : null,
          downloadAvailable: Boolean(latestVersion),
        }
      : null,
  };
}

function auditData(user: RequestUser, context: AuditContext) {
  return {
    actorUserId: user.id,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

function documentRequestWhere(
  query: ApplicationDocumentListQuery | DocumentListQuery,
  advisorId?: string,
  staffId?: string,
): Prisma.DocumentRequestWhereInput {
  return {
    ...(advisorId ? { application: { advisorId } } : {}),
    ...(staffId ? { AND: [{ application: { assignedStaffId: staffId } }] } : {}),
    ...('applicationId' in query && query.applicationId
      ? { applicationId: query.applicationId }
      : {}),
    ...('advisorId' in query && query.advisorId && !advisorId
      ? { application: { advisorId: query.advisorId } }
      : {}),
    ...('documentType' in query && query.documentType
      ? { documentType: { equals: query.documentType, mode: 'insensitive' } }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.required === undefined ? {} : { required: query.required }),
    ...(query.uploaded === true ? { document: { isNot: null } } : {}),
    ...(query.uploaded === false ? { document: { is: null } } : {}),
    ...('malwareScanStatus' in query && query.malwareScanStatus
      ? { document: { versions: { some: { malwareScanStatus: query.malwareScanStatus } } } }
      : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          requestedAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { displayName: { contains: query.search, mode: 'insensitive' } },
            { documentType: { contains: query.search, mode: 'insensitive' } },
            { application: { applicationNumber: { contains: query.search, mode: 'insensitive' } } },
            { application: { customer: { fullName: { contains: query.search, mode: 'insensitive' } } } },
            { application: { advisor: { code: { contains: query.search, mode: 'insensitive' } } } },
            { application: { advisor: { user: { name: { contains: query.search, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  };
}

async function paginatedRequests(
  where: Prisma.DocumentRequestWhereInput,
  query: ApplicationDocumentListQuery | DocumentListQuery,
) {
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.documentRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.documentRequest.count({ where }),
  ]);
  return {
    items: items.map(serializeRequest),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function listApplicationDocuments(
  applicationId: string,
  query: ApplicationDocumentListQuery,
) {
  return paginatedRequests(
    { ...documentRequestWhere(query, undefined), applicationId },
    query,
  );
}

export async function listDocuments(query: DocumentListQuery, user: RequestUser) {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'documents:read:any');
  return paginatedRequests(documentRequestWhere(query, advisorId, user.roles.includes('admin') ? undefined : user.staffId ?? undefined), query);
}

export async function createDocumentRequest(
  applicationId: string,
  input: CreateDocumentRequestInput,
  user: RequestUser,
  context: AuditContext,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        include: { advisor: { select: { userId: true } } },
      });
      if (!application) throw notFound('Application not found');
      if (TERMINAL_APPLICATION_STATUSES.has(application.status)) {
        throw conflict('Documents cannot be requested for a terminal application');
      }
      const request = await tx.documentRequest.create({
        data: {
          applicationId,
          documentType: input.documentType,
          displayName: input.displayName,
          required: input.required,
          requestedByUserId: user.id,
        },
        include: requestInclude,
      });
      await tx.applicationActivity.create({
        data: {
          applicationId,
          createdByUserId: user.id,
          kind: 'DOCUMENT',
          note: input.remarks ?? `${input.displayName} requested`,
          metadata: { documentRequestId: request.id, action: 'REQUESTED' },
        },
      });
      await tx.notification.create({
        data: {
          recipientUserId: application.advisor.userId,
          type: 'DOCUMENT_ACTION',
          title: `${application.applicationNumber}: document requested`,
          body: input.remarks ?? `${input.displayName} is required for processing.`,
          applicationId,
        },
      });
      await tx.auditLog.create({
        data: {
          ...auditData(user, context),
          action: 'DOCUMENT_REQUESTED',
          entityType: 'document_request',
          entityId: request.id,
          metadata: { applicationId, documentType: input.documentType, required: input.required },
        },
      });
      return serializeRequest(request);
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('This document type is already requested for the application');
    }
    throw error;
  }
}

async function storeVersion(
  applicationId: string,
  documentRequestId: string,
  file: Express.Multer.File,
  user: RequestUser,
  context: AuditContext,
) {
  const request = await prisma.documentRequest.findUnique({
    where: { id: documentRequestId },
    include: {
      application: {
        include: {
          advisor: { select: { userId: true } },
          assignedStaff: { select: { userId: true } },
        },
      },
      document: { select: { id: true } },
    },
  });
  if (!request || request.applicationId !== applicationId) throw notFound('Document request not found');
  if (TERMINAL_APPLICATION_STATUSES.has(request.application.status)) {
    throw conflict('Documents cannot be uploaded to a terminal application');
  }

  const { mimeType, extension } = validateDocumentFile(file);
  const originalName = safeOriginalName(file.originalname);
  const scan = await malwareScanner.scan(file.buffer, originalName);
  if (scan.status === 'INFECTED') {
    throw new AppError(422, 'MALWARE_DETECTED', 'The document failed malware screening');
  }
  const candidateDocumentId = request.document?.id ?? randomUUID();
  const storageKey = `${applicationId}/${candidateDocumentId}/${randomUUID()}${extension}`;
  await documentStorage.put(storageKey, file.buffer, mimeType);

  try {
    const version = await prisma.$transaction(async (tx) => {
      const document = await tx.document.upsert({
        where: { documentRequestId },
        update: {},
        create: { id: candidateDocumentId, applicationId, documentRequestId },
      });
      const latest = await tx.documentVersion.aggregate({
        where: { documentId: document.id },
        _max: { version: true },
      });
      const created = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version: (latest._max.version ?? 0) + 1,
          storageKey,
          originalName,
          mimeType,
          sizeBytes: file.size,
          checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
          malwareScanStatus: scan.status,
          malwareScanDetails: scan.details,
          uploadedByUserId: user.id,
        },
      });
      await tx.documentRequest.update({
        where: { id: documentRequestId },
        data: {
          status: 'UPLOADED',
          rejectionReason: null,
          reviewedAt: null,
          reviewedByUserId: null,
        },
      });
      await tx.applicationActivity.create({
        data: {
          applicationId,
          createdByUserId: user.id,
          kind: 'DOCUMENT',
          note: `${request.displayName} version ${created.version} uploaded`,
          metadata: { documentId: document.id, documentVersionId: created.id, action: 'UPLOADED' },
        },
      });
      if (request.application.assignedStaff?.userId) {
        await tx.notification.create({
          data: {
            recipientUserId: request.application.assignedStaff.userId,
            type: 'DOCUMENT_ACTION',
            title: `${request.application.applicationNumber}: document uploaded`,
            body: `${request.displayName} is ready for verification.`,
            applicationId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          ...auditData(user, context),
          action: created.version === 1 ? 'DOCUMENT_UPLOADED' : 'DOCUMENT_REUPLOADED',
          entityType: 'document',
          entityId: document.id,
          metadata: {
            applicationId,
            documentRequestId,
            version: created.version,
            mimeType,
            sizeBytes: file.size,
            malwareScanStatus: scan.status,
          },
        },
      });
      return created;
    });
    return { documentId: version.documentId, versionId: version.id };
  } catch (error) {
    await documentStorage.delete(storageKey).catch(() => undefined);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('A concurrent document upload was detected; retry the upload');
    }
    throw error;
  }
}

export async function uploadInitialDocument(
  applicationId: string,
  documentRequestId: string,
  file: Express.Multer.File,
  user: RequestUser,
  context: AuditContext,
) {
  const stored = await storeVersion(applicationId, documentRequestId, file, user, context);
  return getDocument(stored.documentId);
}

export async function reuploadDocument(
  documentId: string,
  file: Express.Multer.File,
  user: RequestUser,
  context: AuditContext,
) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { applicationId: true, documentRequestId: true },
  });
  if (!document) throw notFound('Document not found');
  await storeVersion(
    document.applicationId,
    document.documentRequestId,
    file,
    user,
    context,
  );
  return getDocument(documentId);
}

export async function getDocument(documentId: string) {
  const request = await prisma.documentRequest.findFirst({
    where: { document: { id: documentId } },
    include: requestInclude,
  });
  if (!request) throw notFound('Document not found');
  return serializeRequest(request);
}

export async function updateDocumentStatus(
  documentId: string,
  input: UpdateDocumentStatusInput,
  user: RequestUser,
  context: AuditContext,
) {
  await prisma.$transaction(async (tx) => {
    const document = await tx.document.findUnique({
      where: { id: documentId },
      include: {
        request: { include: { application: { include: { advisor: { select: { userId: true } } } } } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!document) throw notFound('Document not found');
    const latest = document.versions[0];
    if (!latest) throw conflict('A document must be uploaded before review');
    if (document.request.status === input.status) throw conflict(`Document is already ${input.status}`);
    if (input.status === 'VERIFIED' && latest.malwareScanStatus === 'INFECTED') {
      throw conflict('An infected document cannot be verified');
    }
    const changed = await tx.documentRequest.updateMany({
      where: { id: document.documentRequestId, status: document.request.status },
      data: {
        status: input.status,
        rejectionReason: input.status === 'REJECTED' ? input.reason : null,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw conflict('Document status changed concurrently; retry');
    const action = input.status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';
    await tx.applicationActivity.create({
      data: {
        applicationId: document.applicationId,
        createdByUserId: user.id,
        kind: 'DOCUMENT',
        note:
          input.status === 'VERIFIED'
            ? `${document.request.displayName} verified`
            : `${document.request.displayName} rejected: ${input.reason}`,
        metadata: { documentId, documentVersionId: latest.id, action },
      },
    });
    await tx.notification.create({
      data: {
        recipientUserId: document.request.application.advisor.userId,
        type: 'DOCUMENT_ACTION',
        title: `${document.request.application.applicationNumber}: document ${action.toLowerCase()}`,
        body:
          input.status === 'VERIFIED'
            ? `${document.request.displayName} was verified.`
            : input.reason!,
        applicationId: document.applicationId,
      },
    });
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: `DOCUMENT_${action}`,
        entityType: 'document',
        entityId: documentId,
        metadata: {
          applicationId: document.applicationId,
          documentVersionId: latest.id,
          previousStatus: document.request.status,
          status: input.status,
        },
      },
    });
  });
  return getDocument(documentId);
}

export async function listDocumentVersions(documentId: string, query: DocumentVersionListQuery) {
  const where: Prisma.DocumentVersionWhereInput = {
    documentId,
    ...(query.malwareScanStatus ? { malwareScanStatus: query.malwareScanStatus } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          uploadedAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.documentVersion.findMany({
      where,
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { version: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.documentVersion.count({ where }),
  ]);
  return {
    items: items.map(serializeVersion),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function getDocumentDownload(
  documentId: string,
  versionId: string | undefined,
  user: RequestUser,
  context: AuditContext,
) {
  const version = await prisma.documentVersion.findFirst({
    where: { documentId, ...(versionId ? { id: versionId } : {}) },
    orderBy: { version: 'desc' },
    include: { document: { select: { applicationId: true } } },
  });
  if (!version) throw notFound('Document version not found');
  let target;
  try {
    target = await documentStorage.downloadTarget(
      version.storageKey,
      version.originalName,
      version.mimeType,
    );
  } catch {
    throw notFound('Stored document content is unavailable');
  }
  await prisma.auditLog.create({
    data: {
      ...auditData(user, context),
      action: 'DOCUMENT_DOWNLOADED',
      entityType: 'document',
      entityId: documentId,
      metadata: {
        applicationId: version.document.applicationId,
        documentVersionId: version.id,
        version: version.version,
      },
    },
  });
  return { target, fileName: version.originalName, mimeType: version.mimeType };
}
