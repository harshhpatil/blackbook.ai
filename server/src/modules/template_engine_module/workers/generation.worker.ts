import { ConnectionOptions, Job, Worker } from 'bullmq';
import { getBullRedisConnection } from '../../../core/config/redisConnection.ts';
import { createLogger } from '../../../core/lib/logger.ts';
import { GenerationQueuePayload } from '../services/generationQueue.service.ts';
import { processGenerationJob } from '../services/generation.service.ts';

const log = createLogger('generation-worker');

/**
 * @constant {Worker<GenerationQueuePayload>} generationWorker
 * @description Background BullMQ worker that processes heavy AI document generation tasks.
 * Concurrency is capped at 2 to protect server memory and CPU during LibreOffice PDF exports.
 */
export const generationWorker = new Worker<GenerationQueuePayload>(
  'generationQueue',
  async (job: Job<GenerationQueuePayload>) => {
    log.info({ jobId: job.id, generationJobId: job.data.generationJobId }, 'Starting generation job processing');
    await processGenerationJob(job.data.generationJobId);
  },
  {
    // Double-cast to bypass potential pnpm ioredis version mismatch types
    connection: getBullRedisConnection() as unknown as ConnectionOptions,
    concurrency: 2,
  }
);

// --- Worker Event Listeners ---

generationWorker.on('completed', (job) => {
  log.info({ jobId: job.id, generationJobId: job.data.generationJobId }, 'Generation job completed successfully');
});

generationWorker.on('failed', (job, err) => {
  log.error({ err, jobId: job?.id, attemptsMade: job?.attemptsMade }, 'Generation job attempt failed');

  // If all retry attempts have been exhausted, log the permanent failure
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;

  log.warn(
    { generationJobId: job.data.generationJobId }, 
    'Job permanently failed after exhausting all retries'
  );
});

// Graceful shutdown listener
process.on('SIGINT', async () => {
  await generationWorker.close();
  log.info('Generation worker shut down gracefully');
});