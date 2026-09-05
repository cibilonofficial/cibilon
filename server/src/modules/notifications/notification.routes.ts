import { Router } from 'express';
import { stringParam } from '../../common/request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
  updateNotificationReadSchema,
} from './notification.schemas.js';
import {
  listNotifications,
  markAllNotificationsRead,
  updateNotificationRead,
} from './notification.service.js';

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get('/', validate({ query: notificationListQuerySchema }), async (req, res) => {
  const result = await listNotifications(req.user!.id, notificationListQuerySchema.parse(req.query));
  res.json({ data: result.items, unread: result.unread, pagination: result.pagination });
});

notificationRouter.patch('/read-all', async (req, res) => {
  res.json({ data: await markAllNotificationsRead(req.user!.id) });
});

notificationRouter.patch(
  '/:id',
  validate({ params: notificationIdParamsSchema, body: updateNotificationReadSchema }),
  async (req, res) => {
    const input = updateNotificationReadSchema.parse(req.body);
    res.json({ data: await updateNotificationRead(stringParam(req, 'id'), req.user!.id, input.isRead) });
  },
);
