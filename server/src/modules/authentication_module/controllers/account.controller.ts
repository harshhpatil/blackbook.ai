import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { IUser, User } from '../models/Users.model.ts';
import { IEmailOutbox } from '../../system_module/models/EmailOutbox.model.ts';
import { hashToken } from '../services/token.service.ts';
import { AuthError, recordAudit } from '../utils/auth.helpers.ts';
import { env } from '../../../core/config/env.ts';
import {
  createEmailOutboxEvent,
  publishEmailOutboxEvent,
} from '../../../core/services/emailQueue.service.ts';

/**
 * Type guard to check if an error is a MongoDB duplicate key error (code 11000).
 */
const isDuplicateKeyError = (err: unknown): err is { code: number } => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 11000
  );
};

const recipientName = (user: Pick<IUser, 'email' | 'name'>): string =>
  user.name?.trim() || user.email.split('@')[0];

/**
 * @function register
 * @description Handles new user registration, generates a verification token, and queues a verification email via the Outbox pattern.
 * @route POST /api/v1/auth/register
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      throw new AuthError('Email and password are required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const baseUrl = env.CLIENT_URL;

    // Generate high-entropy verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = hashToken(emailVerificationToken);
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const verificationLink = `${baseUrl}/api/v1/auth/verify-email?token=${emailVerificationToken}`;

    const mongoSession = await mongoose.startSession();
    let newUser: IUser | undefined;
    let outboxEvent: IEmailOutbox | undefined;

    // Execute User creation and Outbox event registration in a single ACID transaction
    await mongoSession.withTransaction(async () => {
      const existingUser = await User.findOne({
        email: normalizedEmail,
      }).session(mongoSession);

      if (existingUser) {
        throw new AuthError('Email is already registered', 409);
      }

      const createdUsers = await User.create(
        [
          {
            email: normalizedEmail,
            name: name?.trim(),
            passwordHash: password, // Password hashing is handled automatically by the pre('save') hook
            role: 'user',
            emailVerificationToken: emailVerificationTokenHash,
            emailVerificationTokenExpiry: tokenExpiry,
            isEmailVerified: false,
          },
        ],
        { session: mongoSession }
      );
      newUser = createdUsers[0];

      outboxEvent = await createEmailOutboxEvent(
        'send-verification-email',
        {
          email: normalizedEmail,
          name: name?.trim() || normalizedEmail.split('@')[0],
          link: verificationLink,
          expiryHours: '24',
        },
        mongoSession
      );
    });

    await mongoSession.endSession();

    // Publish to BullMQ only after the transaction is safely committed to the database
    if (outboxEvent) {
      await publishEmailOutboxEvent(outboxEvent);
    }

    await recordAudit({
      user: newUser!._id,
      event: 'user_registered',
      req,
      meta: { email: normalizedEmail },
    });

    res.status(201).json({
      message:
        'User registered successfully. Please check your email to verify your account.',
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return next(new AuthError('Email is already registered', 409));
    }
    next(err);
  }
}

/**
 * @function verifyEmail
 * @description Validates the email verification token, updates the user status, and queues a welcome email.
 * @route GET /api/v1/auth/verify-email
 */
export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const token = req.query.token as string;
    if (!token) {
      throw new AuthError('Verification token is required', 400);
    }

    const tokenHash = hashToken(token);

    const mongoSession = await mongoose.startSession();
    let user: IUser | null = null;
    let outboxEvent: IEmailOutbox | undefined;

    await mongoSession.withTransaction(async () => {
      // Atomically consume the verification token so concurrent requests cannot verify twice
      user = await User.findOneAndUpdate(
        {
          emailVerificationToken: tokenHash,
          emailVerificationTokenExpiry: { $gt: new Date() },
          isEmailVerified: false,
        },
        {
          $set: { isEmailVerified: true },
          $unset: {
            emailVerificationToken: '',
            emailVerificationTokenExpiry: '',
          },
        },
        { new: true, session: mongoSession }
      );

      if (!user) return;

      outboxEvent = await createEmailOutboxEvent(
        'send-welcome-email',
        { email: user.email, name: recipientName(user) },
        mongoSession
      );
    });

    await mongoSession.endSession();

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired verification token' });
    }

    const verifiedUser = user as IUser;

    if (outboxEvent) {
      await publishEmailOutboxEvent(outboxEvent);
    }

    // Grant initial welcome signup bonus credits
    const { addCredits } = await import('../../credits_module/services/credits.service.ts');
    await addCredits(verifiedUser._id.toString(), 10, 'signup_bonus', 'Welcome Signup Bonus Credits').catch(() => undefined);

    await recordAudit({
      user: verifiedUser._id,
      event: 'email_verified',
      req,
      meta: { email: verifiedUser.email },
    });

    res
      .status(200)
      .json({ message: 'Email verified successfully, you can now login..!!' });
  } catch (err) {
    next(err);
  }
}
