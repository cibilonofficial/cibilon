import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../common/errors.js';

export const requireRole = (...allowedRoles: string[]): RequestHandler => (req, _res, next) => {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (!req.user.roles.some((role) => allowedRoles.includes(role))) {
    next(forbidden());
    return;
  }
  next();
};

export const requirePermission = (...requiredPermissions: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!requiredPermissions.every((permission) => req.user?.permissions.includes(permission))) {
      next(forbidden());
      return;
    }
    next();
  };

export const requireAnyPermission = (...allowedPermissions: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!allowedPermissions.some((permission) => req.user?.permissions.includes(permission))) {
      next(forbidden());
      return;
    }
    next();
  };
