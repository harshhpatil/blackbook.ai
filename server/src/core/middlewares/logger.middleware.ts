import crypto from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Request } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.ts';

/**
 * Global HTTP request logger middleware.
 *
 * Automatically logs incoming requests and outgoing responses, attaches a unique
 * request ID for distributed tracing, and contextually adjusts log levels based
 * on the HTTP status code.
 */
export const requestLogger = pinoHttp({
  logger,

  /**
   * Generates or inherits a unique trace ID for the request.
   * If an upstream service (like a load balancer or frontend) provides an 'x-request-id',
   * it is preserved for distributed tracing. Otherwise, a new UUID is generated.
   */
  genReqId: (req: IncomingMessage, res: ServerResponse): string => {
    const existingRequestId = req.headers['x-request-id'];
    const requestId =
      typeof existingRequestId === 'string' && existingRequestId.length > 0
        ? existingRequestId
        : crypto.randomUUID();

    // Attach to response headers so the client can reference it in support tickets
    res.setHeader('x-request-id', requestId);
    return requestId;
  },

  /**
   * Dynamically sets the log level based on the response status.
   * - 5xx (Server Errors): 'error' (triggers alerts)
   * - 4xx (Client Errors): 'warn' (expected operational failures, no alerts)
   * - 2xx/3xx (Success/Redirect): 'info'
   */
  customLogLevel: (
    _req: IncomingMessage,
    res: ServerResponse,
    err?: Error
  ): 'error' | 'warn' | 'info' => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  customSuccessMessage: (req: IncomingMessage, res: ServerResponse): string => {
    return `${req.method} ${req.url} completed with ${res.statusCode}`;
  },

  customErrorMessage: (req: IncomingMessage, res: ServerResponse): string => {
    return `${req.method} ${req.url} failed with ${res.statusCode}`;
  },

  /**
   * Injects application-specific context into every log entry.
   * Evaluated at the end of the request, so properties attached by downstream
   * middleware (like the authenticated user) are captured.
   */
  customProps: (req: IncomingMessage) => {
    // Cast to Express Request to access custom merged properties
    const expressReq = req as Request;

    return {
      requestId: expressReq.id,
      userId: expressReq.user?.id,
    };
  },
});
