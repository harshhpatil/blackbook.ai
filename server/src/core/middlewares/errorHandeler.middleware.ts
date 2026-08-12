import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../lib/logger.ts';
import { env } from '../config/env.ts';

const log = createLogger('error-handler');

/**
 * Base operational error class.
 * All module-specific errors (CreditError, GeminiError) MUST extend this class.
 */
export class AppError extends Error {
  /**
   * @param statusCode - HTTP status code to return to the client (e.g., 400, 404, 502).
   * @param message - Safe, human-readable error message to expose to the client.
   * @param options - Standard ErrorOptions (allows passing { cause: originalError } for stack tracing).
   */
  constructor(
    public statusCode: number,
    public message: string,
    options?: ErrorOptions
  ) {
    super(message, options);

    // Dynamically sets the error name to the child class name (e.g., 'CreditError')
    this.name = this.constructor.name;

    // Ensures this constructor call is omitted from the stack trace for cleaner debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global centralized error handler middleware.
 * Intercepts all thrown errors across the Express application, formats the HTTP response,
 * and logs the error contextually based on whether it is an operational or unhandled exception.
 *
 * @param err - The Error object caught by Express.
 * @param req - The incoming Express request object.
 * @param res - The outgoing Express response object.
 * @param _next - The next middleware function (unused, but required for Express to recognize this as an error handler).
 */
export default function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {

  void _next;

  // Handle Known Operational Errors
  if (err instanceof AppError) {
    // Safely fallback to global logger if request-scoped logger isn't available
    const logInstance = req.log || log;

    logInstance.warn(
      {
        err,
        statusCode: err.statusCode,
        path: req.originalUrl,
        requestId: req.id,
      },
      'Operational error handled'
    );

    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Handle Unexpected System Crashes
  // We use error-level logging here because unhandled exceptions require immediate developer attention.
  const logInstance = req.log || log;
  logInstance.error(
    {
      err,
      path: req.originalUrl,
      requestId: req.id,
    },
    'unhandled internal server error'
  );

  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    // Expose the raw stack trace to the frontend ONLY in development mode for easier debugging
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
