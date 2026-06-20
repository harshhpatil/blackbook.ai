import { Redis } from 'ioredis';
import { env } from './env.ts';

let redisConnection: Redis | undefined;
let bullRedisConnection: Redis | undefined;

export const getRedisConnection = (): Redis => {
  if (redisConnection) return redisConnection;

  redisConnection = new Redis(env.redisUrl, {
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redisConnection.on('connect', () => {
    console.log('Connected to Redis successfully.');
  });

  redisConnection.on('error', (err) => {
    console.error('Redis connection error:', { message: err.message });
  });

  return redisConnection;
};

export const getBullRedisConnection = (): Redis => {
  if (bullRedisConnection) return bullRedisConnection;

  bullRedisConnection = new Redis(env.redisUrl, {
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  bullRedisConnection.on('error', (err) => {
    console.error('BullMQ Redis connection error:', { message: err.message });
  });

  return bullRedisConnection;
};

export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    await getRedisConnection().ping();
    return true;
  } catch {
    return false;
  }
};

export const closeRedisConnection = async (): Promise<void> => {
  if (!redisConnection) return;
  await redisConnection.quit();
  redisConnection = undefined;

  if (bullRedisConnection) {
    await bullRedisConnection.quit();
    bullRedisConnection = undefined;
  }
};
