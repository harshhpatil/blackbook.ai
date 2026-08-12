import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('security-middleware');

/**
 * HTTP methods that do not modify state.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cache the allowed origins into a Set for faster O(1) lookups.
 * (Assuming env.ALLOWED_ORIGINS is exported as an array of strings from env.ts)
 */
const allowedOrigins = new Set(
  process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []
);


/**
 * Checks if a given origin is explicitly allowed by the environment configuration.
 * Allows requests with no origin (e.g., mobile apps, cURL, or server-to-server calls).
 */
export const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) {
    return true;
  }
  return allowedOrigins.has(origin);
};

/**
 * Security middleware to verify the request Origin header.
 * Prevents unknown domains from making state-modifying requests (POST, PUT, DELETE)
 * to the API. Acts as a strict defense layer alongside CORS and CSRF protection.
 */
export const verifyRequestOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get('origin');

  if (origin && !isAllowedOrigin(origin)) {
    log.warn(
      {
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        origin,
      },
      'Blocked request: Forbidden origin'
    );

    res.status(403).json({ message: 'Forbidden origin' });
    return;
  }

  next();
};
