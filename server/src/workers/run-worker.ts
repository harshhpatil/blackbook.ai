import 'dotenv/config';
import { emailWorker } from './email.worker.ts';
import { closeRedisConnection } from '../config/redisConnection.ts';
import {
  closeEmailQueue,
  publishPendingEmailOutbox,
} from '../services/emailQueue.service.ts';
import { dbConnection, closeDbConnection } from '../config/dbConnection.ts';

await dbConnection();
await publishPendingEmailOutbox();

console.log('Email worker started...');

const shutdown = async (signal: string): Promise<void> => {
  console.log(`Received ${signal}. Shutting down email worker...`);
  await emailWorker.close();
  await closeEmailQueue();
  await closeRedisConnection();
  await closeDbConnection();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
