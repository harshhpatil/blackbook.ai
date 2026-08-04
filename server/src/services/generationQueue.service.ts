import { ConnectionOptions, Queue } from 'bullmq';
import { getBullRedisConnection } from '../config/redisConnection.ts';

export interface GenerationQueuePayload { generationJobId: string }

let generationQueue: Queue<GenerationQueuePayload> | undefined;

export const getGenerationQueue = (): Queue<GenerationQueuePayload> => {
  generationQueue ??= new Queue<GenerationQueuePayload>('generationQueue', {
    connection: getBullRedisConnection() as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1_000 },
    },
  });
  return generationQueue;
};

export const enqueueGeneration = async (generationJobId: string): Promise<void> => {
  await getGenerationQueue().add('generate-document', { generationJobId }, { jobId: generationJobId });
};

export const closeGenerationQueue = async (): Promise<void> => {
  await generationQueue?.close();
  generationQueue = undefined;
};
