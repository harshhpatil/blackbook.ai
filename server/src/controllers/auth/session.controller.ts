import { Request, Response, NextFunction } from 'express';
import { IUser, User } from '../../models/Users.model.ts';
import { Session } from '../../models/Session.model.ts';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../services/token.service.js';
import { authCookieOptions, recordAudit } from './auth.helpers.js';

// function to refresh the access token using the refresh token
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> {
  try {
    // extracting the refresh token from the cookies and validating it
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: 'unauthorized' });

    // finding the session associated with the provided refresh token
    const refreshTokenHash = hashToken(refreshToken);

    const matchedSession = await Session.findOne({
      tokenHash: refreshTokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    // if no matching session is found, returning unauthorized response
    if (!matchedSession) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    // finding the user associated with the matched session and validating the user
    const user = await User.findById(matchedSession.user);
    if (!user) return res.status(401).json({ message: 'unauthorized' });

    // converting the mongoose document into plain json object
    const sanitizedUser: Partial<IUser> = user.toObject();

    // clearing the object before signing the token
    delete sanitizedUser.password;
    delete sanitizedUser.emailVerificationToken;
    delete sanitizedUser.emailVerificationTokenExpiry;
    delete sanitizedUser.passwordResetToken;
    delete sanitizedUser.passwordResetTokenExpiry;

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);

    // Keep the old hash in the selector so only one concurrent refresh can win.
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
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revoked: false,
        },
      },
      {
        new: true,
      },
    );

    // returning unauthorized response if the session was not updated, which can happen if the refresh token was already rotated or revoked
    if (!updatedSession) {
      return res.status(401).json({
        message: 'refresh token already rotated',
      });
    }

    const newAccessToken = generateAccessToken(
      sanitizedUser as IUser,
      updatedSession._id.toString()
    );

    await recordAudit({
      user: matchedSession.user as any,
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

    return res.status(200).json({ message: 'tokens refreshed successfully' });
  } catch (err) {
    return next(err);
  }
}

// function to logout the user by revoking the session associated with the provided refresh token
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the refresh token from the cookies and validating it
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: 'unauthorized' });

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
      return res.status(401).json({ message: 'unauthorized' });
    }

    // clearing the cookies and returning success response
    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);
    await recordAudit({
      user: matchedSession.user as any,
      event: 'logout',
      req,
    });

    return res.status(200).json({ message: 'logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

// function to get all active sessions of the logged in user
export async function getSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the user id from the request object and validating it
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'unauthorized' });

    // finding the user in the database and returning not found response if user does not exist
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

// function to logout a specific session by revkoing the session associated with the provided session id
export async function logoutSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the user id from the request object and session id from the request parameters, and validating them
    const userId = req.user?.id;
    const sessionId = req.params.sessionId;

    if (!userId) return res.status(401).json({ message: 'unauthorized' });

    const session = await Session.findOneAndUpdate(
      { _id: sessionId, user: userId, revoked: false },
      { $set: { revoked: true } },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'session not found' });

    await recordAudit({
      user: userId,
      event: 'logout_session',
      req,
      meta: { sessionId },
    });

    return res.status(200).json({ message: 'session logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

// function to logout all sessions of the logged in user by revoking all sessions ]
export async function logoutAllSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the user id from the request object and validating it
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'unauthorized' });

    // finding the user in the database and returning not found response if user does not exist
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'user not found' });

    // revoking all sessions associated with the user id and incrementing the token version to invalidate all existing access tokens immediately
    await Session.updateMany(
      { user: userId, revoked: false },
      { revoked: true }
    );

    // Incrementing tokenVersion invalidates all existing access tokens immediately
    user.tokenVersion += 1;
    await user.save();

    await recordAudit({
      user: user._id as unknown as string,
      event: 'logout_all_sessions',
      req,
    });

    return res
      .status(200)
      .json({ message: 'all sessions logged out successfully' });
  } catch (err) {
    return next(err);
  }
}
