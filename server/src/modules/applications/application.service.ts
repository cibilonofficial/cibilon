import type { ApplicationStatus, Prisma } from '../../../generated/prisma/client.js';
import {
  APPLICATION_STATUS_TRANSITIONS,
  TERMINAL_APPLICATION_STATUSES,
} from '../../common/domain.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import type { AuditContext } from '../audit/audit.service.js';
import { scopedAdvisorId } from '../advisors/advisor-access.js';
import { serializeCustomer } from '../customers/customer.service.js';
import { createPayoutForApproval, createPayoutForDisbursement, estimateApplicationPayouts } from '../payouts/payout.service.js';
import type {
  ApplicationActivityListQuery,
  ApplicationRemarkListQuery,
  ApplicationStatusHistoryListQuery,
  ApplicationListQuery,
  CreateApplicationActivityInput,
  CreateApplicationRemarkInput,
  StaffWorkloadQuery,
  UpdateApplicationAssignmentInput,
  UpdateApplicationStatusInput,
} from './application.schemas.js';

const applicationSummaryInclude = {
  customer: true,
  advisor: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  assignedStaff: {
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
  },
  documentRequests: { select: { required: true, status: true } },
  lender: { select: { id: true, name: true, type: true, status: true } },
  payout: {
    select: {
      id: true,
      payoutNumber: true,
      payoutAmount: true,
      status: true,
      commissionRuleId: true,
      commissionVersion: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ApplicationInclude;

type ApplicationSummary = Prisma.ApplicationGetPayload<{
  include: typeof applicationSummaryInclude;
}>;

function serializeApplication(application: ApplicationSummary) {
  const requiredDocuments = application.documentRequests.filter((item) => item.required);
  return {
    ...application,
    requestedAmount: application.requestedAmount?.toString() ?? null,
    disbursedAmount: application.disbursedAmount?.toString() ?? null,
    payout: application.payout
      ? { ...application.payout, payoutAmount: application.payout.payoutAmount.toString() }
      : null,
    customer: serializeCustomer(application.customer),
    assignedStaff: application.assignedStaff
      ? {
          id: application.assignedStaff.id,
          code: application.assignedStaff.code,
          department: application.assignedStaff.department,
          user: application.assignedStaff.user,
        }
      : null,
    documentProgress: {
      total: application.documentRequests.length,
      required: requiredDocuments.length,
      verifiedRequired: requiredDocuments.filter((item) => item.status === 'VERIFIED').length,
    },
    documentRequests: undefined,
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

function activityVisibility(user: RequestUser): Prisma.ApplicationActivityWhereInput {
  return user.permissions.includes('applications:read:any') ? {} : { internal: false };
}

export async function listApplications(query: ApplicationListQuery, user: RequestUser) {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'applications:read:any');
  const where: Prisma.ApplicationWhereInput = {
    ...(advisorId ? { advisorId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(user.staffId && !user.roles.includes('admin')
      ? { assignedStaffId: user.staffId }
      : {
          ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
          ...(query.unassigned === true ? { assignedStaffId: null } : {}),
          ...(query.unassigned === false ? { assignedStaffId: { not: null } } : {}),
        }),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { applicationNumber: { contains: query.search, mode: 'insensitive' } },
            { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
            { customer: { email: { contains: query.search, mode: 'insensitive' } } },
            { customer: { mobile: { contains: query.search } } },
            { advisor: { code: { contains: query.search, mode: 'insensitive' } } },
            { advisor: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
            { assignedStaff: { code: { contains: query.search, mode: 'insensitive' } } },
            { assignedStaff: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      include: applicationSummaryInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  const estimates = await estimateApplicationPayouts(items);
  return {
    items: items.map((item) => ({ ...serializeApplication(item), estimatedPayout: estimates.get(item.id) ?? null })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getApplication(id: string, user: RequestUser) {
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      ...applicationSummaryInclude,
      lead: { select: { id: true, source: true, notes: true, nextFollowUpAt: true } },
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      assignments: {
        include: {
          staff: { include: { user: { select: { id: true, name: true, email: true } } } },
          assignedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { assignedAt: 'asc' },
      },
      remarks: {
        where: user.permissions.includes('applications:read:any') ? {} : { internal: false },
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!application) throw notFound('Application not found');
  if (user.staffId && !user.roles.includes('admin') && application.assignedStaffId !== user.staffId) {
    throw forbidden('This application is not assigned to you');
  }
  const estimates = await estimateApplicationPayouts([application]);
  return {
    ...serializeApplication(application),
    estimatedPayout: estimates.get(application.id) ?? null,
    lead: application.lead,
    statusHistory: application.statusHistory,
    assignments: application.assignments.map((assignment) => ({
      ...assignment,
      note: user.permissions.includes('applications:read:any') ? assignment.note : undefined,
    })),
    remarks: application.remarks,
  };
}

export async function updateApplicationStatus(
  id: string,
  input: UpdateApplicationStatusInput,
  user: RequestUser,
  context: AuditContext,
) {
  if (input.status === 'DRAFT') {
    throw badRequest('Converted applications cannot return to draft status');
  }
  await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id },
      include: { advisor: { select: { userId: true } } },
    });
    if (!application) throw notFound('Application not found');
    if (application.status === input.status) throw conflict('Application already has this status');

    const allowed = APPLICATION_STATUS_TRANSITIONS[application.status];
    if (!allowed.includes(input.status)) {
      throw conflict(
        `Invalid application status transition from ${application.status} to ${input.status}`,
      );
    }

    const disbursedAt = input.status === 'DISBURSED' ? new Date() : null;
    if (input.status === 'DISBURSED' && (!input.lenderId || input.disbursedAmount === undefined)) {
      throw badRequest('Lender and actual disbursed amount are required for disbursal');
    }
    if (input.status === 'APPROVED' && !input.lenderId) {
      throw badRequest('Lender is required to calculate the approved payout');
    }

    const updated = await tx.application.updateMany({
      where: { id, status: application.status },
      data: {
        status: input.status,
        ...(input.status === 'DISBURSED'
          ? { lenderId: input.lenderId, disbursedAmount: input.disbursedAmount, disbursedAt }
          : input.status === 'APPROVED'
            ? { lenderId: input.lenderId }
          : {}),
      },
    });
    if (updated.count !== 1) throw conflict('Application status changed concurrently; retry');

    const payout = input.status === 'APPROVED'
      ? await createPayoutForApproval(
          tx,
          application,
          input.lenderId!,
          user.id,
          new Date(),
        )
      : input.status === 'DISBURSED'
        ? await createPayoutForDisbursement(
          tx,
          application,
          input.lenderId!,
          input.disbursedAmount!,
          user.id,
          disbursedAt!,
          )
        : null;

    await tx.applicationStatusHistory.create({
      data: {
        applicationId: id,
        fromStatus: application.status,
        toStatus: input.status,
        remarks: input.remarks,
        changedByUserId: user.id,
      },
    });
    await tx.applicationActivity.create({
      data: {
        applicationId: id,
        createdByUserId: user.id,
        kind: 'STATUS_CHANGE',
        note: input.remarks ?? `Status changed from ${application.status} to ${input.status}`,
        metadata: { fromStatus: application.status, toStatus: input.status },
      },
    });
    await tx.notification.create({
      data: {
        recipientUserId: application.advisor.userId,
        type: 'STATUS_CHANGED',
        title: `${application.applicationNumber} status updated`,
        body: `Status changed from ${application.status} to ${input.status}${input.remarks ? `: ${input.remarks}` : ''}`,
        applicationId: id,
      },
    });
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: 'APPLICATION_STATUS_CHANGED',
        entityType: 'application',
        entityId: id,
        metadata: {
          applicationNumber: application.applicationNumber,
          fromStatus: application.status,
          toStatus: input.status,
          payoutId: payout?.id ?? null,
        },
      },
    });
  });

  return getApplication(id, user);
}

export async function updateApplicationAssignment(
  id: string,
  input: UpdateApplicationAssignmentInput,
  user: RequestUser,
  context: AuditContext,
) {
  await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id },
      include: { advisor: { select: { userId: true } } },
    });
    if (!application) throw notFound('Application not found');
    if (TERMINAL_APPLICATION_STATUSES.has(application.status)) {
      throw conflict('Terminal applications cannot be reassigned');
    }
    if (application.assignedStaffId === input.staffId) {
      throw conflict(input.staffId ? 'Application is already assigned to this staff member' : 'Application is already unassigned');
    }

    const staff = input.staffId
      ? await tx.staff.findUnique({
          where: { id: input.staffId },
          include: { user: { select: { id: true, name: true, status: true } } },
        })
      : null;
    if (input.staffId && !staff) throw notFound('Staff member not found');
    if (staff && staff.user.status !== 'ACTIVE') {
      throw conflict('Applications can only be assigned to active staff');
    }

    const now = new Date();
    const changed = await tx.application.updateMany({
      where: { id, assignedStaffId: application.assignedStaffId },
      data: { assignedStaffId: input.staffId, assignedAt: input.staffId ? now : null },
    });
    if (changed.count !== 1) throw conflict('Application assignment changed concurrently; retry');

    await tx.applicationAssignment.updateMany({
      where: { applicationId: id, unassignedAt: null },
      data: { unassignedAt: now },
    });
    if (staff) {
      await tx.applicationAssignment.create({
        data: {
          applicationId: id,
          staffId: staff.id,
          assignedByUserId: user.id,
          note: input.note,
          assignedAt: now,
        },
      });
    }

    const assignmentLabel = staff ? `Assigned to ${staff.user.name}` : 'Assignment cleared';
    await tx.applicationActivity.create({
      data: {
        applicationId: id,
        createdByUserId: user.id,
        kind: 'ASSIGNMENT',
        note: input.note ? `${assignmentLabel}: ${input.note}` : assignmentLabel,
        internal: true,
        metadata: {
          previousStaffId: application.assignedStaffId,
          assignedStaffId: input.staffId,
        },
      },
    });

    const notifications: Prisma.NotificationCreateManyInput[] = [
      {
        recipientUserId: application.advisor.userId,
        type: 'APPLICATION_ASSIGNED',
        title: `${application.applicationNumber} assignment updated`,
        body: assignmentLabel,
        applicationId: id,
      },
    ];
    if (staff && staff.user.id !== application.advisor.userId) {
      notifications.push({
        recipientUserId: staff.user.id,
        type: 'APPLICATION_ASSIGNED',
        title: `${application.applicationNumber} assigned to you`,
        body: input.note ?? 'A new application is ready for processing.',
        applicationId: id,
      });
    }
    await tx.notification.createMany({ data: notifications });
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: staff ? 'APPLICATION_ASSIGNED' : 'APPLICATION_UNASSIGNED',
        entityType: 'application',
        entityId: id,
        metadata: {
          applicationNumber: application.applicationNumber,
          previousStaffId: application.assignedStaffId,
          assignedStaffId: input.staffId,
        },
      },
    });
  });

  return getApplication(id, user);
}

