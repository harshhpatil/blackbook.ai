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

// authentication middleware to protect routes and ensure only authenticated users can access them
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  // extracting the token from the cookies and validating it
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: 'unauthorized or invalid token' });
  }

  try {
    // verifying the token and extracting the payload
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'],
      audience: env.jwtAudience,
      issuer: env.jwtIssuer,
    }) as DecodedToken;
    const user = await User.findById(decoded.userId);

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(403).json({ message: 'invalid or expired token' });
    }

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
    req.user = {
      id: user.id,
      role: user.role,
      sessionId: session._id.toString(),
    };

    next();
  } catch (err) {
    return res.status(403).json({ message: 'invalid or expired token' });
  }
};
