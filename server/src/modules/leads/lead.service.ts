import type { Prisma } from '../../../generated/prisma/client.js';
import { AppError, conflict, notFound } from '../../common/errors.js';
import { DOCUMENT_CHECKLISTS, LOAN_SERVICE_TYPES } from '../../common/domain.js';
import { prisma } from '../../lib/prisma.js';
import { encryptSensitive, lastFour, maskedLastFour } from '../../lib/sensitive-data.js';
import type { RequestUser } from '../../types/express.js';
import { resolveAdvisorForWrite, scopedAdvisorId } from '../advisors/advisor-access.js';
import type { AuditContext } from '../audit/audit.service.js';
import { customerData, serializeCustomer } from '../customers/customer.service.js';
import type { CustomerDraftInput } from '../customers/customer.schemas.js';
import type {
  ActivityListQuery,
  CreateActivityInput,
  CreateDraftLeadInput,
  CreateLeadInput,
  LeadListQuery,
  UpdateLeadInput,
} from './lead.schemas.js';

const leadInclude = {
  customer: true,
  advisor: { include: { user: { select: { id: true, name: true, email: true } } } },
  application: { select: { id: true, applicationNumber: true, status: true } },
} satisfies Prisma.LeadInclude;

type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function employmentData(input: CreateDraftLeadInput['employment'] | UpdateLeadInput['employment']) {
  if (!input) return {};
  const { accountNumber, ...safe } = input;
  return {
    employmentData: asJson(safe),
    ...(accountNumber
      ? {
          bankAccountEncrypted: encryptSensitive(accountNumber),
          bankAccountLastFour: lastFour(accountNumber),
        }
      : {}),
  };
}

function leadData(input: CreateDraftLeadInput | UpdateLeadInput) {
  return {
    ...(input.serviceType !== undefined ? { serviceType: input.serviceType } : {}),
    ...(input.requestedAmount !== undefined ? { requestedAmount: input.requestedAmount } : {}),
    ...(input.employment !== undefined ? employmentData(input.employment) : {}),
    ...(input.serviceDetails !== undefined
      ? { serviceData: asJson(input.serviceDetails) }
      : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
    ...('stage' in input && input.stage !== undefined ? { stage: input.stage } : {}),
  };
}

function serializeLead(lead: LeadWithRelations) {
  const {
    bankAccountEncrypted: _bankAccount,
    bankAccountLastFour: _bankLastFour,
    ...safe
  } = lead;
  void _bankAccount;
  void _bankLastFour;
  return {
    ...safe,
    requestedAmount: lead.requestedAmount?.toString() ?? null,
    bankAccountMasked: maskedLastFour(lead.bankAccountLastFour),
    customer: lead.customer ? serializeCustomer(lead.customer) : null,
  };
}

async function assertCustomerForAdvisor(customerId: string, advisorId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, advisorId, archivedAt: null },
    select: { id: true },
  });
  if (!customer) throw notFound('Customer not found for this advisor');
  return customer.id;
}

async function createLeadRecord(
  input: CreateDraftLeadInput | CreateLeadInput,
  status: 'DRAFT' | 'ACTIVE',
  user: RequestUser,
  context: AuditContext,
) {
  const advisorId = await resolveAdvisorForWrite(user, input.advisorId);
  if (input.customerId) await assertCustomerForAdvisor(input.customerId, advisorId);

  const lead = await prisma.$transaction(async (tx) => {
    let customerId = input.customerId;
    if (input.customer && Object.keys(input.customer).length > 0) {
      const customer = await tx.customer.create({
        data: {
          advisorId,
          createdByUserId: user.id,
          ...customerData(input.customer as CustomerDraftInput),
        } as Prisma.CustomerUncheckedCreateInput,
      });
      customerId = customer.id;
    }

    const created = await tx.lead.create({
      data: {
        advisorId,
        customerId,
        createdByUserId: user.id,
        status,
        ...leadData(input),
      } as Prisma.LeadUncheckedCreateInput,
      include: leadInclude,
    });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: status === 'DRAFT' ? 'LEAD_DRAFT_CREATED' : 'LEAD_CREATED',
        entityType: 'lead',
        entityId: created.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { advisorId, customerId: customerId ?? null },
      },
    });
    return created;
  });
  return serializeLead(lead);
}

export const createDraftLead = (
  input: CreateDraftLeadInput,
  user: RequestUser,
  context: AuditContext,
) => createLeadRecord(input, 'DRAFT', user, context);

export const createLead = (input: CreateLeadInput, user: RequestUser, context: AuditContext) =>
  createLeadRecord(input, 'ACTIVE', user, context);

