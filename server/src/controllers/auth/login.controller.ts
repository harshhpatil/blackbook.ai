import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../../models/Users.model.ts';
import { Session } from '../../models/Session.model.ts';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../services/token.service.ts';
import {
  authCookieOptions,
  recordAudit,
  AuthError,
} from '../../helpers/auth.helpers.ts';

export async function login(
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

    // normalizing the email and finding the user in the database
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+password'
    );
    if (!user) {
      throw new AuthError('Invalid email or password', 401);
    }

    // comparing the provided password with the stored hashed password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthError('Invalid email or password', 401);
    }

    // checking if the user's email is verified or not
    if (!user.isEmailVerified) {
      throw new AuthError(
        'Email is not verified. Please verify your email to login.',
        403
      );
    }

    // converting the mongoose document into plain json object
    const sanitizedUser: Partial<IUser> = user.toObject();

    // clearing the object before signing the token
    delete sanitizedUser.password;
    delete sanitizedUser.emailVerificationToken;
    delete sanitizedUser.emailVerificationTokenExpiry;
    delete sanitizedUser.passwordResetToken;
    delete sanitizedUser.passwordResetTokenExpiry;

    // generating the refresh token and creating the backing session
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);

    // creating a secure session
    const session = await Session.create({
      user: sanitizedUser._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // setting the session to expire in 7 days
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const accessToken = generateAccessToken(
      sanitizedUser as IUser,
      session._id.toString()
    );

    // attaching the http-only cookies
    res.cookie('accessToken', accessToken, {
      ...authCookieOptions,
      maxAge: 15 * 60 * 1000, // setting the access token cookie to expire in 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      ...authCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // setting the refresh token cookie to expire in 7 days
    });

    // recording the successful login event in the audit logs
    await recordAudit({
      user: sanitizedUser._id!,
      event: 'login_success',
      req,
    });

    return res.status(200).json({ message: 'login successful..!!' });
  } catch (err) {
    return next(err); // forwarding the error to the global error handeler middleware
  }
}
