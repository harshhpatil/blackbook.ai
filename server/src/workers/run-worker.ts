import 'dotenv/config';
import { emailWorker } from './email.worker.ts';
import { generationWorker } from './generation.worker.ts';
import { closeRedisConnection } from '../config/redisConnection.ts';
import {
  closeEmailQueue,
  publishPendingEmailOutbox,
} from '../services/emailQueue.service.ts';
import { closeGenerationQueue } from '../services/generationQueue.service.ts';
import { dbConnection, closeDbConnection } from '../config/dbConnection.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('email-worker-runtime');

await dbConnection();
await publishPendingEmailOutbox();

log.info('email worker started');

const shutdown = async (signal: string): Promise<void> => {
  log.info({ signal }, 'received shutdown signal');
  await emailWorker.close();
  await generationWorker.close();
  await closeEmailQueue();
  await closeGenerationQueue();
  await closeRedisConnection();
  await closeDbConnection();
  log.info('email worker shutdown complete');
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'unhandled promise rejection');
  process.exit(1);
});
