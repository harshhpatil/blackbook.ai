import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

// defining the exact shape of the payload expected by the token generator
export interface ITokenPayload {
  _id: mongoose.Types.ObjectId;
  role: 'user' | 'admin';
  tokenVersion: number;
}

// function to generate the access token
export function generateAccessToken(payload: any): string {
  // checking if the JWT_SECRET is defined in the environment variables and payload is provided or not
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in the environment variables');
  }
  if (!payload) {
    throw new Error('user payload is required to generate the access token');
  }

  return jwt.sign(
    {
      userId: payload._id,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
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
  return hashToken(token) === hashedToken; // returning true if the token matches the hashed token, otherwise false
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
