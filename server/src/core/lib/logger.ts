import pino, { LoggerOptions } from 'pino';

/**
 * Standard paths to redact from all log outputs.
 * Prevents accidental leakage of PII, credentials, and session tokens into plain-text logs.
 */
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
  process.env.LOG_REDACT_PATHS?.split(',')
    .map((path) => path.trim())
    .filter(Boolean) ?? [];

/**
 * Determines whether to use human-readable formatted logs.
 * Strictly disabled in production to maximize performance and output machine-readable JSON 
 * for log aggregators (e.g., AWS CloudWatch, Datadog).
 */
const usePrettyLogs =
  process.env.LOG_PRETTY_PRINT === 'true' ||
  (process.env.LOG_PRETTY_PRINT === undefined &&
    process.env.NODE_ENV === 'development');

const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL,
  base: {
    service: 'blackbook-api',
    env: process.env.NODE_ENV,
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
    // Converts Pino's default numeric levels (e.g., 30) into strings (e.g., "info") for easier querying
    level(label) {
      return { level: label };
    },
  },
  // Pino v7+ offloads transport processing to a separate worker thread so it doesn't block the main event loop
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

/**
 * Factory function to create a child logger with an attached component name.
 * 
 * @param {string} component - The name of the module or service (e.g., 'auth', 'redis').
 * @returns {pino.Logger} A Pino logger instance that automatically tags all logs with the component name.
 */
export const createLogger = (component: string): pino.Logger => {
  return logger.child({ component });
};