import { CookieOptions, Request } from 'express';
import mongoose from 'mongoose';
import { Audit } from '../../models/Audit.model.ts';
import { env } from '../../config/env.ts';

// cookie options for setting the token's in the cookie
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: env.IS_PRODUCTION && env.CROSS_SITE_COOKIES ? 'none' : 'lax',
  path: '/',
};

// defining the interface to log the audit events
interface RecordAuditParams {
  user: mongoose.Types.ObjectId | string;
  event: string;
  req: Request;
  meta?: Record<string, any>;
}

// defining the function to log the audit events
export async function recordAudit({
  user,
  event,
  req,
  meta,
}: RecordAuditParams): Promise<void> {
  try {
    // creating a new audit log entry in the database with the provided information and additional metadata from the request
    await Audit.create({
      user,
      event,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      meta,
    });
  } catch (err) {} // ignoring any errors that occur during the audit logging to avoid affecting the main flow of the application
}

// typescript custom error class for handling the authentication errors
export class AuthError extends Error {
  public statusCode: number;
  public status: number;

  // constructor to initialize the error message and status code
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;

    // setting the prototype explicitly to maintain the correct instance of the error class
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}
