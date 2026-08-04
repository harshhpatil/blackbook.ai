import mongoose from 'mongoose';
import { env } from './env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('mongodb');

// function to connect to the mongodb database
export const dbConnection = async () => {
  // checking if the database is already connected to avoid multiple connections and returing if already connected
  if (mongoose.connection.readyState === 1) {
    log.debug('mongodb connection already established');
    return;
  }

  // connecting to the mongodb using the connection string from the env variables and logging the host of the connected database
  const conn = await mongoose.connect(env.MONGO_URI);
  log.info({ host: conn.connection.host }, 'mongodb connected');
};

// function to close the mongodb connection
export const closeDbConnection = async (): Promise<void> => {
  await mongoose.connection.close(); // closing the mongodb connection
  log.info('mongodb connection closed');
};

// function to check if the mongodb connection is in ready state or not
export const isDbReady = (): boolean => {
  return mongoose.connection.readyState === 1;
};