export async function listApplicationRemarks(
  applicationId: string,
  query: ApplicationRemarkListQuery,
  user: RequestUser,
) {
  const where: Prisma.ApplicationRemarkWhereInput = {
    applicationId,
    ...(user.permissions.includes('applications:read:any')
      ? query.internal === undefined
        ? {}
        : { internal: query.internal }
      : { internal: false }),
    ...(query.search ? { body: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.applicationRemark.findMany({
      where,
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.applicationRemark.count({ where }),
  ]);
  return {
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function addApplicationRemark(
  applicationId: string,
  input: CreateApplicationRemarkInput,
  user: RequestUser,
  context: AuditContext,
) {
  const internal = user.permissions.includes('applications:read:any') ? input.internal : false;
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      select: { id: true, applicationNumber: true },
    });
    if (!application) throw notFound('Application not found');
    const remark = await tx.applicationRemark.create({
      data: { applicationId, authorUserId: user.id, body: input.body, internal },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    await tx.applicationActivity.create({
      data: {
        applicationId,
        createdByUserId: user.id,
        kind: 'REMARK',
        note: input.body,
        internal,
        metadata: { remarkId: remark.id },
      },
    });
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: 'APPLICATION_REMARK_ADDED',
        entityType: 'application',
        entityId: applicationId,
        metadata: { applicationNumber: application.applicationNumber, remarkId: remark.id, internal },
      },
    });
    return remark;
  });
}

