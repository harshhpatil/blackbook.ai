import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/Users.model.ts';
import { Session } from '../models/Session.model.ts';
import { env } from '../config/env.ts';

// defining the structure of the jwt payload
interface DecodedToken {
  userId: string;
  role: string;
  tokenVersion: number;
  sessionId: string;
}

// defining the decoded token structure and the user information that will be attached to the request object
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
    sessionId: string;
  };
}

// authentication middleware to protect routes and ensure only authenticated users can access them
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  // This endpoint must be reachable before a user has an access token.
  if (
    req.method === 'GET' &&
    req.originalUrl.split('?')[0] === '/api/v1/auth/csrf-token'
  ) {
    return next();
  }

  // extracting the token from the cookies and validating it
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: 'unauthorized or invalid token' });
  }

  try {
    // verifying the token, extracting the payload and validating it
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER,
    }) as DecodedToken;
    const user = await User.findById(decoded.userId);

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(403).json({ message: 'invalid or expired token' });
    }

    // checking if the session associated with the token is still valid, not revoked and validating it
    const session = await Session.findOne({
      _id: decoded.sessionId,
      user: user._id,
      revoked: false,
      expiresAt: { $gt: new Date() },
    }).select('_id');

    if (!session) {
      return res.status(403).json({ message: 'invalid or expired token' });
    }

    // attaching the user information to the request object for further use in the route handlers
    (req as AuthenticatedRequest).user = {
      id: user.id,
      role: user.role,
      sessionId: session._id.toString(),
    };

    next(); // proceeding to the next middleware or route handler
  } catch {
    return res.status(403).json({ message: 'invalid or expired token' });
  }
};
