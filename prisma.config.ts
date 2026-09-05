import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Client generation does not connect, so keep it usable before local .env setup.
    url:
      process.env.DIRECT_URL ?? process.env.DATABASE_URL ??
      'postgresql://cibilon:cibilon_dev_password@127.0.0.1:5433/cibilon?schema=public',
  },
});
