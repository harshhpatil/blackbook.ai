import { Redis } from 'ioredis';
import { env } from './env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('redis');

// performing singleton pattern for redis connection to avoid multiple connections and improve performance
let redisConnection: Redis | undefined;
let bullRedisConnection: Redis | undefined;

// function to get the redis connection instance
export const getRedisConnection = (): Redis => {
  // checking if the redis connection is established and returnin if it is
  if (redisConnection) return redisConnection;

  redisConnection = new Redis(env.REDIS_URL, {
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  }); // creating new redis instance with options

  // adding event listeners for redis connection events
  redisConnection.on('connect', () => {
    log.info('redis connected');
  });

  redisConnection.on('error', (err) => {
    log.error({ err }, 'redis connection error');
    throw new Error('redis connection error:', { cause: err });
  });

  // returning the redis connection instance
  return redisConnection;
};

// function to get the redis connection instance for bullmq
export const getBullRedisConnection = (): Redis => {
  // checking if the bullmq redis connection is established and returning if it is
  if (bullRedisConnection) return bullRedisConnection;

  bullRedisConnection = new Redis(env.REDIS_URL, {
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  }); // creating new redis instance for bullmq with options

  // adding event listeners for bullmq redis connection events
  bullRedisConnection.on('connect', () => {
    log.info('bullmq redis connected');
  });

  bullRedisConnection.on('error', (err) => {
    log.error({ err }, 'bullmq redis connection error');
  });

  // returning the bullmq redis connection instance
  return bullRedisConnection;
};

// function to check if the redis connection is in ready state or not
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    // pinging the redis server to check if the connection is established and returning true if it is
    await getRedisConnection().ping();
    return true;
  } catch {
    // returning false if the redis connection is not established
    return false;
  }
};

// function to close the redis connection
export const closeRedisConnection = async (): Promise<void> => {
  // checking if the redis connection is established and returning if it is not if established, closing the redis connection and setting the redis connection instance to undefined
  if (!redisConnection) return;
  await redisConnection.quit();
  redisConnection = undefined;
  log.info('redis connection closed');

  if (bullRedisConnection) {
    await bullRedisConnection.quit();
    bullRedisConnection = undefined;
    log.info('bullmq redis connection closed');
  }
};
