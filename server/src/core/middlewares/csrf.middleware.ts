import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { authCookieOptions } from '../../modules/authentication_module/utils/auth.helpers.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('csrf.middleware');

const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * HTTP methods that do not modify state and are inherently safe from CSRF attacks.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Issues a new CSRF token.
 *
 * Uses the Double Submit Cookie pattern: the token is sent both as a cookie
 * (which the browser attaches automatically) and in the JSON response (which the
 * frontend must read and manually attach to the `x-csrf-token` header for future requests).
 *
 * NOTE: `httpOnly` MUST be false here so the frontend JavaScript can read it.
 */
export const issueCsrfToken = (_req: Request, res: Response): Response => {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie(CSRF_COOKIE_NAME, token, {
    ...authCookieOptions,
    httpOnly: false, // Explicit override: Frontend JS needs access to this specific cookie
    maxAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  });

  return res.status(200).json({ csrfToken: token });
};

/**
 * Middleware to enforce CSRF protection on state-changing requests (POST, PUT, DELETE).
 *
 * Validates that the token automatically sent in the cookie perfectly matches
 * the token manually attached to the request header by the frontend.
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);

  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length === 0 ||
    headerToken.length === 0
  ) {
    log.warn(
      { ip: req.ip, method: req.method },
      'blocked request: missing or invalid csrf token '
    );
    res.status(403).json({ message: 'csrf token is required' });
    return;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    log.warn('csrf token length or value mismatch');
    res.status(403).json({ message: 'invalid csrf token' });
    return;
  }

  return next();
};
