import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('redis');

let redisConnection: Redis | undefined;
let rateLimitRedisConnection: Redis | undefined;
let bullRedisConnection: Redis | undefined;

const cloudRetryStrategy = (attempt: number): number => {
  const maxDelay = env.REDIS_RETRY_MAX_DELAY_MS || 3000;
  const exponentialDelay = Math.min(
    250 * 2 ** Math.min(attempt - 1, 8),
    maxDelay
  );
  return exponentialDelay + Math.floor(Math.random() * 250);
};

const redisUrl = new URL(env.REDIS_URL);
const isTls = redisUrl.protocol === 'rediss:';

/** Shared safe transport settings for a managed Cloud Redis service. */
const baseOptions: RedisOptions = {
  connectTimeout: 20000,
  keepAlive: 30000,
  enableOfflineQueue: true, // Must be true so commands queue during handshakes
  enableReadyCheck: true,
  tls: isTls
    ? {
        rejectUnauthorized: false,
        servername: redisUrl.hostname, // <--- Required for Cloud SNI routing
      }
    : undefined,  
  retryStrategy: cloudRetryStrategy,
  reconnectOnError(err: Error) {
    return err.message.includes('READONLY');
  },
};

const createClient = (name: string, options: RedisOptions): Redis => {
  const client = new Redis(env.REDIS_URL, {
    ...baseOptions,
    // Do NOT set connectionName here — Cloud Redis (Upstash) rejects CLIENT SETNAME
    ...options,
  });

  client.on('connect', () => log.info({ name }, 'redis connected'));
  client.on('ready', () => log.info({ name }, 'redis ready'));
  client.on('reconnecting', (delay: number) =>
    log.warn({ name, delay }, 'redis reconnecting')
  );
  client.on('error', (err) =>
    log.error({ err, name }, 'redis client connection error')
  );

  return client;
};

/** Primary redis instance for caching and session storage */
export const getRedisConnection = (): Redis => {
  if (redisConnection) return redisConnection;

  redisConnection = createClient('application', {
    commandTimeout: env.REDIS_COMMAND_TIMEOUT_MS || 5000,
    maxRetriesPerRequest: 4,
  });

  return redisConnection;
};

/** Dedicated client for express-rate-limit */
export const getRateLimitRedisConnection = (): Redis => {
  if (rateLimitRedisConnection) return rateLimitRedisConnection;

  rateLimitRedisConnection = createClient('rate-limit', {
    enableOfflineQueue: true, // Allow brief queuing during reconnect
    commandTimeout: env.REDIS_RATE_LIMIT_COMMAND_TIMEOUT_MS || 3000,
    maxRetriesPerRequest: 3, // Headroom for internet latency
  });

  return rateLimitRedisConnection;
};

/** Dedicated client for BullMQ */
export const getBullRedisConnection = (): Redis => {
  if (bullRedisConnection) return bullRedisConnection;

  bullRedisConnection = createClient('bullmq', {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    enableOfflineQueue: true,
    commandTimeout: undefined, // Never timeout blocking queue reads
  });

  return bullRedisConnection;
};

export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    const client = getRedisConnection();
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

/** Safe shutdown helper that won't crash if disconnected */
const safeClose = async (client: Redis | undefined, name: string) => {
  if (!client) return;
  try {
    if (client.status === 'ready') {
      await client.quit();
    } else {
      client.disconnect();
    }
    log.info(`${name} redis connection closed`);
  } catch (err) {
    client.disconnect();
  }
};

export const closeRedisConnection = async (): Promise<void> => {
  await Promise.allSettled([
    safeClose(redisConnection, 'application'),
    safeClose(rateLimitRedisConnection, 'rate-limit'),
    safeClose(bullRedisConnection, 'bullmq'),
  ]);
  redisConnection = undefined;
  rateLimitRedisConnection = undefined;
  bullRedisConnection = undefined;
};
