import 'dotenv/config';
import http from 'node:http';
import app from './app.ts';
import { dbConnection, closeDbConnection } from './config/dbConnection.ts';
import { closeRedisConnection } from './config/redisConnection.ts';
import { closeEmailQueue } from './services/emailQueue.service.ts';
import { env } from './config/env.ts';

let server: http.Server;

// function to start the server
const startServer = async () => {
  await dbConnection();
  server = app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
  });
};

const shutdown = async (signal: string): Promise<void> => {
  console.log(`Received ${signal}. Shutting down API...`);

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

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

startServer().catch((err) => {
  const message = err instanceof Error ? err.message : 'unknown startup error';
  console.error('failed to start server', { message });
  process.exit(1);
});
