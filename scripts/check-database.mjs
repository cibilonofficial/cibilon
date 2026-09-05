import 'dotenv/config';
import { Client } from 'pg';

const runtimeUrl = process.env.DATABASE_URL;
if (!runtimeUrl) throw new Error('DATABASE_URL is required');

async function inspect(label, connectionString) {
  const parsed = new URL(connectionString);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECT_TIMEOUT_MS ?? 10_000),
  });
  await client.connect();
  try {
    const connection = await client.query(`
      SELECT current_database() AS database,
             current_schema() AS schema,
             current_setting('server_version') AS version,
             current_setting('ssl', true) AS "backendSsl"
    `);
    const migrationsTable = await client.query("SELECT to_regclass('_prisma_migrations') AS table_name");
    let migrations = null;
    let users = null;
    if (migrationsTable.rows[0]?.table_name) {
      migrations = Number((await client.query('SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count);
      users = Number((await client.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count);
    }
    return {
      label,
      host: parsed.hostname,
      port: parsed.port || '5432',
      pooled: parsed.hostname.includes('-pooler'),
      sslMode: parsed.searchParams.get('sslmode') ?? 'unset',
      channelBinding: parsed.searchParams.get('channel_binding') ?? 'unset',
      ...connection.rows[0],
      appliedMigrations: migrations,
      users,
    };
  } finally {
    await client.end();
  }
}

const results = [await inspect('runtime', runtimeUrl)];
if (process.env.DIRECT_URL && process.env.DIRECT_URL !== runtimeUrl) {
  results.push(await inspect('direct', process.env.DIRECT_URL));
}
console.log(JSON.stringify({ status: 'ok', connections: results }, null, 2));