export async function listApplicationActivities(
  applicationId: string,
  query: ApplicationActivityListQuery,
  user: RequestUser,
) {
  const where: Prisma.ApplicationActivityWhereInput = {
    applicationId,
    ...activityVisibility(user),
    ...(user.permissions.includes('applications:read:any') && query.internal !== undefined
      ? { internal: query.internal }
      : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.search ? { note: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.applicationActivity.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.applicationActivity.count({ where }),
  ]);
  return {
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function addApplicationActivity(
  applicationId: string,
  input: CreateApplicationActivityInput,
  user: RequestUser,
  context: AuditContext,
) {
  const internal = user.permissions.includes('applications:read:any') ? input.internal : false;
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      select: { id: true, applicationNumber: true },
    });
    if (!application) throw notFound('Application not found');
    const activity = await tx.applicationActivity.create({
      data: {
        applicationId,
        createdByUserId: user.id,
        kind: input.kind,
        note: input.note,
        internal,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: 'APPLICATION_ACTIVITY_ADDED',
        entityType: 'application',
        entityId: applicationId,
        metadata: { applicationNumber: application.applicationNumber, activityId: activity.id, kind: input.kind, internal },
      },
    });
    return activity;
  });
}

export async function getApplicationTimeline(
  applicationId: string,
  query: ApplicationActivityListQuery,
  user: RequestUser,
) {
  return listApplicationActivities(applicationId, { ...query, sortOrder: query.sortOrder }, user);
}

