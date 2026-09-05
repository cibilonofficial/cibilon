import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../common/errors.js';

interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export const validate = (schemas: RequestSchemas): RequestHandler => (req, _res, next) => {
  const issues: unknown[] = [];

  for (const key of ['body', 'params', 'query'] as const) {
    const schema = schemas[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      issues.push(...result.error.issues.map((issue) => ({ location: key, ...issue })));
    }
  }

  if (issues.length > 0) {
    next(new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', issues));
    return;
  }

  next();
};
