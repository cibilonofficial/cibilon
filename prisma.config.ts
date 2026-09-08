import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? 'postgresql://cibilon:cibilon_dev_password@127.0.0.1:5432/cibilon?schema=public',
  },
});
