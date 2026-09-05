import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'cibilon-api', environment: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'currentPassword',
      'newPassword',
      'token',
      'accessToken',
      'refreshToken',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.token',
      '*.pan',
      '*.aadhaar',
      '*.accountNumber',
    ],
    censor: '[REDACTED]',
  },
});
