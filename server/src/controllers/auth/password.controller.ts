import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { IUser, User } from '../../models/Users.model.ts';
import { Session } from '../../models/Session.model.ts';
import { IEmailOutbox } from '../../models/EmailOutbox.model.ts';
import {
  generatePasswordResetToken,
  hashToken,
} from '../../services/token.service.ts';
import {
  createEmailOutboxEvent,
  publishEmailOutboxEvent,
} from '../../services/emailQueue.service.ts';
import { authCookieOptions, recordAudit } from './auth.helpers.ts';
import { env } from '../../config/env.ts';

// function to change the password of the logged in user by validating the current password, updating the password and revoking all active sessions
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the user id from the request object and validating it
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    // extracting the current and new password from the request body and validating them
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'current and new password are required' });
    }

    // finding the user in the database and validating the current password
    const user = await User.findById(userId).select('+password');
    if (!user) return res.status(404).json({ message: 'user not found' });

    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'current password is incorrect' });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: 'new password must be different from current password',
      });
    } // returning error if the new password is the same as the current password

    const mongoSession = await mongoose.startSession();
    await mongoSession.withTransaction(async () => {
      // updating the password, incrementing the token version to invalidate all existing access tokens immediately, revoking all active sessions and clearing cookies for the current device
      user.password = newPassword;
      user.tokenVersion += 1;

      // revoke all active database sessions
      await Session.updateMany(
        { user: user._id, revoked: false },
        { revoked: true },
        { session: mongoSession }
      );

      await user.save({ session: mongoSession });
    });
    await mongoSession.endSession();

    // clear cookies for the current device
    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);
    await recordAudit({
      user: user._id as unknown as string,
      event: 'change_password',
      req,
    });

    return res.status(200).json({ message: 'password changed successfully' });
  } catch (err) {
    return next(err);
  }
}

// function to initiate the forgot password process by generating a password reset token, saving it to the user's record, and sending a password reset email
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the email from the request body and validating it
    const { email } = req.body;
    const successMessage =
      'If an account with that email exists, a password reset link has been sent.';

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // normalizing the email and finding the user in the database
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(200).json({ message: successMessage });

    // generating a password reset token and its hashed version, creating a password reset link, saving the hashed token and its expiry time to the user's record, and sending the password reset email
    const { resetToken, hashedResetToken } = generatePasswordResetToken();
    const baseURL = env.CLIENT_URL;

    // creating the password reset link using the reset token and the base URL
    const resetLink = `${baseURL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const mongoSession = await mongoose.startSession();
    let outboxEvent: IEmailOutbox | undefined;

    await mongoSession.withTransaction(async () => {
      user.passwordResetToken = hashedResetToken;
      user.passwordResetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour expiry
      await user.save({ session: mongoSession });

      outboxEvent = await createEmailOutboxEvent(
        'send-password-reset-email',
        { email: user.email, link: resetLink },
        mongoSession
      );
    });

    await mongoSession.endSession();

    // queueing the password reset email to be sent to the user and recording the audit event
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

// function to reset the password of the user by validating the reset token, updating the password, revoking all active sessions, and clearing cookies for the current device
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the reset token and new password from the request body and validating them
    const { token: bodyToken, newPassword } = req.body;
    const queryToken = req.query.token;

    // determining the source of the reset token, either from the request body or query parameters, and trimming any whitespace
    const tokenSource =
      typeof bodyToken === 'string'
        ? bodyToken
        : typeof queryToken === 'string'
          ? queryToken
          : '';
    const token = tokenSource.trim();

    // returning an error response if the reset token or new password is not provided in the request
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: 'token and new password are required' });
    }

    const mongoSession = await mongoose.startSession();
    let user: IUser | null = null;

    await mongoSession.withTransaction(async () => {
      // Atomically claim and clear the reset token before changing the password.
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
      ).select('+password');

      if (!user) return;

      // updating the password, clearing the reset token and its expiry time, incrementing the token version to invalidate all existing access tokens immediately, revoking all active sessions, and clearing cookies for the current device
      user.password = newPassword;
      user.tokenVersion += 1;

      // Revoke active sessions
      await Session.updateMany(
        { user: user._id, revoked: false },
        { revoked: true },
        { session: mongoSession }
      );
      await user.save({ session: mongoSession });
    });

    await mongoSession.endSession();

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired reset token' });
    }
    const resetUser = user as IUser;

    await recordAudit({
      user: resetUser._id as unknown as string,
      event: 'reset_password',
      req,
    });

    // Clear local cookies
    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    return next(err);
  }
}
