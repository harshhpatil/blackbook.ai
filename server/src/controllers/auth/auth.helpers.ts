import { CookieOptions, Request } from 'express';
import mongoose from 'mongoose';
import { Audit } from '../../models/Audit.model.ts';

const isProduction = process.env.NODE_ENV === 'production';

// cookie options for setting the token's in the cookie
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
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
    await Audit.create({
      user,
      event,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      meta,
    });
  } catch (err) {}
}

// typescript custom error class for handling the authentication errors
export class AuthError extends Error {
    public statusCode: number;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        
        Object.setPrototypeOf(this, AuthError.prototype);
    }
}