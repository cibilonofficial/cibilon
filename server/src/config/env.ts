import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const optionalString = (schema: z.ZodString) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const originList = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
  .pipe(z.array(z.url()).min(1));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optionalString(z.string().url()),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  DATABASE_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(10_000),
  FRONTEND_ORIGIN: originList.prefault('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  JWT_ISSUER: z.string().min(1).default('cibilon-api'),
  JWT_AUDIENCE: z.string().min(1).default('cibilon-web'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  REFRESH_COOKIE_NAME: z.string().min(1).default('cibilon_refresh'),
  REFRESH_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  COOKIE_SECURE: booleanFromString,
  TRUST_PROXY: booleanFromString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(100_000).default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(900_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(5).max(10_000).default(50),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(3).max(1_000).default(10),
  METRICS_TOKEN: optionalString(z.string().min(32).max(256)),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  DATA_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, 'DATA_ENCRYPTION_KEY must be a 32-byte hexadecimal key'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: z.string().min(1).default('./storage/documents'),
  DOCUMENT_ENCRYPTION_KEY: optionalString(
    z.string().regex(/^[a-fA-F0-9]{64}$/, 'DOCUMENT_ENCRYPTION_KEY must be a 32-byte hexadecimal key'),
  ),
  EXPORT_STORAGE_PATH: z.string().min(1).default('./storage/exports'),
  EXPORT_JOB_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(2000),
  MAX_DOCUMENT_SIZE_BYTES: z.coerce.number().int().min(1024).max(50 * 1024 * 1024).default(10 * 1024 * 1024),
  S3_ENDPOINT: optionalString(z.string().url()),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: optionalString(z.string().min(1)),
  S3_ACCESS_KEY_ID: optionalString(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optionalString(z.string().min(1)),
  S3_KMS_KEY_ID: optionalString(z.string().min(1)),
  S3_FORCE_PATH_STYLE: booleanFromString,
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
}).superRefine((value, context) => {
  if (value.STORAGE_DRIVER === 's3') {
    for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
      if (!value[key]) {
        context.addIssue({ code: 'custom', path: [key], message: `${key} is required for S3 storage` });
      }
    }
  }
  if (value.REFRESH_COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'SameSite=None cookies must be secure' });
  }
  if (value.NODE_ENV !== 'production') return;
  if (!value.COOKIE_SECURE) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE must be true in production' });
  }
  if (!value.METRICS_TOKEN) {
    context.addIssue({ code: 'custom', path: ['METRICS_TOKEN'], message: 'METRICS_TOKEN is required in production' });
  }
  if (!value.DOCUMENT_ENCRYPTION_KEY) {
    context.addIssue({ code: 'custom', path: ['DOCUMENT_ENCRYPTION_KEY'], message: 'A separate document encryption key is required in production' });
  }
  if (!value.DIRECT_URL) {
    context.addIssue({ code: 'custom', path: ['DIRECT_URL'], message: 'DIRECT_URL is required for production migrations and backups' });
  }
  if (value.JWT_ACCESS_SECRET.toLowerCase().includes('replace')) {
    context.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'A non-placeholder JWT secret is required in production' });
  }
  for (const origin of value.FRONTEND_ORIGIN) {
    if (!origin.startsWith('https://')) {
      context.addIssue({ code: 'custom', path: ['FRONTEND_ORIGIN'], message: 'Production frontend origins must use HTTPS' });
    }
  }
});

export function parseEnvironment(source: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return parsed.data;
}

export const env = parseEnvironment(process.env);
