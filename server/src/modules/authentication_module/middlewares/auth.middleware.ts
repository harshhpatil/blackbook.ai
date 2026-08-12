import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/Users.model.ts';
import { Session } from '../models/Session.model.ts';
import { env } from '../../../core/config/env.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('auth-middleware');

/**
 * Represents the structured payload embedded within the JWT access token.
 * Extends the default generic JwtPayload to provide strict typing.
 */
interface DecodedToken extends jwt.JwtPayload {
  userId: string;
  role: string;
  tokenVersion: number;
  sessionId: string;
}

/**
 * Express middleware to enforce authentication on protected routes.
 *
 * Flow:
 * 1. Extracts the HTTP-only `accessToken` cookie.
 * 2. Cryptographically verifies the JWT signature, audience, and issuer.
 * 3. Queries the database in parallel to ensure the user exists, the token version
 *    matches (preventing use of tokens issued before a password reset), and the
 *    associated session hasn't been manually revoked.
 * 4. Injects the authenticated user's minimal context into `req.user`.
 *
 * @param {Request} req - The incoming Express request object.
 * @param {Response} res - The outgoing Express response object.
 * @param {NextFunction} next - The callback to pass control to the next middleware/controller.
 * @returns {Promise<void>} Resolves void, but terminates the request early with a 401 if authentication fails.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  // allowCSRFRequest(req, res, next);

  const token = req.cookies.accessToken;

  if (!token) {
    res.status(401).json({ message: 'unauthorized or invalid token' });
    return;
  }

  try {
    // cryptographic validation of the token string
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER,
    }) as DecodedToken;

    // Parallel execution: fetch user token version and active session status simultaneously
    // .select() is heavily utilized to prevent pulling massive user/session documents into memory
    const [user, session] = await Promise.all([
      User.findById(decoded.userId).select('tokenVersion role'),
      Session.findOne({
        _id: decoded.sessionId,
        user: decoded.userId,
        revoked: false,
        expiresAt: { $gt: new Date() },
      }).select('_id'),
    ]);

    // reject the user if the user was deleted or if their global token version has changed (e.g., due to a password reset)
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      log.warn(
        { userId: decoded.userId },
        'Token version mismatch or user not found'
      );
      res.status(403).json({ message: 'invalid or expired token' });
      return;
    }

    // reject if the specific session was revoked
    if (!session) {
      log.warn({ sessionId: decoded.sessionId }, 'Session revoked or expired');
      res
        .status(401)
        .json({ message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    // attaching the user information to the request object for further use in the route handlers
    req.user = {
      id: user.id,
      role: user.role,
      sessionId: session._id.toString(),
    };

    next(); // proceeding to the next middleware or route handler
  } catch {
    return res.status(403).json({ message: 'invalid or expired token' });
  }
};

// /**
//  * Allows unauthenticated access to the CSRF token endpoint.
//  *
//  * This exception ensures clients can obtain a CSRF token before
//  * authentication by bypassing authentication for this public endpoint.
//  *
//  * @param req - The Express request object.
//  * @param res - The Express response object.
//  * @param next - The next middleware function.
//  */
// const allowCSRFRequest = (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): void => {
//   if (req.path === '/api/v1/auth/csrf-token') {
//     return next();
//   }
// }
