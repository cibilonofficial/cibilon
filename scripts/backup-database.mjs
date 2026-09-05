import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DIRECT_URL or DATABASE_URL is required');
const database = new URL(connectionString);
const databaseName = decodeURIComponent(database.pathname.slice(1));
if (!databaseName || !database.hostname || !database.username) throw new Error('DATABASE_URL is incomplete');

const root = path.resolve(process.env.DATABASE_BACKUP_DIR ?? './backups/database');
await mkdir(root, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, `${databaseName}-${timestamp}.dump`);
const command = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
const args = [
  '--format=custom', '--no-owner', '--no-acl', '--compress=9',
  '--host', database.hostname, '--port', database.port || '5432',
  '--username', decodeURIComponent(database.username), '--dbname', databaseName,
  '--file', output,
];
const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: { ...process.env, PGPASSWORD: decodeURIComponent(database.password) },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Database backup created: ${output}`);
