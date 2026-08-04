import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { IUser, User } from '../../models/Users.model.ts';
import { IEmailOutbox } from '../../models/EmailOutbox.model.ts';
import { hashToken } from '../../services/token.service.js';
import { AuthError, recordAudit } from '../../helpers/auth.helpers.ts';
import { env } from '../../config/env.ts';
import {
  createEmailOutboxEvent,
  publishEmailOutboxEvent,
} from '../../services/emailQueue.service.ts';

const isDuplicateKeyError = (err: unknown): err is { code: number } => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 11000
  );
};

// function to register users
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // extracting and validating the email and password from the request body
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AuthError('Email and password are required', 400);
    }

    // normalizing the email and checking if the user with the same email already exists in the database
    const normalizedEmail = email.trim().toLowerCase();
    const baseUrl = env.CLIENT_URL;

    // generating email verification token and its expiry time
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = hashToken(emailVerificationToken);
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // token expires in 24 hours

    const verificationLink = `${baseUrl}/api/v1/auth/verify-email?token=${emailVerificationToken}`;
    const mongoSession = await mongoose.startSession();
    let newUser: IUser | undefined;
    let outboxEvent: IEmailOutbox | undefined;

    await mongoSession.withTransaction(async () => {
      const existingUser = await User.findOne({
        email: normalizedEmail,
      }).session(mongoSession);
      if (existingUser) {
        throw new AuthError('email is already registered', 409);
      }

      // creating a new user in the database with the provided email, password and generated email verification token
      const createdUsers = await User.create(
        [
          {
            email: normalizedEmail,
            password,
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
        { email: normalizedEmail, link: verificationLink },
        mongoSession
      );
    });

    await mongoSession.endSession();

    if (outboxEvent) {
      await publishEmailOutboxEvent(outboxEvent);
    }

    await recordAudit({
      user: newUser!._id,
      event: 'user_registered',
      req,
      meta: { email: normalizedEmail },
    });

    // returning success response
    res.status(201).json({
      message:
        'User registered successfully. Please check your email to verify your account.',
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return next(new AuthError('email is already registered', 409));
    }

    next(err);
  }
}

// function to verify the user's email
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
      // Atomically consume the verification token so concurrent requests cannot
      // verify twice or enqueue duplicate welcome emails.
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
        { email: user.email },
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

    await recordAudit({
      user: verifiedUser._id,
      event: 'email_verified',
      req,
      meta: { email: verifiedUser.email },
    });

    // returning success response
    res
      .status(200)
      .json({ message: 'email verified successfully, you can now login..!!' });
  } catch (err) {
    next(err);
  }
}
