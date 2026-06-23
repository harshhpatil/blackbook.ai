import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.ts';

// middleware function to check if the request origin is allowed based on the configured allowed origins
export const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) {
    return true; // allow requests with no origin (like mobile apps or curl)
  }
  return env.ALLOWED_ORIGINS.includes(origin);
};

// middleware function to verify the request origin for non-safe HTTP methods
export const verifyRequestOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ message: 'forbidden origin' });
  }

  return next();
};
