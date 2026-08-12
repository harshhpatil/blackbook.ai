import { Request, Response, NextFunction } from 'express';
import { IUser, User } from '../models/Users.model.ts';
import { Session } from '../models/Session.model.ts';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../services/token.service.ts'; // Fixed .js to .ts
import { authCookieOptions, recordAudit } from '../utils/auth.helpers.ts';

/**
 * @function refreshToken
 * @description Rotates the refresh token, generates a new access token, and securely updates the database session.
 * @route POST /api/v1/auth/refresh
 */
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: 'Unauthorized' });

    const refreshTokenHash = hashToken(refreshToken);

    const matchedSession = await Session.findOne({
      tokenHash: refreshTokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!matchedSession) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(matchedSession.user);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const sanitizedUser: Partial<IUser> = user.toObject();

    // FIXED: Stripping passwordHash instead of password
    delete sanitizedUser.passwordHash;
    delete sanitizedUser.emailVerificationToken;
    delete sanitizedUser.emailVerificationTokenExpiry;
    delete sanitizedUser.passwordResetToken;
    delete sanitizedUser.passwordResetTokenExpiry;

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);

    // Atomically rotate the token. Keeps the old hash in the selector so only one concurrent refresh can win.
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: matchedSession._id,
        tokenHash: refreshTokenHash,
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          tokenHash: newRefreshTokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          revoked: false,
        },
      },
      {
        new: true,
      }
    );

    // If the session wasn't updated, the token was likely already rotated (possible replay attack or network retry)
    if (!updatedSession) {
      return res.status(401).json({
        message: 'Refresh token already rotated',
      });
    }

    const newAccessToken = generateAccessToken(
      sanitizedUser as IUser,
      updatedSession._id.toString()
    );

    await recordAudit({
      user: matchedSession.user,
      event: 'refresh_token',
      req,
    });

    res.cookie('accessToken', newAccessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', newRefreshToken, {
      ...authCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ message: 'Tokens refreshed successfully' });
  } catch (err) {
    return next(err);
  }
}

/**
 * @function logout
 * @description Logs the user out of their current device by revoking the specific session and clearing cookies.
 * @route POST /api/v1/auth/logout
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: 'Unauthorized' });

    const refreshTokenHash = hashToken(refreshToken);
    const matchedSession = await Session.findOneAndUpdate(
      {
        tokenHash: refreshTokenHash,
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: { revoked: true } },
      { new: true }
    ).select('_id user');

    if (!matchedSession) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);

    await recordAudit({
      user: matchedSession.user,
      event: 'logout',
      req,
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

/**
 * @function getSessions
 * @description Retrieves all active sessions for the currently authenticated user.
 * @route GET /api/v1/auth/sessions
 */
export async function getSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const sessions = await Session.find({
      user: userId,
      revoked: false,
      expiresAt: { $gt: new Date() },
    })
      .select('-tokenHash')
      .sort({ createdAt: -1 });

    return res.status(200).json({ sessions });
  } catch (err) {
    return next(err);
  }
}

/**
 * @function logoutSession
 * @description Allows a user to remotely log out of a specific device/session from their security dashboard.
 * @route DELETE /api/v1/auth/sessions/:sessionId
 */
export async function logoutSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const userId = req.user?.id;
    const sessionId = req.params.sessionId;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const session = await Session.findOneAndUpdate(
      { _id: sessionId, user: userId, revoked: false },
      { $set: { revoked: true } },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });

    await recordAudit({
      user: userId,
      event: 'logout_session',
      req,
      meta: { sessionId },
    });

    return res.status(200).json({ message: 'Session logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

/**
 * @function logoutAllSessions
 * @description Logs the user out of all devices by revoking all sessions and incrementing their token version.
 * @route POST /api/v1/auth/logout-all
 */
export async function logoutAllSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await Session.updateMany(
      { user: userId, revoked: false },
      { revoked: true }
    );

    // Incrementing tokenVersion invalidates all existing short-lived access tokens immediately
    user.tokenVersion += 1;
    await user.save();

    await recordAudit({
      user: user._id as unknown as string,
      event: 'logout_all_sessions',
      req,
    });

    return res
      .status(200)
      .json({ message: 'All sessions logged out successfully' });
  } catch (err) {
    return next(err);
  }
}
