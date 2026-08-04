import pino, { LoggerOptions } from 'pino';
import { env } from '../config/env.ts';

const defaultRedactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["x-razorpay-signature"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.confirmPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.jwt',
  '*.secret',
  '*.apiKey',
  '*.keySecret',
];

const configuredRedactPaths =
  env.LOG_REDACT_PATHS?.split(',')
    .map((path) => path.trim())
    .filter(Boolean) ?? [];

const usePrettyLogs =
  env.LOG_PRETTY_PRINT ?? env.NODE_ENV === 'development';

const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: 'blackbook-api',
    env: env.NODE_ENV,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [...defaultRedactPaths, ...configuredRedactPaths],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  transport: usePrettyLogs
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
};

export const logger = pino(loggerOptions);

export const createLogger = (component: string) => {
  return logger.child({ component });
};
