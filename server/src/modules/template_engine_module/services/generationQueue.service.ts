import { ConnectionOptions, Queue } from 'bullmq';
import { getBullRedisConnection } from '../../../core/config/redisConnection.ts';

/**
 * @interface GenerationQueuePayload
 * @description The payload structure passed to the generation worker queue.
 */
export interface GenerationQueuePayload {
  generationJobId: string;
}

let generationQueue: Queue<GenerationQueuePayload> | undefined;

/**
 * @function getGenerationQueue
 * @description Singleton factory function for the BullMQ generation queue.
 * Configures default job options including exponential backoffs and automated cleanup.
 * 
 * @returns {Queue<GenerationQueuePayload>} The initialized BullMQ Queue instance.
 */
export const getGenerationQueue = (): Queue<GenerationQueuePayload> => {
  generationQueue ??= new Queue<GenerationQueuePayload>('generationQueue', {
    // Double-cast to bypass potential pnpm ioredis version mismatch types
    connection: getBullRedisConnection() as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 }, // Retain failed jobs for 7 days for debugging
    },
  });
  return generationQueue;
};

/**
 * @function enqueueGeneration
 * @description Enqueues a new background document generation task using the generationJobId as a unique jobId 
 * to prevent duplicate concurrent queue entries.
 * 
 * @param {string} generationJobId - The MongoDB ID of the generation job.
 * @returns {Promise<void>}
 */
export const enqueueGeneration = async (generationJobId: string): Promise<void> => {
  await getGenerationQueue().add(
    'generate-document', 
    { generationJobId }, 
    { jobId: generationJobId }
  );
};

/**
 * @function closeGenerationQueue
 * @description Gracefully closes the generation queue connection.
 * @returns {Promise<void>}
 */
export const closeGenerationQueue = async (): Promise<void> => {
  await generationQueue?.close();
  generationQueue = undefined;
};