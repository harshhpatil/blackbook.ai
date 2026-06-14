import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { User } from '../../models/Users.model.ts';
import { hashToken, verifyToken } from '../../services/token.service.js';
import { AuthError, recordAudit } from './auth.helpers.js';
import {
  queueWelcomeEmail,
  queueVerificationEmail,
} from ''; // Assuming you have typed this!

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
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AuthError('email is already registered', 409);
    }

    // generating email verification token and its expiry time
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = await hashToken(emailVerificationToken);
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // token expires in 24 hours

    // creating a new user in the database with the provided email, password and generated email verification token
    const newUser = await User.create({
      email: normalizedEmail,
      password,
      role: 'user',
      emailVerificationToken: emailVerificationTokenHash,
      emailVerificationTokenExpiry: tokenExpiry,
      isEmailVerified: false,
    });

    // queueing the verification email to be sent to the user
    const baseUrl = process.env.CLIENT_URL;
    if (!baseUrl) {
      throw new AuthError(
        'CLIENT_URL is not defined in the environment variables',
        500
      );
    }
    const verificationLink = `${baseUrl}/v1/api/auth/verify-email?token=${encodeURIComponent(emailVerificationToken)}&email=${normalizedEmail}`;

    await queueVerificationEmail(normalizedEmail, verificationLink);
    await recordAudit({
      user: newUser._id,
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
    next(err);
}
}

// function to send welcome email to the user after email verification
export async function welcomeEmail(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your email to receive welcome email.",
      });
    }

    await queueWelcomeEmail(user.email);
    return res.status(200).json({ message: "Welcome email sent successfully" });
  } catch (err) {
    return next(err);
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

    // finding the user with the provided email verification token and checking if the token is valid and not expired
    const users = await User.find({
      emailVerificationToken: { $exists: true, $ne: null },
      emailVerificationTokenExpiry: { $gt: new Date() },
    });

    let user = null;
    // finding the user whose email verification token matches the provided token and returning if not found
    for (const candidate of users) {
      // verifying the token by comparing the provided token with the hashed token stored in the database
      if (candidate.emailVerificationToken) {
        const isValid = await verifyToken(
          token,
          candidate.emailVerificationToken
        );
        if (isValid) {
          user = candidate;
          break;
        }
      }
    }

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired verification token' });
    }

    // marking the user's email as verified and clearing the email verification token and its expiry time
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    await user.save();

    // queing the welcome email to be sent to the user
    await queueWelcomeEmail(user.email);
    await recordAudit({
      user: user._id,
      event: 'email_verified',
      req,
      meta: { email: user.email },
    });

    // returning success response
    res.status(200).json({ message: 'email verified successfully, you can now login..!!' });
  } catch (err) {
    next(err);
  }
}
