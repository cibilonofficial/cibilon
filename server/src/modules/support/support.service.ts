import { randomUUID } from 'node:crypto';
import type { Prisma, TicketStatus } from '../../../generated/prisma/client.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import type { AuditContext } from '../audit/audit.service.js';
import { scopedAdvisorId } from '../advisors/advisor-access.js';
import type {
  CreateTicketInput,
  CreateTicketMessageInput,
  TicketListQuery,
  TicketMessageListQuery,
  UpdateTicketInput,
} from './support.schemas.js';

const ticketSummaryInclude = {
  advisor: { include: { user: { select: { id: true, name: true, email: true } } } },
  application: { select: { id: true, applicationNumber: true, serviceType: true } },
  payout: { select: { id: true, payoutNumber: true, payoutAmount: true, status: true } },
  assignedStaff: { include: { user: { select: { id: true, name: true, email: true, status: true } } } },
  _count: { select: { messages: true } },
} satisfies Prisma.SupportTicketInclude;

const ticketTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

function auditData(user: RequestUser, context: AuditContext) {
  return {
    actorUserId: user.id,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

function serializeTicket<T extends Prisma.SupportTicketGetPayload<{ include: typeof ticketSummaryInclude }>>(ticket: T) {
  return {
    ...ticket,
    payout: ticket.payout ? { ...ticket.payout, payoutAmount: ticket.payout.payoutAmount.toString() } : null,
  };
}

async function supportManagerUserIds(tx: Prisma.TransactionClient, exclude: string[] = []) {
  const users = await tx.user.findMany({
    where: {
      status: 'ACTIVE',
      id: { notIn: exclude },
      OR: [
        { directPermissions: { some: { permission: { code: 'support:manage' } } } },
        { userRoles: { some: { role: { permissions: { some: { permission: { code: 'support:manage' } } } } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((item) => item.id);
}

async function requireTicketAccess(id: string, user: RequestUser) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: ticketSummaryInclude });
  if (!ticket) throw notFound('Support ticket not found');
  if (!user.permissions.includes('support:read:any') && ticket.advisorId !== user.advisorId) throw forbidden();
  return ticket;
}

export async function listTickets(query: TicketListQuery, user: RequestUser) {
  const advisorId = scopedAdvisorId(user, query.advisorId, 'support:read:any');
  const where: Prisma.SupportTicketWhereInput = {
    ...(advisorId ? { advisorId } : {}),
    ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
    ...(query.unassigned === true ? { assignedStaffId: null } : {}),
    ...(query.unassigned === false ? { assignedStaffId: { not: null } } : {}),
    ...(query.applicationId ? { applicationId: query.applicationId } : {}),
    ...(query.payoutId ? { payoutId: query.payoutId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { ticketNumber: { contains: query.search, mode: 'insensitive' } },
            { subject: { contains: query.search, mode: 'insensitive' } },
            { advisor: { code: { contains: query.search, mode: 'insensitive' } } },
            { advisor: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
            { application: { applicationNumber: { contains: query.search, mode: 'insensitive' } } },
            { payout: { payoutNumber: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.supportTicket.findMany({ where, include: ticketSummaryInclude, orderBy: { [query.sortBy]: query.sortOrder }, skip, take: query.pageSize }),
    prisma.supportTicket.count({ where }),
  ]);
  return {
    items: items.map(serializeTicket),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function getTicket(id: string, user: RequestUser) {
  const ticket = await requireTicketAccess(id, user);
  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId: id, ...(user.permissions.includes('support:read:any') ? {} : { internal: false }) },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return { ...serializeTicket(ticket), messages };
}

export async function createTicket(input: CreateTicketInput, user: RequestUser, context: AuditContext) {
  const advisorId = user.advisorId ?? input.advisorId;
  if (!advisorId) throw badRequest('advisorId is required when creating a ticket on behalf of an advisor');
  if (user.advisorId && input.advisorId && input.advisorId !== user.advisorId) throw forbidden();
  if (!user.advisorId && !user.permissions.includes('support:manage')) throw forbidden();

  const id = await prisma.$transaction(async (tx) => {
    const advisor = await tx.advisor.findUnique({ where: { id: advisorId }, include: { user: { select: { id: true } } } });
    if (!advisor) throw notFound('Advisor not found');
    if (input.applicationId) {
      const application = await tx.application.findUnique({ where: { id: input.applicationId }, select: { advisorId: true } });
      if (!application) throw notFound('Linked application not found');
      if (application.advisorId !== advisorId) throw badRequest('Linked application does not belong to this advisor');
    }
    if (input.payoutId) {
      const payout = await tx.payout.findUnique({ where: { id: input.payoutId }, select: { advisorId: true, applicationId: true } });
      if (!payout) throw notFound('Linked payout not found');
      if (payout.advisorId !== advisorId) throw badRequest('Linked payout does not belong to this advisor');
      if (input.applicationId && payout.applicationId !== input.applicationId) throw badRequest('Linked payout does not belong to the linked application');
    }
    const ticket = await tx.supportTicket.create({
      data: {
        ticketNumber: `TK-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
        advisorId,
        createdByUserId: user.id,
        subject: input.subject,
        category: input.category,
        priority: input.priority,
        applicationId: input.applicationId,
        payoutId: input.payoutId,
        messages: { create: { authorUserId: user.id, body: input.message } },
      },
    });
    const recipients = user.advisorId
      ? await supportManagerUserIds(tx, [user.id])
      : [advisor.user.id].filter((recipient) => recipient !== user.id);
    if (recipients.length) {
      await tx.notification.createMany({
        data: recipients.map((recipientUserId) => ({
          recipientUserId,
          type: 'SUPPORT_ACTION' as const,
          title: `Support ticket ${ticket.ticketNumber} opened`,
          body: input.subject,
          applicationId: input.applicationId,
          payoutId: input.payoutId,
          ticketId: ticket.id,
        })),
      });
    }
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'SUPPORT_TICKET_CREATED', entityType: 'support_ticket', entityId: ticket.id, metadata: { ticketNumber: ticket.ticketNumber, advisorId, category: input.category } },
    });
    return ticket.id;
  });
  return getTicket(id, user);
}

export async function updateTicket(id: string, input: UpdateTicketInput, user: RequestUser, context: AuditContext) {
  await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id },
      include: { advisor: { select: { userId: true } }, assignedStaff: { select: { userId: true } } },
    });
    if (!ticket) throw notFound('Support ticket not found');
    if (input.status && input.status !== ticket.status && !ticketTransitions[ticket.status].includes(input.status)) {
      throw conflict(`Invalid ticket transition from ${ticket.status} to ${input.status}`);
    }
    if (
      input.status === ticket.status &&
      input.priority === undefined &&
      input.assignedStaffId === undefined &&
      input.note === undefined
    ) throw conflict(`Ticket is already ${input.status}`);
    if (input.assignedStaffId) {
      const staff = await tx.staff.findUnique({ where: { id: input.assignedStaffId }, include: { user: { select: { status: true } } } });
      if (!staff) throw notFound('Assigned staff member not found');
      if (staff.user.status !== 'ACTIVE') throw conflict('Tickets can only be assigned to active staff');
    }
    const now = new Date();
    await tx.supportTicket.update({
      where: { id },
      data: {
        ...(input.status ? {
          status: input.status,
          resolvedAt: input.status === 'RESOLVED' ? now : input.status === 'IN_PROGRESS' || input.status === 'OPEN' ? null : ticket.resolvedAt,
          closedAt: input.status === 'CLOSED' ? now : null,
        } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.assignedStaffId !== undefined ? { assignedStaffId: input.assignedStaffId } : {}),
      },
    });
    if (input.note) {
      await tx.ticketMessage.create({ data: { ticketId: id, authorUserId: user.id, body: input.note, internal: false } });
    }
    const recipients = new Set<string>([ticket.advisor.userId]);
    if (input.assignedStaffId) {
      const assigned = await tx.staff.findUniqueOrThrow({ where: { id: input.assignedStaffId }, select: { userId: true } });
      recipients.add(assigned.userId);
    }
    recipients.delete(user.id);
    if (recipients.size) {
      await tx.notification.createMany({
        data: [...recipients].map((recipientUserId) => ({
          recipientUserId,
          type: 'SUPPORT_ACTION' as const,
          title: `${ticket.ticketNumber} updated`,
          body: input.note ?? `Ticket status, priority, or assignment was updated.`,
          ticketId: id,
          applicationId: ticket.applicationId,
          payoutId: ticket.payoutId,
        })),
      });
    }
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'SUPPORT_TICKET_UPDATED', entityType: 'support_ticket', entityId: id, metadata: { fields: Object.keys(input), fromStatus: ticket.status, toStatus: input.status ?? ticket.status } },
    });
  });
  return getTicket(id, user);
}

export async function addTicketMessage(id: string, input: CreateTicketMessageInput, user: RequestUser, context: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id },
      include: { advisor: { select: { userId: true } }, assignedStaff: { select: { userId: true } } },
    });
    if (!ticket) throw notFound('Support ticket not found');
    const staffAccess = user.permissions.includes('support:read:any');
    if (!staffAccess && ticket.advisorId !== user.advisorId) throw forbidden();
    if (!staffAccess && input.internal) throw forbidden('Advisors cannot create internal ticket messages');
    if (ticket.status === 'CLOSED') throw conflict('Closed tickets cannot receive new messages');
    const message = await tx.ticketMessage.create({
      data: { ticketId: id, authorUserId: user.id, body: input.body, internal: staffAccess ? input.internal : false },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    if (!input.internal) {
      const recipients = user.advisorId
        ? ticket.assignedStaff?.userId
          ? [ticket.assignedStaff.userId]
          : await supportManagerUserIds(tx, [user.id])
        : [ticket.advisor.userId];
      const uniqueRecipients = [...new Set(recipients)].filter((recipient) => recipient !== user.id);
      if (uniqueRecipients.length) {
        await tx.notification.createMany({
          data: uniqueRecipients.map((recipientUserId) => ({
            recipientUserId,
            type: 'SUPPORT_ACTION' as const,
            title: `New message on ${ticket.ticketNumber}`,
            body: input.body.slice(0, 500),
            ticketId: id,
            applicationId: ticket.applicationId,
            payoutId: ticket.payoutId,
          })),
        });
      }
    }
    await tx.auditLog.create({
      data: { ...auditData(user, context), action: 'SUPPORT_TICKET_MESSAGE_ADDED', entityType: 'support_ticket', entityId: id, metadata: { messageId: message.id, internal: message.internal } },
    });
    return message;
  });
}

export async function listTicketMessages(id: string, query: TicketMessageListQuery, user: RequestUser) {
  await requireTicketAccess(id, user);
  const where: Prisma.TicketMessageWhereInput = {
    ticketId: id,
    ...(user.permissions.includes('support:read:any') ? {} : { internal: false }),
    ...(query.search ? { body: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.ticketMessage.findMany({ where, include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: query.sortOrder }, skip, take: query.pageSize }),
    prisma.ticketMessage.count({ where }),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
}
