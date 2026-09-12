import 'dotenv/config';

// Core Module
import {
  dbConnection,
  closeDbConnection,
} from '../core/config/dbConnection.ts';
import { closeRedisConnection } from '../core/config/redisConnection.ts';
import { createLogger } from '../core/lib/logger.ts';

// System Module (Email)
import { emailWorker } from '../modules/system_module/worker/email.worker.ts';
import {
  closeEmailQueue,
  publishPendingEmailOutbox,
} from '../core/services/emailQueue.service.ts';


const log = createLogger('worker-runtime');
const EMAIL_OUTBOX_SWEEP_MS = 60_000;
let outboxSweepTimer: NodeJS.Timeout | undefined;

/**
 * Bootstraps the database connection and initializes all background workers.
 */
async function bootstrap() {
  try {
    await dbConnection();

    // Kickstart any emails that were left pending during a previous server restart
    await publishPendingEmailOutbox();
    outboxSweepTimer = setInterval(() => {
      void publishPendingEmailOutbox().catch((error) =>
        log.error({ error }, 'Failed to sweep pending email outbox events')
      );
    }, EMAIL_OUTBOX_SWEEP_MS);

    log.info('Background workers (Email) started successfully');
  } catch (error) {
    log.fatal({ error }, 'Failed to bootstrap background workers');
    process.exit(1);
  }
}

// Start the worker process
void bootstrap();

/**
 * Orchestrates a graceful shutdown of all workers, queues, and database connections.
 * This prevents active generation jobs from being corrupted if the server is restarted.
 */
const shutdown = async (signal: string): Promise<void> => {
  log.info(
    { signal },
    'Received shutdown signal, initiating graceful shutdown...'
  );

  try {
    if (outboxSweepTimer) clearInterval(outboxSweepTimer);
    // 1. Stop accepting new jobs
    await closeEmailQueue();

    // 2. Wait for active jobs to finish, then close workers
    await emailWorker.close();

    // 3. Sever database connections
    await closeRedisConnection();
    await closeDbConnection();

    log.info('Worker shutdown complete. Exiting process safely.');
    process.exit(0);
  } catch (error) {
    log.error({ error }, 'Error occurred during worker shutdown');
    process.exit(1);
  }
};

// --- Process Lifecycle Event Listeners ---

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception in worker process');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'Unhandled promise rejection in worker process');
  process.exit(1);
});
