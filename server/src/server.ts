import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const server = createServer(createApp());

server.listen(env.API_PORT, env.API_HOST, () => {
  logger.info({ host: env.API_HOST, port: env.API_PORT }, 'Cibilon API started');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down Cibilon API');
  server.close(async (error) => {
    await prisma.$disconnect();
    if (error) {
      logger.error({ err: error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
