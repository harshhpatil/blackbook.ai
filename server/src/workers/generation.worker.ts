import { ConnectionOptions, Job, Worker } from 'bullmq';
import { getBullRedisConnection } from '../config/redisConnection.ts';
import { GenerationQueuePayload } from '../services/generationQueue.service.ts';
import { processGenerationJob } from '../services/generation.service.ts';
import { createLogger } from '../lib/logger.ts';
import { GenerationJob } from '../models/GenerationJob.model.ts';
import { refundGenerationCredits } from '../services/credit.service.ts';

const log = createLogger('generation-worker');

export const generationWorker = new Worker<GenerationQueuePayload>(
  'generationQueue',
  async (job: Job<GenerationQueuePayload>) => processGenerationJob(job.data.generationJobId),
  { connection: getBullRedisConnection() as ConnectionOptions, concurrency: 2 }
);

generationWorker.on('failed', (job, err) => {
  log.error({ err, jobId: job?.id }, 'generation job attempt failed');
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  void (async () => {
    const generationJob = await GenerationJob.findById(job.data.generationJobId);
    if (generationJob) await refundGenerationCredits(generationJob.user.toString(), generationJob._id.toString());
  })();
});
