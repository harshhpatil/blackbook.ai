import { CookieOptions, Request } from 'express';
import mongoose from 'mongoose';
import { Audit } from '../../system_module/models/Audit.model.ts';
import { env } from '../../../core/config/env.ts';

/**
 * @constant authCookieOptions
 * @description Secure baseline configuration for all authentication cookies.
 * Protects against XSS (httpOnly) and CSRF (sameSite/secure).
 */
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: env.IS_PRODUCTION && env.CROSS_SITE_COOKIES ? 'none' : 'lax',
  path: '/',
};

/**
 * @interface RecordAuditParams
 * @description Parameters required to log an authentication or security event.
 */
interface RecordAuditParams {
  user: mongoose.Types.ObjectId | string;
  event: string;
  req: Request;
  meta?: Record<string, unknown>;
}

/**
 * @function recordAudit
 * @description Asynchronously logs security events (logins, password resets, etc.).
 * Designed to fail silently so logging issues do not interrupt the user's primary request.
 * @param {RecordAuditParams} params - The audit details including user, event type, and request context.
 * @returns {Promise<void>}
 */
export async function recordAudit({
  user,
  event,
  req,
  meta,
}: RecordAuditParams): Promise<void> {
  try {
    await Audit.create({
      user,
      event,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      meta,
    });
  } catch {
    // Audit logging should never block the primary request flow.
  }
}

/**
 * @class AuthError
 * @extends Error
 * @description Custom error class for authentication-related failures.
 * Allows the global error handler to return specific HTTP status codes (e.g., 401, 403).
 */
export class AuthError extends Error {
  public statusCode: number;
  public status: number;

  /**
   * @param {string} message - The error message to return to the client.
   * @param {number} [statusCode=500] - The HTTP status code associated with the error.
   */
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;

    // Setting the prototype explicitly to maintain the correct instance of the error class in TypeScript
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}
