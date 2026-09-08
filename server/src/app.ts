import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { AppError } from './common/errors.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { metricsMiddleware, metricsSnapshot, requireMetricsToken } from './lib/metrics.js';
import { prisma } from './lib/prisma.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { globalRateLimiter } from './middleware/rate-limit.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { advisorRouter } from './modules/advisors/advisor.routes.js';
import { lenderRouter, productRouter } from './modules/catalog/catalog.routes.js';
import { rateCardRouter } from './modules/rate-card/rate-card.routes.js';
import { applicationRouter } from './modules/applications/application.routes.js';
import { customerRouter } from './modules/customers/customer.routes.js';
import { applicationDocumentRouter, documentRouter } from './modules/documents/document.routes.js';
import { leadRouter } from './modules/leads/lead.routes.js';
import { notificationRouter } from './modules/notifications/notification.routes.js';
import { payoutRouter } from './modules/payouts/payout.routes.js';
import { reportRouter } from './modules/reports/report.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { staffRouter } from './modules/staff/staff.routes.js';
import { supportRouter } from './modules/support/support.routes.js';

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const supplied = req.headers['x-request-id']?.toString();
        const requestId = supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
        res.setHeader('x-request-id', requestId);
        return requestId;
      },
      customSuccessMessage: (req, res) => `${req.method} ${req.url} completed with ${res.statusCode}`,
      customErrorMessage: (req, res) => `${req.method} ${req.url} failed with ${res.statusCode}`,
      serializers: {
        req: (req: { id?: string; method?: string; url?: string; remoteAddress?: string }) => ({
          id: req.id,
          method: req.method,
          path: req.url?.split('?')[0],
          remoteAddress: req.remoteAddress,
        }),
      },
    }),
  );
  app.use(metricsMiddleware);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.FRONTEND_ORIGIN.includes(origin)) return callback(null, true);
        callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }),
  );
  app.use('/api/v1', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(globalRateLimiter);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/v1/health/live', (_req, res) => {
    res.json({ data: { status: 'alive', uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() } });
  });

  const readinessHandler = async (req: express.Request, res: express.Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      logger.error({ err: error }, 'Readiness database check failed');
      res.status(503).json({ error: { code: 'NOT_READY', message: 'A required dependency is unavailable', requestId: req.id } });
      return;
    }
    res.json({
      data: {
        status: 'ok',
        database: 'connected',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  };
  app.get('/api/v1/health', readinessHandler);
  app.get('/api/v1/health/ready', readinessHandler);
  app.get('/api/v1/metrics', requireMetricsToken, (_req, res) => res.json({ data: metricsSnapshot() }));

  app.get('/api/v1/me', authenticate, (req, res) => {
    res.json({ data: req.user });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/advisors', advisorRouter);
  app.use('/api/v1/lenders', lenderRouter);
  app.use('/api/v1/products', productRouter);
  app.use('/api/v1/payout-rate-card', rateCardRouter);
  app.use('/api/v1/applications', applicationRouter);
  app.use('/api/v1/applications', applicationDocumentRouter);
  app.use('/api/v1/documents', documentRouter);
  app.use('/api/v1/customers', customerRouter);
  app.use('/api/v1/leads', leadRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/payouts', payoutRouter);
  app.use('/api/v1/reports', reportRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/staff', staffRouter);
  app.use('/api/v1/support', supportRouter);
  app.use('/api/v1/audit-logs', auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