export async function listLeads(query: LeadListQuery, user: RequestUser) {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'leads:read:any');
  const searchMatches: Prisma.LeadWhereInput[] = query.search
    ? [
        ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          query.search,
        )
          ? [{ id: query.search }]
          : []),
        { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { customer: { mobile: { contains: query.search } } },
        { customer: { email: { contains: query.search, mode: 'insensitive' } } },
        { serviceType: { contains: query.search, mode: 'insensitive' } },
        { application: { applicationNumber: { contains: query.search, mode: 'insensitive' } } },
      ]
    : [];
  const where: Prisma.LeadWhereInput = {
    ...(advisorId ? { advisorId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
    ...(query.stage ? { stage: query.stage } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(query.followUpFrom || query.followUpTo
      ? {
          nextFollowUpAt: {
            ...(query.followUpFrom ? { gte: query.followUpFrom } : {}),
            ...(query.followUpTo ? { lte: query.followUpTo } : {}),
          },
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
    ...(query.search
      ? {
          OR: searchMatches,
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      include: leadInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.lead.count({ where }),
  ]);
  return {
    items: items.map(serializeLead),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getLead(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
  if (!lead) throw notFound('Lead not found');
  return serializeLead(lead);
}

export async function updateLead(
  id: string,
  input: UpdateLeadInput,
  user: RequestUser,
  context: AuditContext,
  draftOnly = false,
) {
  const current = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      advisorId: true,
      customerId: true,
      status: true,
      stage: true,
      employmentData: true,
      serviceData: true,
    },
  });
  if (!current) throw notFound('Lead not found');
  if (!['DRAFT', 'ACTIVE'].includes(current.status) || (draftOnly && current.status !== 'DRAFT')) {
    throw conflict(draftOnly ? 'Only drafts can be saved through this endpoint' : 'This lead can no longer be edited');
  }
  if (input.stage === 'CONVERTED') {
    throw new AppError(422, 'INVALID_LEAD_STAGE', 'Use the conversion endpoint to convert a lead');
  }
  if (input.customerId) await assertCustomerForAdvisor(input.customerId, current.advisorId);

  const updated = await prisma.$transaction(async (tx) => {
    let customerId = input.customerId ?? current.customerId;
    if (input.customer) {
      if (current.customerId) {
        await tx.customer.update({
          where: { id: current.customerId },
          data: customerData(input.customer),
        });
      } else if (Object.keys(input.customer).length > 0) {
        const customer = await tx.customer.create({
          data: {
            advisorId: current.advisorId,
            createdByUserId: user.id,
            ...customerData(input.customer),
          } as Prisma.CustomerUncheckedCreateInput,
        });
        customerId = customer.id;
      }
    }

    const updateData = leadData(input) as Prisma.LeadUncheckedUpdateInput;
    if (input.employment) {
      const { accountNumber, ...safeEmployment } = input.employment;
      updateData.employmentData = asJson({
        ...((current.employmentData ?? {}) as Record<string, unknown>),
        ...safeEmployment,
      });
      if (accountNumber) {
        updateData.bankAccountEncrypted = encryptSensitive(accountNumber);
        updateData.bankAccountLastFour = lastFour(accountNumber);
      }
    }
    if (input.serviceDetails) {
      updateData.serviceData = asJson({
        ...((current.serviceData ?? {}) as Record<string, unknown>),
        ...input.serviceDetails,
      });
    }

    const lead = await tx.lead.update({
      where: { id, status: { in: ['DRAFT', 'ACTIVE'] } },
      data: { ...updateData, ...(customerId ? { customerId } : {}) },
      include: leadInclude,
    });
    if (input.stage && input.stage !== current.stage) {
      await tx.leadActivity.create({
        data: {
          leadId: id,
          createdByUserId: user.id,
          kind: 'STAGE_CHANGE',
          note: `Stage changed from ${current.stage} to ${input.stage}`,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: draftOnly ? 'LEAD_DRAFT_SAVED' : 'LEAD_UPDATED',
        entityType: 'lead',
        entityId: id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { fields: Object.keys(input) },
      },
    });
    return lead;
  });
  return serializeLead(updated);
}

export async function archiveLead(id: string, user: RequestUser, context: AuditContext) {
  const current = await prisma.lead.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw notFound('Lead not found');
  if (current.status === 'CONVERTED') throw conflict('Converted leads cannot be archived');
  if (current.status === 'ARCHIVED') return;
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id, status: { in: ['DRAFT', 'ACTIVE'] } },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'LEAD_ARCHIVED',
        entityType: 'lead',
        entityId: id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  });
}

export async function addActivity(
  leadId: string,
  input: CreateActivityInput,
  user: RequestUser,
  context: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { status: true } });
    if (!lead) throw notFound('Lead not found');
    if (!['DRAFT', 'ACTIVE'].includes(lead.status)) {
      throw conflict('Activities cannot be added to a converted or archived lead');
    }
    const activity = await tx.leadActivity.create({
      data: {
        leadId,
        createdByUserId: user.id,
        kind: input.kind,
        note: input.note,
        dueAt: input.dueAt,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (input.kind === 'FOLLOW_UP' && input.dueAt) {
      await tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: input.dueAt } });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: input.kind === 'FOLLOW_UP' ? 'LEAD_FOLLOW_UP_CREATED' : 'LEAD_ACTIVITY_CREATED',
        entityType: 'lead_activity',
        entityId: activity.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { leadId, kind: input.kind },
      },
    });
    return activity;
  });
}

