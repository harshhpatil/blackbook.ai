import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/Users.model.ts';
import { Session } from '../models/Session.model.ts';
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
 * @function login
 * @description Authenticates a user, generates access/refresh tokens, creates a secure session, and sets HTTP-only cookies.
 * @route POST /api/v1/auth/login
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { email, password } = req.body;

    // manual check for secondary failsafe.
    if (!email || !password) {
      throw new AuthError('Email and password are required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Explicitly select passwordHash since it is hidden by default in the User model
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+passwordHash'
    );

    if (!user) {
      // Use generic error messages for both missing email and wrong password to prevent email enumeration attacks
      throw new AuthError('Invalid email or password', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthError('Invalid email or password', 401);
    }

    if (!user.isEmailVerified) {
      throw new AuthError(
        'Email is not verified. Please verify your email to login.',
        403
      );
    }

    // Convert the Mongoose document to a plain JSON object to manipulate it safely
    const sanitizedUser: Partial<IUser> = user.toObject();

    // Strip out all sensitive data before signing tokens or passing data around
    delete sanitizedUser.passwordHash;
    delete sanitizedUser.emailVerificationToken;
    delete sanitizedUser.emailVerificationTokenExpiry;
    delete sanitizedUser.passwordResetToken;
    delete sanitizedUser.passwordResetTokenExpiry;

    // Generate high-entropy refresh token and hash it for secure database storage
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);

    // Create a secure session backing the refresh token
    const session = await Session.create({
      user: sanitizedUser._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Generate the short-lived access token
    const accessToken = generateAccessToken(
      sanitizedUser as IUser,
      session._id.toString()
    );

    // Attach strict HTTP-only cookies
    res.cookie('accessToken', accessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      ...authCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    await recordAudit({
      user: sanitizedUser._id!,
      event: 'login_success',
      req,
    });

    return res.status(200).json({ message: 'Login successful..!!' });
  } catch (err) {
    return next(err);
  }
}
