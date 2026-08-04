import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../lib/logger.ts';
import { GeminiGenerationError } from '../services/gemini.service.ts';
import { CreditError } from '../services/credit.service.ts';

const log = createLogger('error-handler');

// defining a clean custom error class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// defining the global error handler middleware
export default function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  void req;
  void next;

  if (err instanceof GeminiGenerationError) {
    req.log.warn({ err, requestId: req.id, path: req.originalUrl }, 'Gemini generation failed');
    return res.status(err.statusCode).json({ status: 'error', message: err.message });
  }

  if (err instanceof CreditError) {
    return res.status(err.statusCode).json({ status: 'error', message: err.message });
  }

  // if the error is an instance of AppError, send the custom error response
  if (err instanceof AppError) {
    req.log.warn(
      {
        err,
        statusCode: err.statusCode,
        requestId: req.id,
        path: req.originalUrl,
      },
      'handled application error'
    );

    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // falling back for unexpected system crashes
  if (err instanceof Error) {
    req.log.error(
      { err, requestId: req.id, path: req.originalUrl },
      'unhandled internal error'
    );
  } else {
    log.error(
      { error: err, requestId: req.id, path: req.originalUrl },
      'unknown error type received'
    );
  }

  // sending a generic error response for unhandled errors
  return res.status(500).json({
    message: 'internal server error',
  });
}
