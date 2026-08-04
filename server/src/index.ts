import 'dotenv/config';
import http from 'node:http';
import app from './app.ts';
import { dbConnection, closeDbConnection } from './config/dbConnection.ts';
import { closeRedisConnection } from './config/redisConnection.ts';
import { closeEmailQueue } from './services/emailQueue.service.ts';
import { env } from './config/env.ts';
import { createLogger } from './lib/logger.ts';

const log = createLogger('api');

let server: http.Server;

// function to start the server
const startServer = async () => {
  // connecting to the mongodb database before starting the server and starting the server when connected
  await dbConnection();

  server = app.listen(env.PORT, () => {
    log.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, 'server started');
  });
};

// function to shutdown the server
const shutdown = async (signal: string): Promise<void> => {
  log.info({ signal }, 'received shutdown signal');

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
  log.info('api shutdown complete');
  process.exit(0);
};

// adding event listeners for process signals to gracefully shutdown the server
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'unhandled promise rejection');
  process.exit(1);
});

// starting the server and catching any errors during startup
startServer().catch((err) => {
  log.fatal({ err }, 'failed to start server');
  process.exit(1);
});
