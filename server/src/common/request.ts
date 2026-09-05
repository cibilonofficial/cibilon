import type { Request } from 'express';
import { badRequest } from './errors.js';

export function stringParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') throw badRequest(`Route parameter ${name} is required`);
  return value;
}
