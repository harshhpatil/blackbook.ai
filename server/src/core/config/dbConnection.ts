import mongoose from 'mongoose';
import { env } from './env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('mongodb');

/**
 * Establishes a connection to the database.
 * Reuses the existing connection pool if active to prevent connection leaks
 * and port exhaustion in serverless or hot-reloading environments.
 */
export const dbConnection = async () => {
  // readyState 1 means 'connected'. Early return prevents overwriting the active pool.
  if (mongoose.connection.readyState === 1) {
    log.debug('mongodb connection already established');
    return;
  }

  const conn = await mongoose.connect(env.MONGO_URI);
  log.info({ host: conn.connection.host }, 'mongodb connected');
};

/**
 * Gracefully terminates the database connection pool.
 * Should be called during application shutdown or worker termination.
 */
export const closeDbConnection = async (): Promise<void> => {
  await mongoose.connection.close();
  log.info('mongodb connection closed');
};

/**
 * Checks the current health status of the database connection.
 *
 * @returns {boolean} True if the connection is active and ready for queries.
 */
export const isDbReady = (): boolean => {
  return mongoose.connection.readyState === 1;
};