export async function listApplicationStatusHistory(
  applicationId: string,
  query: ApplicationStatusHistoryListQuery,
) {
  const where: Prisma.ApplicationStatusHistoryWhereInput = {
    applicationId,
    ...(query.fromStatus ? { fromStatus: query.fromStatus } : {}),
    ...(query.toStatus ? { toStatus: query.toStatus } : {}),
    ...(query.search
      ? { remarks: { contains: query.search, mode: 'insensitive' } }
      : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.applicationStatusHistory.findMany({
      where,
      include: { changedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.applicationStatusHistory.count({ where }),
  ]);
  return {
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function listStaffWorkload(query: StaffWorkloadQuery) {
  const staff = await prisma.staff.findMany({
    where: {
      ...(query.department
        ? { department: { equals: query.department, mode: 'insensitive' } }
        : {}),
      user: {
        ...(query.status ? { status: query.status } : {}),
      },
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { department: { contains: query.search, mode: 'insensitive' } },
              { user: { name: { contains: query.search, mode: 'insensitive' } } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
          : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
  });
  const staffIds = staff.map((member) => member.id);
  const [currentGroups, historicalGroups] = staffIds.length
    ? await Promise.all([
        prisma.application.groupBy({
          by: ['assignedStaffId', 'status'],
          where: { assignedStaffId: { in: staffIds } },
          _count: { _all: true },
        }),
        prisma.applicationAssignment.groupBy({
          by: ['staffId'],
          where: { staffId: { in: staffIds } },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const rows = staff.map((member) => {
    const current = currentGroups.filter((group) => group.assignedStaffId === member.id);
    return {
      id: member.id,
      code: member.code,
      department: member.department,
      user: member.user,
      openApplications: current
        .filter((group) => !TERMINAL_APPLICATION_STATUSES.has(group.status))
        .reduce((sum, group) => sum + group._count._all, 0),
      currentApplications: current.reduce((sum, group) => sum + group._count._all, 0),
      totalAssignments:
        historicalGroups.find((group) => group.staffId === member.id)?._count._all ?? 0,
      statusBreakdown: Object.fromEntries(
        current.map((group) => [group.status, group._count._all]),
      ) as Partial<Record<ApplicationStatus, number>>,
    };
  });

  const direction = query.sortOrder === 'asc' ? 1 : -1;
  rows.sort((left, right) => {
    if (query.sortBy === 'name') return left.user.name.localeCompare(right.user.name) * direction;
    const leftValue = query.sortBy === 'openApplications' ? left.openApplications : left.totalAssignments;
    const rightValue = query.sortBy === 'openApplications' ? right.openApplications : right.totalAssignments;
    return (leftValue - rightValue) * direction || left.user.name.localeCompare(right.user.name);
  });
  const total = rows.length;
  const start = (query.page - 1) * query.pageSize;
  return {
    items: rows.slice(start, start + query.pageSize),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}
