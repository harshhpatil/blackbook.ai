import mongoose from 'mongoose';
import { env } from './env.ts';

// function to connect to the mongodb database
export const dbConnection = async () => {
  // checking if the database is already connected to avoid multiple connections and returing if already connected
  if (mongoose.connection.readyState === 1) {
    console.log('mongodb is already connected.');
    return;
  }

  // connecting to the mongodb using the connection string from the env variables and logging the host of the connected database
  const conn = await mongoose.connect(env.MONGO_URI);
  console.log(`mongodb connected: ${conn.connection.host}`);
};

// function to close the mongodb connection
export const closeDbConnection = async (): Promise<void> => {
  await mongoose.connection.close(); // closing the mongodb connection
};

// function to check if the mongodb connection is in ready state or not
export const isDbReady = (): boolean => {
  return mongoose.connection.readyState === 1;
};
