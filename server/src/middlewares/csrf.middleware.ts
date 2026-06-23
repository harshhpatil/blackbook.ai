import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { authCookieOptions } from '../controllers/auth/auth.helpers.ts';

// defining constants for the CSRF token cookie name and header name
const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

const isSafeMethod = (method: string): boolean => {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method);
};

// middleware to issue a new CSRF token and set it in the cookie
export const issueCsrfToken = (_req: Request, res: Response): Response => {
  // generating a random CSRF token using the crypto module and setting it in the cookie with appropriate options
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie(CSRF_COOKIE_NAME, token, {
    ...authCookieOptions,
    httpOnly: false,
    maxAge: 2 * 60 * 60 * 1000,
  });

  return res.status(200).json({ csrfToken: token });
};

// middleware to validate the CSRF token for non-safe HTTP methods
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  // allowing safe HTTP methods to pass through without CSRF validation
  if (isSafeMethod(req.method)) {
    return next();
  }

  // extracting the CSRF token from the cookie and the request header, validating their presence and comparing them using a timing-safe comparison to prevent CSRF attacks
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);

  // validating the presence of both tokens and ensuring they are non-empty strings before performing the timing-safe comparison to prevent CSRF attacks
  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length === 0 ||
    headerToken.length === 0
  ) {
    return res.status(403).json({ message: 'csrf token is required' });
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    return res.status(403).json({ message: 'invalid csrf token' });
  }

  return next();
};
