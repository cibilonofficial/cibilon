import type { Request, RequestHandler } from 'express';
import { forbidden } from '../common/errors.js';

interface StaffAssignmentOptions {
  resolveAssignedStaffId: (req: Request) => Promise<string | null>;
}

/** Restrict staff sessions to the application currently assigned to them. */
export function requireStaffAssignment({
  resolveAssignedStaffId,
}: StaffAssignmentOptions): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user?.staffId || req.user.roles.includes('admin')) {
        next();
        return;
      }
      const assignedStaffId = await resolveAssignedStaffId(req);
      if (assignedStaffId !== req.user.staffId) {
        next(forbidden('This application is not assigned to you'));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
