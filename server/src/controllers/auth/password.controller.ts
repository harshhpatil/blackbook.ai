import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { User } from '../../models/Users.model.ts';
import { Session } from '../../models/Session.model.ts';
import { generatePasswordResetToken } from '../../services/token.service.js';
import { queuePasswordResetEmail } from '../../services/email.queue.service.js';
import { authCookieOptions, AuthError, recordAudit } from './auth.helpers.js';

// function to change the password of the logged in user by validating the current password, updating the password and revoking all active sessions
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting the user id from the request object and validating it
    const userId = (req as any).user?.id;
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

    // updating the password, incrementing the token version to invalidate all existing access tokens immediately, revoking all active sessions and clearing cookies for the current device
    user.password = newPassword;
    user.tokenVersion += 1;

    // revoke all active database sessions
    await Session.updateMany(
      { user: user._id, revoked: false },
      { revoked: true }
    );

    // clear cookies for the current device
    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);

    await user.save();

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
    const baseURL = process.env.CLIENT_URL;

    if (!baseURL) {
      return next(new AuthError('reset URL not configured', 500));
    }

    // creating the password reset link using the reset token and the base URL
    const resetLink = `${baseURL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    user.passwordResetToken = hashedResetToken;
    user.passwordResetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour expiry
    await user.save();

    // queueing the password reset email to be sent to the user and recording the audit event
    await queuePasswordResetEmail(user.email, resetLink);
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
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Token and new password are required' });
    }

    // hashing the reset token and finding the user in the database with the hashed token and validating its expiry time
    const hashedResetToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // finding the user in the database with the hashed token and validating its expiry time
    const user = await User.findOne({
      passwordResetToken: hashedResetToken,
      passwordResetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired reset token' });
    }

    // updating the password, clearing the reset token and its expiry time, incrementing the token version to invalidate all existing access tokens immediately, revoking all active sessions, and clearing cookies for the current device
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpiry = undefined;
    user.tokenVersion += 1;

    // Revoke active sessions
    await Session.updateMany(
      { user: user._id, revoked: false },
      { revoked: true }
    );
    await user.save();

    await recordAudit({
      user: user._id as unknown as string,
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