export async function listActivities(leadId: string, query: ActivityListQuery) {
  const where: Prisma.LeadActivityWhereInput = {
    leadId,
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.completed === undefined
      ? {}
      : query.completed
        ? { completedAt: { not: null } }
        : { completedAt: null }),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    ...(query.search ? { note: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.leadActivity.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
    }),
    prisma.leadActivity.count({ where }),
  ]);
  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function completeFollowUp(
  leadId: string,
  activityId: string,
  user: RequestUser,
  context: AuditContext,
) {
  return prisma.$transaction(async (tx) => {
    const activity = await tx.leadActivity.findFirst({
      where: { id: activityId, leadId, kind: 'FOLLOW_UP' },
    });
    if (!activity) throw notFound('Follow-up not found');
    if (activity.completedAt) return activity;
    const completed = await tx.leadActivity.update({
      where: { id: activity.id },
      data: { completedAt: new Date() },
    });
    const next = await tx.leadActivity.findFirst({
      where: { leadId, kind: 'FOLLOW_UP', completedAt: null, dueAt: { not: null } },
      orderBy: { dueAt: 'asc' },
      select: { dueAt: true },
    });
    await tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next?.dueAt ?? null } });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'LEAD_FOLLOW_UP_COMPLETED',
        entityType: 'lead_activity',
        entityId: activity.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { leadId },
      },
    });
    return completed;
  });
}

function assertConvertible(lead: Prisma.LeadGetPayload<{ include: { customer: true } }>) {
  if (!['DRAFT', 'ACTIVE'].includes(lead.status)) {
    throw conflict('Only an unconverted lead can be converted');
  }
  if (lead.stage === 'DROPPED') {
    throw conflict('A dropped lead must be moved to an active stage before conversion');
  }
  const customer = lead.customer;
  if (customer?.archivedAt) {
    throw conflict('An archived customer cannot be submitted');
  }
  const missing: string[] = [];
  if (!customer) missing.push('customer');
  if (customer) {
    for (const [field, value] of Object.entries({
      'customer.fullName': customer.fullName,
      'customer.mobile': customer.mobile,
      'customer.email': customer.email,
      'customer.dateOfBirth': customer.dateOfBirth,
      'customer.gender': customer.gender,
      'customer.pan': customer.panEncrypted,
      'customer.aadhaar': customer.aadhaarEncrypted,
      'customer.addressLine': customer.addressLine,
      'customer.city': customer.city,
      'customer.state': customer.state,
      'customer.pincode': customer.pincode,
    })) {
      if (!value) missing.push(field);
    }
  }
  if (!lead.serviceType) missing.push('serviceType');
  if (lead.serviceType && LOAN_SERVICE_TYPES.has(lead.serviceType) && !lead.requestedAmount) {
    missing.push('requestedAmount');
  }
  const employment = (lead.employmentData ?? {}) as Record<string, unknown>;
  for (const field of [
    'employmentType',
    'monthlyIncome',
    'organisation',
    'experience',
    'existingLoans',
    'bankName',
    'ifsc',
  ]) {
    if (!employment[field]) missing.push(`employment.${field}`);
  }
  if (!lead.bankAccountEncrypted) missing.push('employment.accountNumber');
  const service = (lead.serviceData ?? {}) as Record<string, unknown>;
  if (lead.serviceType && LOAN_SERVICE_TYPES.has(lead.serviceType)) {
    if (!service.tenure) missing.push('serviceDetails.tenure');
    if (!service.purpose) missing.push('serviceDetails.purpose');
  }
  if (lead.serviceType === 'Credit Card' && !service.cardCategory) {
    missing.push('serviceDetails.cardCategory');
  }
  if (lead.serviceType === 'Insurance') {
    if (!service.insuranceType) missing.push('serviceDetails.insuranceType');
    if (!service.sumAssured) missing.push('serviceDetails.sumAssured');
  }
  if (lead.serviceType === 'Other Financial Services' && !service.serviceNotes) {
    missing.push('serviceDetails.serviceNotes');
  }
  if (missing.length > 0) {
    throw new AppError(422, 'LEAD_INCOMPLETE', 'Lead is incomplete and cannot be converted', {
      missingFields: missing,
    });
  }
}

