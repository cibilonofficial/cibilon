import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';

function rateLimitHandler(code: string, message: string) {
  return (req: Request, res: Response) => {
    req.log.warn({ securityEvent: code, requestId: req.id, ip: req.ip }, message);
    res.status(429).json({ error: { code, message, requestId: req.id } });
  };
}

export const globalRateLimiter = rateLimit({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  limit: env.GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/v1/health'),
  handler: rateLimitHandler('RATE_LIMITED', 'Too many requests. Please try again later.'),
});

export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rateLimitHandler('AUTH_RATE_LIMITED', 'Too many authentication requests. Please try again later.'),
});

export const loginRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler('LOGIN_THROTTLED', 'Too many failed login attempts. Please try again later.'),
});
