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
  // connecting to the mongodb database before starting the server and starting the server when connected
  await dbConnection();

  server = app.listen(env.PORT, () => {
    console.log(`server is running on port ${env.PORT} in ${env.NODE_ENV} mode..!!`);
  });
};

// function to shutdown the server
const shutdown = async (signal: string): Promise<void> => {
  console.log(`received ${signal}, shutting down api..!!`);

  // closing the server if it is running
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  // closing the email queue, redis connection and mongodb connection before exiting the process
  await closeEmailQueue();
  await closeRedisConnection();
  await closeDbConnection();
  process.exit(0);
};

// adding event listeners for process signals to gracefully shutdown the server
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// starting the server and catching any errors during startup
startServer().catch((err) => {
  const message = err instanceof Error ? err.message : 'unknown startup error';
  console.error('failed to start server', { message });
  process.exit(1);
});
