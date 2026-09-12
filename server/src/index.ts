import 'dotenv/config';
import http from 'node:http';
import app from './app.ts';
import { dbConnection, closeDbConnection } from './core/config/dbConnection.ts';
import { closeRedisConnection } from './core/config/redisConnection.ts';
import { closeEmailQueue } from './core/services/emailQueue.service.ts';
import { env } from './core/config/env.ts';
import { createLogger } from './core/lib/logger.ts';
import { verifyEmailConnection } from './core/utils/email.ts';

// implementing logger here
const log = createLogger('api');

let server: http.Server;

// function to start the server
const startServer = async () => {
  await dbConnection(); // connecting to the database

  try {
    await verifyEmailConnection(); // verifying the email service connection
    log.info('email service verified');
  } catch (err) {
    log.fatal({ err }, 'email service verification failed');
    process.exit(1);
  }

  server = app.listen(env.PORT, () => {
    console.log(env.PORT);
    log.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, 'server started');
  });

  // Keep HTTP server connections alive during multi-stage AI generation (up to 3 minutes)
  server.headersTimeout = 180_000;
  server.requestTimeout = 180_000;
  server.keepAliveTimeout = 65_000;
};

// function to shutdown the server
const shutdown = async (signal: string): Promise<void> => {
  log.info({ signal }, 'received shutdown signal, starting graceful shutdown');

  // Fallback timeout: Force shutdown if it takes longer than 10 seconds
  const forceShutdown = setTimeout(() => {
    log.fatal('shutdown taking too long, forcefully exiting');
    process.exit(1);
  }, 10000).unref();

  try {
    // closing the server if it is running
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      log.info('HTTP server closed');
    }

    // closing the email queue, redis connection and mongodb connection
    await closeEmailQueue();
    await closeRedisConnection();
    await closeDbConnection();

    log.info('api shutdown complete');
    clearTimeout(forceShutdown);
    process.exit(0);
  } catch (err) {
    log.error({ err }, 'error during shutdown');
    process.exit(1);
  }
};

// adding event listeners for process signals
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Route global errors through the graceful shutdown process to prevent orphaned connections
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaught exception');
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'unhandled promise rejection');
  void shutdown('unhandledRejection');
});

// starting the server and catching any errors during startup
startServer().catch((err) => {
  log.fatal({ err }, 'failed to start server');
  process.exit(1);
});
