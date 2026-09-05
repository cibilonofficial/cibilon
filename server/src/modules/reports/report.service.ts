import type { Prisma } from '../../../generated/prisma/client.js';
import { forbidden, notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import { scopedAdvisorId } from '../advisors/advisor-access.js';
import type {
  AdvisorReportQuery,
  ApplicationReportQuery,
  CreateExportJobInput,
  DashboardQuery,
  ExportJobListQuery,
  LenderReportQuery,
  PayoutReportQuery,
} from './report.schemas.js';

function dateRange(dateFrom?: Date, dateTo?: Date) {
  return dateFrom || dateTo ? { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } : undefined;
}

function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function numeric(value: { toString(): string } | null | undefined) {
  return value ? Number(value.toString()) : 0;
}

function sortRows<T>(rows: T[], key: keyof T, order: 'asc' | 'desc') {
  return rows.sort((left, right) => {
    const a = left[key] as string | number;
    const b = right[key] as string | number;
    const compared = typeof a === 'string' ? a.localeCompare(String(b)) : Number(a) - Number(b);
    return order === 'asc' ? compared : -compared;
  });
}

function applicationWhere(query: DashboardQuery | ApplicationReportQuery, user: RequestUser): Prisma.ApplicationWhereInput {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'reports:read:any');
  return {
    ...(advisorId ? { advisorId } : {}),
    ...(query.lenderId ? { lenderId: query.lenderId } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...('status' in query && query.status ? { status: query.status } : {}),
    ...(dateRange(query.dateFrom, query.dateTo) ? { createdAt: dateRange(query.dateFrom, query.dateTo) } : {}),
    ...(query.search
      ? { OR: [
          { applicationNumber: { contains: query.search, mode: 'insensitive' } },
          { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
          { advisor: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
          { lender: { name: { contains: query.search, mode: 'insensitive' } } },
        ] }
      : {}),
  };
}

export async function getDashboard(query: DashboardQuery, user: RequestUser) {
  const where = applicationWhere(query, user);
  const payoutWhere: Prisma.PayoutWhereInput = {
    application: where,
    ...(dateRange(query.dateFrom, query.dateTo) ? { createdAt: dateRange(query.dateFrom, query.dateTo) } : {}),
  };
  const [applications, payouts, openTickets, pendingDocuments, activeAdvisors] = await Promise.all([
    prisma.application.findMany({
      where,
      select: {
        id: true, applicationNumber: true, status: true, serviceType: true, requestedAmount: true,
        disbursedAmount: true, createdAt: true, disbursedAt: true,
        customer: { select: { fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10_000,
    }),
    prisma.payout.findMany({ where: payoutWhere, select: { status: true, payoutAmount: true, createdAt: true }, take: 10_000 }),
    prisma.supportTicket.count({ where: { ...(user.advisorId && !user.permissions.includes('reports:read:any') ? { advisorId: user.advisorId } : {}), status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.documentRequest.count({ where: { application: where, status: { in: ['PENDING', 'REJECTED'] }, required: true } }),
    user.permissions.includes('reports:read:any') ? prisma.advisor.count({ where: { user: { status: 'ACTIVE' } } }) : Promise.resolve(1),
  ]);

  const statusMap = new Map<string, number>();
  const serviceMap = new Map<string, { applications: number; disbursed: number; volume: number }>();
  const monthlyMap = new Map<string, { month: string; submitted: number; disbursed: number; payout: number }>();
  for (const application of applications) {
    statusMap.set(application.status, (statusMap.get(application.status) ?? 0) + 1);
    const service = serviceMap.get(application.serviceType) ?? { applications: 0, disbursed: 0, volume: 0 };
    service.applications += 1;
    if (application.status === 'DISBURSED') {
      service.disbursed += 1;
      service.volume += numeric(application.disbursedAmount);
    }
    serviceMap.set(application.serviceType, service);
    const key = application.createdAt.toISOString().slice(0, 7);
    const month = monthlyMap.get(key) ?? { month: key, submitted: 0, disbursed: 0, payout: 0 };
    month.submitted += 1;
    if (application.status === 'DISBURSED') month.disbursed += 1;
    monthlyMap.set(key, month);
  }
  for (const payout of payouts) {
    const key = payout.createdAt.toISOString().slice(0, 7);
    const month = monthlyMap.get(key) ?? { month: key, submitted: 0, disbursed: 0, payout: 0 };
    month.payout += numeric(payout.payoutAmount);
    monthlyMap.set(key, month);
  }
  const disbursed = applications.filter((item) => item.status === 'DISBURSED');
  const approved = applications.filter((item) => ['APPROVED', 'DISBURSED'].includes(item.status)).length;
  const decided = approved + applications.filter((item) => item.status === 'REJECTED').length;
  return {
    metrics: {
      applications: applications.length,
      activeApplications: applications.filter((item) => !['REJECTED', 'DISBURSED', 'CANCELLED'].includes(item.status)).length,
      disbursed: disbursed.length,
      requestedVolume: applications.reduce((sum, item) => sum + numeric(item.requestedAmount), 0),
      disbursedVolume: disbursed.reduce((sum, item) => sum + numeric(item.disbursedAmount), 0),
      payoutRaised: payouts.reduce((sum, item) => sum + numeric(item.payoutAmount), 0),
      payoutPaid: payouts.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + numeric(item.payoutAmount), 0),
      pendingPayouts: payouts.filter((item) => ['PENDING', 'PROCESSING', 'FAILED'].includes(item.status)).length,
      approvalRate: decided ? Math.round((approved / decided) * 10000) / 100 : 0,
      openTickets,
      pendingDocuments,
      activeAdvisors,
    },
    statusDistribution: [...statusMap].map(([status, value]) => ({ status, value })),
    serviceDistribution: [...serviceMap].map(([serviceType, values]) => ({ serviceType, ...values })),
    monthlyTrend: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
    recentApplications: applications.slice(0, 10).map((item) => ({
      ...item,
      requestedAmount: item.requestedAmount?.toString() ?? null,
      disbursedAmount: item.disbursedAmount?.toString() ?? null,
    })),
  };
}

export async function getApplicationReport(query: ApplicationReportQuery, user: RequestUser, unbounded = false) {
  const where = applicationWhere(query, user);
  const [items, total] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      select: {
        id: true, applicationNumber: true, status: true, serviceType: true, requestedAmount: true,
        disbursedAmount: true, submittedAt: true, disbursedAt: true, createdAt: true,
        customer: { select: { fullName: true, city: true, state: true } },
        advisor: { select: { code: true, user: { select: { name: true } } } },
        lender: { select: { name: true, type: true } },
        payout: { select: { payoutNumber: true, payoutAmount: true, status: true } },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: unbounded ? 0 : (query.page - 1) * query.pageSize,
      take: unbounded ? 10_000 : query.pageSize,
    }),
    prisma.application.count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      requestedAmount: item.requestedAmount?.toString() ?? null,
      disbursedAmount: item.disbursedAmount?.toString() ?? null,
      payout: item.payout ? { ...item.payout, payoutAmount: item.payout.payoutAmount.toString() } : null,
    })),
    pagination: pagination(query.page, query.pageSize, total),
  };
}

export async function getPayoutReport(query: PayoutReportQuery, user: RequestUser, unbounded = false) {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'reports:read:any');
  const where: Prisma.PayoutWhereInput = {
    ...(advisorId ? { advisorId } : {}),
    ...(query.lenderId ? { lenderId: query.lenderId } : {}),
    ...(query.serviceType ? { application: { serviceType: query.serviceType } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(dateRange(query.dateFrom, query.dateTo) ? { createdAt: dateRange(query.dateFrom, query.dateTo) } : {}),
    ...(query.search ? { OR: [
      { payoutNumber: { contains: query.search, mode: 'insensitive' } },
      { paymentReference: { contains: query.search, mode: 'insensitive' } },
      { application: { applicationNumber: { contains: query.search, mode: 'insensitive' } } },
      { advisor: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
    ] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.payout.findMany({
      where,
      include: {
        application: { select: { applicationNumber: true, serviceType: true, customer: { select: { fullName: true } } } },
        advisor: { select: { code: true, user: { select: { name: true } } } },
        lender: { select: { name: true } },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: unbounded ? 0 : (query.page - 1) * query.pageSize,
      take: unbounded ? 10_000 : query.pageSize,
    }),
    prisma.payout.count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      ...item, disbursedAmount: item.disbursedAmount.toString(), payoutAmount: item.payoutAmount.toString(),
      percentageRate: item.percentageRate?.toString() ?? null, flatAmount: item.flatAmount?.toString() ?? null,
    })),
    pagination: pagination(query.page, query.pageSize, total),
  };
}

export async function getAdvisorReport(query: AdvisorReportQuery, user: RequestUser, unbounded = false) {
  const scoped = scopedAdvisorId(user, query.advisorId, 'reports:read:any');
  const advisors = await prisma.advisor.findMany({
    where: {
      ...(scoped ? { id: scoped } : {}),
      ...(query.search ? { OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
      ] } : {}),
    },
    include: {
      user: { select: { name: true, email: true, status: true } },
      applications: {
        where: {
          ...(query.lenderId ? { lenderId: query.lenderId } : {}),
          ...(query.serviceType ? { serviceType: query.serviceType } : {}),
          ...(dateRange(query.dateFrom, query.dateTo) ? { createdAt: dateRange(query.dateFrom, query.dateTo) } : {}),
        },
        select: { status: true, disbursedAmount: true, payout: { select: { payoutAmount: true, status: true } } },
      },
    },
  });
  const rows = advisors.map((advisor) => {
    const disbursed = advisor.applications.filter((item) => item.status === 'DISBURSED');
    return {
      id: advisor.id, code: advisor.code, name: advisor.user.name, email: advisor.user.email, status: advisor.user.status,
      applications: advisor.applications.length,
      disbursed: disbursed.length,
      rejected: advisor.applications.filter((item) => item.status === 'REJECTED').length,
      disbursedVolume: disbursed.reduce((sum, item) => sum + numeric(item.disbursedAmount), 0),
      payoutAmount: advisor.applications.reduce((sum, item) => sum + numeric(item.payout?.payoutAmount), 0),
      payoutPaid: advisor.applications.filter((item) => item.payout?.status === 'PAID').reduce((sum, item) => sum + numeric(item.payout?.payoutAmount), 0),
    };
  });
  sortRows(rows, query.sortBy, query.sortOrder);
  const total = rows.length;
  const items = unbounded ? rows.slice(0, 10_000) : rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
  return { items, pagination: pagination(query.page, query.pageSize, total) };
}

export async function getLenderReport(query: LenderReportQuery, user: RequestUser, unbounded = false) {
  if (!user.permissions.includes('reports:read:any')) throw forbidden();
  const lenders = await prisma.lender.findMany({
    where: {
      ...(query.lenderId ? { id: query.lenderId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    },
    include: {
      applications: {
        where: {
          ...(query.advisorId ? { advisorId: query.advisorId } : {}),
          ...(query.serviceType ? { serviceType: query.serviceType } : {}),
          ...(dateRange(query.dateFrom, query.dateTo) ? { createdAt: dateRange(query.dateFrom, query.dateTo) } : {}),
        },
        select: { status: true, disbursedAmount: true, payout: { select: { payoutAmount: true } } },
      },
    },
  });
  const rows = lenders.map((lender) => {
    const disbursed = lender.applications.filter((item) => item.status === 'DISBURSED');
    const approved = lender.applications.filter((item) => ['APPROVED', 'DISBURSED'].includes(item.status)).length;
    const decided = approved + lender.applications.filter((item) => item.status === 'REJECTED').length;
    return {
      id: lender.id, name: lender.name, type: lender.type, status: lender.status, turnaroundDays: lender.turnaroundDays,
      applications: lender.applications.length,
      disbursed: disbursed.length,
      disbursedVolume: disbursed.reduce((sum, item) => sum + numeric(item.disbursedAmount), 0),
      payoutAmount: lender.applications.reduce((sum, item) => sum + numeric(item.payout?.payoutAmount), 0),
      approvalRate: decided ? Math.round((approved / decided) * 10000) / 100 : 0,
    };
  });
  sortRows(rows, query.sortBy, query.sortOrder);
  const total = rows.length;
  const items = unbounded ? rows.slice(0, 10_000) : rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
  return { items, pagination: pagination(query.page, query.pageSize, total) };
}

export async function createExportJob(input: CreateExportJobInput, user: RequestUser) {
  if (!user.permissions.includes('reports:read:any') && ['ADVISORS', 'LENDERS'].includes(input.reportType)) throw forbidden();
  const filters = { ...input.filters, ...(user.advisorId && !user.permissions.includes('reports:read:any') ? { advisorId: user.advisorId } : {}) };
  return prisma.exportJob.create({
    data: { requestedByUserId: user.id, reportType: input.reportType, format: input.format, filters },
    select: { id: true, reportType: true, format: true, status: true, createdAt: true },
  });
}

export async function listExportJobs(query: ExportJobListQuery, user: RequestUser) {
  const where: Prisma.ExportJobWhereInput = {
    requestedByUserId: user.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.reportType ? { reportType: query.reportType } : {}),
    ...(query.format ? { format: query.format } : {}),
    ...(dateRange(query.dateFrom, query.dateTo) ? { createdAt: dateRange(query.dateFrom, query.dateTo) } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.exportJob.findMany({ where, orderBy: { createdAt: query.sortOrder }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.exportJob.count({ where }),
  ]);
  return { items: items.map(({ filePath: _path, ...item }) => item), pagination: pagination(query.page, query.pageSize, total) };
}

export async function getExportJob(id: string, user: RequestUser) {
  const job = await prisma.exportJob.findFirst({ where: { id, requestedByUserId: user.id } });
  if (!job) throw notFound('Export job not found');
  const { filePath: _path, ...safe } = job;
  return safe;
}

export async function getExportJobForDownload(id: string, user: RequestUser) {
  const job = await prisma.exportJob.findFirst({ where: { id, requestedByUserId: user.id } });
  if (!job) throw notFound('Export job not found');
  if (job.status !== 'COMPLETED' || !job.filePath || !job.fileName || !job.mimeType) throw notFound('Export file is not ready');
  if (job.expiresAt && job.expiresAt <= new Date()) throw notFound('Export file has expired');
  return job;
}

export async function buildExportRows(reportType: string, filters: Record<string, unknown>, user: RequestUser) {
  const dates = {
    ...filters,
    ...(typeof filters.dateFrom === 'string' ? { dateFrom: new Date(filters.dateFrom) } : {}),
    ...(typeof filters.dateTo === 'string' ? { dateTo: new Date(filters.dateTo) } : {}),
    page: 1,
    pageSize: 100,
    sortOrder: 'desc' as const,
  };
  if (reportType === 'APPLICATIONS') return (await getApplicationReport({ sortBy: 'createdAt', ...dates } as ApplicationReportQuery, user, true)).items;
  if (reportType === 'PAYOUTS') return (await getPayoutReport({ sortBy: 'createdAt', ...dates } as PayoutReportQuery, user, true)).items;
  if (reportType === 'ADVISORS') return (await getAdvisorReport({ sortBy: 'payoutAmount', ...dates } as AdvisorReportQuery, user, true)).items;
  return (await getLenderReport({ sortBy: 'disbursedVolume', ...dates } as LenderReportQuery, user, true)).items;
}
