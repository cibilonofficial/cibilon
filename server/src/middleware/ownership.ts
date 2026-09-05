import type { Request } from 'express';
import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../common/errors.js';

type OwnerResolver = (req: Request) => Promise<string | null>;

interface OwnershipOptions {
  resolveAdvisorId: OwnerResolver;
  bypassPermissions?: string[];
}

/**
 * Reusable ownership guard for advisor-scoped domain routes added in later phases.
 * The resolver must obtain the authoritative owner from the database, never request input.
 */
export const requireAdvisorOwnership = ({
  resolveAdvisorId,
  bypassPermissions = [],
}: OwnershipOptions): RequestHandler => async (req, _res, next) => {
  if (!req.user) {
    next(unauthorized());
    return;
  }

  if (bypassPermissions.some((permission) => req.user?.permissions.includes(permission))) {
    next();
    return;
  }

  const resourceAdvisorId = await resolveAdvisorId(req);
  if (!req.user.advisorId || !resourceAdvisorId || req.user.advisorId !== resourceAdvisorId) {
    next(forbidden('You cannot access data owned by another advisor'));
    return;
  }

  next();
};
