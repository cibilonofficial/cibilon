#!/usr/bin/env node
/**
 * Resync seed-account password hashes to the current SEED_DEFAULT_PASSWORD.
 * Only touches the three demo accounts; all other profile data is left intact.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const SEED_EMAILS = ['admin@cibilon.in', 'advisor@cibilon.in', 'staff@cibilon.in'];

const { SEED_DEFAULT_PASSWORD, DIRECT_URL, DATABASE_URL } = process.env;
if (!SEED_DEFAULT_PASSWORD) throw new Error('SEED_DEFAULT_PASSWORD is not set');
const connectionString = DIRECT_URL ?? DATABASE_URL;
if (!connectionString) throw new Error('DIRECT_URL or DATABASE_URL is not set');

const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
const hash = await bcrypt.hash(SEED_DEFAULT_PASSWORD, rounds);

const client = new pg.Client({ connectionString });
await client.connect();

const { rows } = await client.query(
  `UPDATE users SET password_hash = $1
   WHERE email = ANY($2::text[])
   RETURNING email`,
  [hash, SEED_EMAILS],
);

await client.end();

if (rows.length === 0) {
  console.error('No seed accounts found — run db:seed first.');
  process.exitCode = 1;
} else {
  console.log(`Password hash updated for: ${rows.map((r) => r.email).join(', ')}`);
}
