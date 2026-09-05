import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Client } from 'pg';

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL or DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  const current = decodeURIComponent(url.pathname.slice(1));
  url.pathname = `/${current}_test`;
  return url.toString();
}

const databaseUrl = testDatabaseUrl();
const parsed = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
if (!/^[A-Za-z0-9_]+_test$/.test(databaseName)) {
  throw new Error(`Refusing to reset database '${databaseName}'; test database names must end in _test`);
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = '/postgres';
const maintenance = new Client({ connectionString: maintenanceUrl.toString() });
await maintenance.connect();
const exists = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
if (exists.rowCount === 0) await maintenance.query(`CREATE DATABASE "${databaseName}"`);
await maintenance.end();

const testClient = new Client({ connectionString: databaseUrl });
await testClient.connect();
await testClient.query('DROP SCHEMA IF EXISTS public CASCADE');
await testClient.query('CREATE SCHEMA public');
await testClient.end();

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');
const childEnv = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  SEED_DEFAULT_PASSWORD: process.env.TEST_SEED_PASSWORD ?? 'Cibilon@Test123!',
  PATH: `${path.resolve('node_modules/.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
};
for (const args of [['prisma', 'migrate', 'deploy'], ['prisma', 'db', 'seed']]) {
  const result = spawnSync(process.execPath, [prismaCli, ...args.slice(1)], { env: childEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
