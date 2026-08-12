import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('redis');

let redisConnection: Redis | undefined;
let bullRedisConnection: Redis | undefined;

/**
 * Common configuration options for Redis instances.
 * Supports secure rediss:// (TLS) connection strings for Cloud Redis.
 */
const baseOptions: RedisOptions = {
  connectTimeout: 5000,
  commandTimeout: 5000,
  lazyConnect: true,
  // Enables TLS automatically when connecting to Cloud Redis (rediss://)
  tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
};

/**
 * Gets or creates primary redis instance for caching and session storage.
 */
export const getRedisConnection = (): Redis => {
  if (redisConnection) return redisConnection;

  redisConnection = new Redis(env.REDIS_URL, {
    ...baseOptions,
    maxRetriesPerRequest: 3,
  });

  redisConnection.on('connect', () => {
    log.info('redis connected');
  });

  redisConnection.on('error', (err) => {
    log.error({ err }, 'redis client connection error');
  });

  return redisConnection;
};

/**
 * Gets or creates a dedicated Redis client instance for BullMQ queues.
 * BullMQ requires maxRetriesPerRequest to be null and enableReadyCheck to be false.
 */
export const getBullRedisConnection = (): Redis => {
  if (bullRedisConnection) return bullRedisConnection;

  bullRedisConnection = new Redis(env.REDIS_URL, {
    ...baseOptions,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  bullRedisConnection.on('connect', () => {
    log.info('bullmq redis client connected');
  });

  bullRedisConnection.on('error', (err) => {
    log.error({ err }, 'bullmq redis client connection error');
  });

  // returning the bullmq redis connection instance
  return bullRedisConnection;
};

/**
 * Checks the operational health of the primary Redis connection.
 *
 * @returns {Promise<boolean>} True if the Redis server responds to a PING.
 */
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    const client = getRedisConnection();

    // explicitly connect if the lazy connect prvented initial connection
    if (client.status === 'wait') {
      await client.connect();
    }

    await client.ping();
    return true;
  } catch (err) {
    log.error({ err }, 'redis health check failed');
    return false;
  }
};

/**
 * Gracefully closes all active Redis connection pools.
 * Should be invoked during server shutdown.
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = undefined;
    log.info('primary redis connection closed');
  }

  if (bullRedisConnection) {
    await bullRedisConnection.quit();
    bullRedisConnection = undefined;
    log.info('bullmq redis connection closed');
  }
};
