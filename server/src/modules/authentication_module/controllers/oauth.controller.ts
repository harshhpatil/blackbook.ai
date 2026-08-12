import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/Users.model.ts';
import { Session } from '../models/Session.model.ts';
import { verifyGoogleTokenAndUpsertUser } from '../services/oauth.service.ts';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../services/token.service.ts';
import {
  authCookieOptions,
  recordAudit,
  AuthError,
} from '../utils/auth.helpers.ts';

/**
 * @function googleLogin
 * @description Authenticates a user via Google OAuth, generates tokens, creates a secure session, and sets HTTP-only cookies.
 * @route POST /api/v1/auth/google
 */
export async function googleLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AuthError('Google ID token is required', 400);
    }

    // 1. Verify token with Google and get/create the user (from Step 3)
    const user = await verifyGoogleTokenAndUpsertUser(token);

    // 2. Convert the Mongoose document to a plain JSON object to manipulate it safely
    const sanitizedUser: Partial<IUser> = user.toObject();

    // 3. Strip out all sensitive data before signing tokens
    delete sanitizedUser.passwordHash;
    delete sanitizedUser.emailVerificationToken;
    delete sanitizedUser.emailVerificationTokenExpiry;
    delete sanitizedUser.passwordResetToken;
    delete sanitizedUser.passwordResetTokenExpiry;

    // 4. Generate high-entropy refresh token and hash it
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);

    // 5. Create a secure session backing the refresh token
    const session = await Session.create({
      user: sanitizedUser._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // 6. Generate the short-lived access token
    const accessToken = generateAccessToken(
      sanitizedUser as IUser,
      session._id.toString()
    );

    // 7. Attach strict HTTP-only cookies (mirroring standard login)
    res.cookie('accessToken', accessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      ...authCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 8. Record the audit event
    await recordAudit({
      user: sanitizedUser._id!,
      event: 'google_login_success',
      req,
    });

    return res.status(200).json({ message: 'Google Login successful..!!' });
  } catch (err) {
    return next(err);
  }
}
