import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { IUser, User } from '../models/Users.model.ts';
import { Session } from '../models/Session.model.ts';
import { IEmailOutbox } from '../../system_module/models/EmailOutbox.model.ts';
import {
  generatePasswordResetToken,
  hashToken,
} from '../services/token.service.ts';
import {
  createEmailOutboxEvent,
  publishEmailOutboxEvent,
} from '../../../core/services/emailQueue.service.ts';
import { authCookieOptions, recordAudit } from '../utils/auth.helpers.ts';
import { env } from '../../../core/config/env.ts';

const RESET_EXPIRY_MINUTES = 60;
const recipientName = (user: Pick<IUser, 'email' | 'name'>): string =>
  user.name?.trim() || user.email.split('@')[0];

const passwordChangedPayload = (
  user: Pick<IUser, 'email' | 'name'>,
  req: Request
) => ({
  email: user.email,
  name: recipientName(user),
  changedAt: new Date().toISOString(),
  location: req.ip || 'Unknown location',
  device: req.get('user-agent') || 'Unknown device',
});

/**
 * @function changePassword
 * @description Allows an authenticated user to update their password. Invalidates all active sessions globally.
 * @route POST /api/v1/auth/change-password
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // Assuming `req.user` is populated by your authentication middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Current and new password are required' });
    }

    // Explicitly select passwordHash to verify the old password
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Gate keeper for users authenticated via external providers (e.g., Google)
    if (!user.passwordHash) {
      return res.status(400).json({
        message:
          'This account is authenticated via an external provider (Google) and does not have a local password to change.',
      });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: 'New password must be different from current password',
      });
    }

    const mongoSession = await mongoose.startSession();
    let outboxEvent: IEmailOutbox | undefined;
    await mongoSession.withTransaction(async () => {
      // Update the passwordHash field so the Mongoose pre-save hook catches and hashes it
      user.passwordHash = newPassword;

      // Increment token version to instantly invalidate existing short-lived access tokens
      user.tokenVersion += 1;

      // Revoke all active database sessions to invalidate refresh tokens
      await Session.updateMany(
        { user: user._id, revoked: false },
        { revoked: true },
        { session: mongoSession }
      );

      await user.save({ session: mongoSession });

      outboxEvent = await createEmailOutboxEvent(
        'send-password-changed-email',
        passwordChangedPayload(user, req),
        mongoSession
      );
    });
    await mongoSession.endSession();

    if (outboxEvent) await publishEmailOutboxEvent(outboxEvent);

    // Clear cookies for the device making the request so they must log in again
    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);

    await recordAudit({
      user: user._id as unknown as string,
      event: 'change_password',
      req,
    });

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    return next(err);
  }
}

/**
 * @function forgotPassword
 * @description Initiates the password recovery flow by generating a token and queuing an email via the Outbox.
 * @route POST /api/v1/auth/forgot-password
 */
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { email } = req.body;
    const successMessage =
      'If an account with that email exists, a password reset link has been sent.';

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Always return success to prevent email enumeration attacks
    if (!user) return res.status(200).json({ message: successMessage });

    const { resetToken, hashedResetToken } = generatePasswordResetToken();
    const baseURL = env.CLIENT_URL;
    const resetLink = `${baseURL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const mongoSession = await mongoose.startSession();
    let outboxEvent: IEmailOutbox | undefined;

    await mongoSession.withTransaction(async () => {
      user.passwordResetToken = hashedResetToken;
      user.passwordResetTokenExpiry = new Date(
        Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000
      );
      await user.save({ session: mongoSession });

      outboxEvent = await createEmailOutboxEvent(
        'send-password-reset-email',
        {
          email: user.email,
          name: recipientName(user),
          link: resetLink,
          expiryMinutes: RESET_EXPIRY_MINUTES.toString(),
        },
        mongoSession
      );
    });

    await mongoSession.endSession();

    if (outboxEvent) {
      await publishEmailOutboxEvent(outboxEvent);
    }

    await recordAudit({
      user: user._id as unknown as string,
      event: 'forgot_password',
      req,
    });

    return res.status(200).json({ message: successMessage });
  } catch (err) {
    return next(err);
  }
}

/**
 * @function resetPassword
 * @description Validates a reset token and applies a new password. Invalidates all existing sessions.
 * @route POST /api/v1/auth/reset-password
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { token: bodyToken, newPassword } = req.body;
    const queryToken = req.query.token;

    const tokenSource =
      typeof bodyToken === 'string'
        ? bodyToken
        : typeof queryToken === 'string'
          ? queryToken
          : '';
    const token = tokenSource.trim();

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Token and new password are required' });
    }

    const mongoSession = await mongoose.startSession();
    let user: IUser | null = null;
    let outboxEvent: IEmailOutbox | undefined;

    await mongoSession.withTransaction(async () => {
      // Atomically claim and clear the reset token before changing the password
      user = await User.findOneAndUpdate(
        {
          passwordResetToken: hashToken(token),
          passwordResetTokenExpiry: { $gt: new Date() },
        },
        {
          $unset: {
            passwordResetToken: '',
            passwordResetTokenExpiry: '',
          },
        },
        { new: true, session: mongoSession }
      );

      if (!user) return;

      // Assign to passwordHash to trigger the Mongoose pre-save hashing hook
      user.passwordHash = newPassword;
      user.tokenVersion += 1;

      // Revoke all active sessions
      await Session.updateMany(
        { user: user._id, revoked: false },
        { revoked: true },
        { session: mongoSession }
      );

      await user.save({ session: mongoSession });

      outboxEvent = await createEmailOutboxEvent(
        'send-password-changed-email',
        passwordChangedPayload(user, req),
        mongoSession
      );
    });

    await mongoSession.endSession();

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired reset token' });
    }
    const resetUser = user as IUser;

    if (outboxEvent) await publishEmailOutboxEvent(outboxEvent);

    await recordAudit({
      user: resetUser._id as unknown as string,
      event: 'reset_password',
      req,
    });

    // Clear local cookies to force immediate login with new credentials
    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    return next(err);
  }
}
