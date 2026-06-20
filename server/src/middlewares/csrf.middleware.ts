import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { authCookieOptions } from '../controllers/auth/auth.helpers.ts';

const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

const isSafeMethod = (method: string): boolean => {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method);
};

export const issueCsrfToken = (_req: Request, res: Response): Response => {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie(CSRF_COOKIE_NAME, token, {
    ...authCookieOptions,
    httpOnly: false,
    maxAge: 2 * 60 * 60 * 1000,
  });

  return res.status(200).json({ csrfToken: token });
};

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  if (isSafeMethod(req.method)) {
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
