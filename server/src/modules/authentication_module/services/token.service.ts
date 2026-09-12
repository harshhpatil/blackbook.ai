import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../../../core/config/env.ts'; 

/**
 * @interface ITokenPayload
 * @description The required user data to encode into the Access Token.
 */
export interface ITokenPayload {
  _id: mongoose.Types.ObjectId;
  role: 'user' | 'admin';
  tokenVersion: number;
}

/**
 * @function generateAccessToken
 * @description Generates a short-lived JWT for API authentication.
 * @param {ITokenPayload} payload - The user data to sign.
 * @param {string} sessionId - The ID of the database session this token belongs to.
 * @returns {string} The signed JWT.
 */
export function generateAccessToken(
  payload: ITokenPayload,
  sessionId: string
): string {
  if (!payload) {
    throw new Error('User payload is required to generate the access token');
  }

  return jwt.sign(
    {
      userId: payload._id,
      sub: payload._id.toString(),
      role: payload.role,
      tokenVersion: payload.tokenVersion,
      sessionId,
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      audience: env.JWT_AUDIENCE,
      expiresIn: '15m',
      issuer: env.JWT_ISSUER,
    }
  );
}

/**
 * @function generateRefreshToken
 * @description Generates a high-entropy, opaque string to be used as a refresh token.
 * @returns {string} A 64-character hex string.
 */
export function generateRefreshToken(): string {
  // Upgraded to 32 cryptographically secure random bytes for higher entropy than UUID
  return crypto.randomBytes(32).toString('hex'); 
}

/**
 * @function hashToken
 * @description Hashes an opaque token (like a refresh or reset token) using SHA-256 for secure database storage.
 * @param {string} token - The raw token.
 * @returns {string} The hex-encoded SHA-256 hash.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @function verifyToken
 * @description Securely compares a provided token against a stored hash using constant-time comparison to prevent timing attacks.
 * @param {string} token - The raw token provided by the user.
 * @param {string} hashedToken - The expected hash retrieved from the database.
 * @returns {Promise<boolean>} True if tokens match, false otherwise.
 */
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

/**
 * @function generatePasswordResetToken
 * @description Generates a secure random token and its corresponding SHA-256 hash for password reset flows.
 * @returns {Object} An object containing both the raw token (to email the user) and the hashed token (to save to the DB).
 */
export function generatePasswordResetToken(): {
  resetToken: string;
  hashedResetToken: string;
} {
  // Generating 32 random bytes for the reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hashing the reset token using a fast cryptographic hash (no salt rounds needed for high-entropy random strings)
  const hashedResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  return { resetToken, hashedResetToken }; 
}