export async function convertLead(
  id: string,
  remarks: string | undefined,
  user: RequestUser,
  context: AuditContext,
) {
  const performConversion = () => prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id },
      include: { customer: true, advisor: { include: { user: true } } },
    });
    if (!lead) throw notFound('Lead not found');
    assertConvertible(lead);
    if (!lead.customer || !lead.serviceType) {
      throw new Error('Conversion validation invariant failed');
    }
    const customer = lead.customer;
    const serviceType = lead.serviceType;

    const claimed = await tx.lead.updateMany({
      where: { id, status: { in: ['DRAFT', 'ACTIVE'] } },
      data: { status: 'CONVERTED', stage: 'CONVERTED', convertedAt: new Date() },
    });
    if (claimed.count !== 1) throw conflict('Lead has already been converted or archived');

    const now = new Date();
    const period = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const counter = await tx.applicationCounter.upsert({
      where: { period },
      update: { value: { increment: 1 } },
      create: { period, value: 1 },
    });
    const applicationNumber = `CBL-${period}-${String(counter.value).padStart(6, '0')}`;
    const customerSnapshot = {
      fullName: customer.fullName,
      mobile: customer.mobile,
      email: customer.email,
      dateOfBirth: customer.dateOfBirth?.toISOString().slice(0, 10),
      gender: customer.gender,
      panMasked: maskedLastFour(customer.panLastFour),
      aadhaarMasked: maskedLastFour(customer.aadhaarLastFour),
      addressLine: customer.addressLine,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    };
    const employmentSnapshot = {
      ...((lead.employmentData ?? {}) as Record<string, unknown>),
      bankAccountMasked: maskedLastFour(lead.bankAccountLastFour),
    };
    const application = await tx.application.create({
      data: {
        applicationNumber,
        leadId: lead.id,
        customerId: customer.id,
        advisorId: lead.advisorId,
        createdByUserId: user.id,
        status: 'SUBMITTED',
        serviceType,
        requestedAmount: lead.requestedAmount,
        customerSnapshot: asJson(customerSnapshot),
        employmentSnapshot: asJson(employmentSnapshot),
        serviceSnapshot: lead.serviceData ?? undefined,
      },
    });
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: null,
        toStatus: 'SUBMITTED',
        remarks: remarks ?? 'Application created from lead conversion',
        changedByUserId: user.id,
      },
    });
    await tx.applicationActivity.create({
      data: {
        applicationId: application.id,
        createdByUserId: user.id,
        kind: 'SUBMISSION',
        note: remarks ?? 'Application submitted from lead conversion',
        metadata: { leadId: lead.id, applicationNumber },
      },
    });
    const checklist = DOCUMENT_CHECKLISTS[serviceType as keyof typeof DOCUMENT_CHECKLISTS];
    if (!checklist) throw new AppError(422, 'INVALID_SERVICE_TYPE', 'Unsupported service type');
    await tx.documentRequest.createMany({
      data: checklist.map((item) => ({
        applicationId: application.id,
        documentType: item.documentType,
        displayName: item.displayName,
        required: item.required,
        status: 'PENDING',
        requestedByUserId: user.id,
      })),
    });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        createdByUserId: user.id,
        kind: 'CONVERSION',
        note: `Converted to application ${applicationNumber}`,
      },
    });
    await tx.notification.create({
      data: {
        recipientUserId: lead.advisor.userId,
        type: 'APPLICATION_CREATED',
        title: `Application ${applicationNumber} submitted`,
        body: `${customer.fullName}'s application has been submitted for operations review.`,
        leadId: lead.id,
        applicationId: application.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'LEAD_CONVERTED_TO_APPLICATION',
        entityType: 'application',
        entityId: application.id,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { leadId: lead.id, applicationNumber, advisorId: lead.advisorId },
      },
    });
    return {
      ...application,
      requestedAmount: application.requestedAmount?.toString() ?? null,
    };
  }, { isolationLevel: 'Serializable' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await performConversion();
    } catch (error) {
      const retryable =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
      if (!retryable || attempt === 2) throw error;
    }
  }
  throw new Error('Conversion retry invariant failed');
}
