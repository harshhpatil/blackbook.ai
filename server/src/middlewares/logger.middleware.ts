import crypto from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Request } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.ts';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingRequestId = req.headers['x-request-id'];
    const requestId =
      typeof existingRequestId === 'string' && existingRequestId.length > 0
        ? existingRequestId
        : crypto.randomUUID();

    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  customLogLevel: (
    _req: IncomingMessage,
    res: ServerResponse,
    err?: Error
  ) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with ${res.statusCode}`;
  },
  customErrorMessage: (req, res) => {
    return `${req.method} ${req.url} failed with ${res.statusCode}`;
  },
  customProps: (req) => {
    const expressReq = req as Request;

    return {
      requestId: expressReq.id,
      userId: expressReq.user?.id,
    };
  },
});
