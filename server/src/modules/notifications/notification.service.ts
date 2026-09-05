import type { Prisma } from '../../../generated/prisma/client.js';
import { notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { NotificationListQuery } from './notification.schemas.js';

const notificationInclude = {
  lead: { select: { id: true } },
  application: { select: { id: true, applicationNumber: true } },
  payout: { select: { id: true, payoutNumber: true } },
  ticket: { select: { id: true, ticketNumber: true } },
} satisfies Prisma.NotificationInclude;

function serializeNotification<T extends Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>>(notification: T) {
  const resource = notification.ticket
    ? { type: 'ticket', id: notification.ticket.id, label: notification.ticket.ticketNumber }
    : notification.payout
      ? { type: 'payout', id: notification.payout.id, label: notification.payout.payoutNumber }
      : notification.application
        ? { type: 'application', id: notification.application.id, label: notification.application.applicationNumber }
        : notification.lead
          ? { type: 'lead', id: notification.lead.id, label: notification.lead.id }
          : null;
  return { ...notification, resource };
}

export async function listNotifications(userId: string, query: NotificationListQuery) {
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: userId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
    ...(query.applicationId ? { applicationId: query.applicationId } : {}),
    ...(query.payoutId ? { payoutId: query.payoutId } : {}),
    ...(query.ticketId ? { ticketId: query.ticketId } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
    ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { body: { contains: query.search, mode: 'insensitive' } }] } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where, include: notificationInclude, orderBy: { [query.sortBy]: query.sortOrder }, skip, take: query.pageSize }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { recipientUserId: userId, isRead: false } }),
  ]);
  return {
    items: items.map(serializeNotification),
    unread,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function updateNotificationRead(id: string, userId: string, isRead: boolean) {
  const changed = await prisma.notification.updateMany({
    where: { id, recipientUserId: userId },
    data: { isRead, readAt: isRead ? new Date() : null },
  });
  if (changed.count !== 1) throw notFound('Notification not found');
  return serializeNotification(await prisma.notification.findUniqueOrThrow({ where: { id }, include: notificationInclude }));
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { recipientUserId: userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: result.count };
}
