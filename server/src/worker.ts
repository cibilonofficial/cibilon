import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { processNextExportJob } from './modules/reports/export.worker.js';

let stopping = false;

async function run() {
  logger.info({ pollMs: env.EXPORT_JOB_POLL_MS }, 'Cibilon export worker started');
  while (!stopping) {
    try {
      const processed = await processNextExportJob();
      if (!processed) await new Promise((resolve) => setTimeout(resolve, env.EXPORT_JOB_POLL_MS));
    } catch (error) {
      logger.error({ err: error }, 'Export worker poll failed');
      await new Promise((resolve) => setTimeout(resolve, env.EXPORT_JOB_POLL_MS));
    }
  }
  await prisma.$disconnect();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { stopping = true; });
}

run().catch((error) => {
  logger.fatal({ err: error }, 'Export worker stopped unexpectedly');
  process.exitCode = 1;
});
