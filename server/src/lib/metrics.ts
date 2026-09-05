import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

const startedAt = Date.now();
let requestsTotal = 0;
let responsesTotal = 0;
let requestsInFlight = 0;
let durationTotalMs = 0;
const responsesByStatusClass: Record<string, number> = {};

export const metricsMiddleware: RequestHandler = (_req, res, next) => {
  const started = performance.now();
  requestsTotal += 1;
  requestsInFlight += 1;
  res.once('finish', () => {
    requestsInFlight = Math.max(0, requestsInFlight - 1);
    responsesTotal += 1;
    durationTotalMs += performance.now() - started;
    const bucket = `${Math.floor(res.statusCode / 100)}xx`;
    responsesByStatusClass[bucket] = (responsesByStatusClass[bucket] ?? 0) + 1;
  });
  next();
};

export function metricsSnapshot() {
  return {
    process: {
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      memoryBytes: process.memoryUsage(),
    },
    http: {
      requestsTotal,
      requestsInFlight,
      responsesByStatusClass: { ...responsesByStatusClass },
      averageDurationMs: responsesTotal === 0 ? 0 : Number((durationTotalMs / responsesTotal).toFixed(2)),
    },
    timestamp: new Date().toISOString(),
  };
}

function tokenMatches(candidate: string | undefined) {
  if (!env.METRICS_TOKEN || !candidate) return false;
  const expected = Buffer.from(env.METRICS_TOKEN);
  const supplied = Buffer.from(candidate);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export const requireMetricsToken: RequestHandler = (req, res, next) => {
  if (!env.METRICS_TOKEN) {
    res.status(503).json({ error: { code: 'METRICS_DISABLED', message: 'Metrics access is not configured', requestId: req.id } });
    return;
  }
  if (!tokenMatches(req.header('x-metrics-token'))) {
    res.status(401).json({ error: { code: 'METRICS_UNAUTHENTICATED', message: 'A valid metrics token is required', requestId: req.id } });
    return;
  }
  next();
};
