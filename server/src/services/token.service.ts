import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.ts';

// defining the exact shape of the payload expected by the token generator
export interface ITokenPayload {
  _id: mongoose.Types.ObjectId;
  role: 'user' | 'admin';
  tokenVersion: number;
}

// function to generate the access token
export function generateAccessToken(
  payload: ITokenPayload,
  sessionId: string
): string {
  if (!payload) {
    throw new Error('user payload is required to generate the access token');
  }

  return jwt.sign(
    {
      userId: payload._id,
      sub: payload._id.toString(),
      role: payload.role,
      tokenVersion: payload.tokenVersion,
      sessionId,
    },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      audience: env.jwtAudience,
      expiresIn: '15m',
      issuer: env.jwtIssuer,
    }
  );
}

// function to generate the refresh token
export function generateRefreshToken(): string {
  return crypto.randomUUID(); // returning a random UUID as the refresh token
}
 
// function to generate hashed token
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex'); // returning hashed token using sha256
}

// function to verify the token
export async function verifyToken(
  token: string,
  hashedToken: string
): Promise<boolean> {
  const tokenHash = hashToken(token);
  const tokenHashBuffer = Buffer.from(tokenHash, 'hex');
  const storedHashBuffer = Buffer.from(hashedToken, 'hex');

  return (
    tokenHashBuffer.length === storedHashBuffer.length &&
    crypto.timingSafeEqual(tokenHashBuffer, storedHashBuffer)
  );
}

// function to generate password reset token
export function generatePasswordResetToken(): {
  resetToken: string;
  hashedResetToken: string;
} {
  // generating a random UUID as the reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // hashing the reset token with salt rounds
  const hashedResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  return { resetToken, hashedResetToken }; // returning both the reset token and its hashed version
}
