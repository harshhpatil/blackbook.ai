import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'node:crypto';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'docmorph-ai-server',
    env: process.env.NODE_ENV || 'development',
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      '*.apiKey',
      '*.secret',
      '*.secretAccessKey',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export const createLogger = (component) => logger.child({ component });

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.originalUrl || req.url} completed with ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.originalUrl || req.url} failed with ${res.statusCode}: ${err.message}`;
  },
});
