import mongoose from 'mongoose';
import { env } from './env.ts';

export const dbConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log('mongodb is already connected.');
    return;
  }

  const conn = await mongoose.connect(env.mongoUri);
  console.log(`mongodb connected: ${conn.connection.host}`);
};

export const closeDbConnection = async (): Promise<void> => {
  await mongoose.connection.close();
};

export const isDbReady = (): boolean => {
  return mongoose.connection.readyState === 1;
};
