import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/Users.model.ts';

// defining the structure of the jwt payload
interface DecodedToken {
  userId: string;
  role: string;
  tokenVersion: number;
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
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is missing');

    const decoded = jwt.verify(token, secret) as DecodedToken;
    const user = await User.findById(decoded.userId);

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(403).json({ message: 'invalid or expired token' });
    }

    // attaching the user information to the request object for further use in the route handlers
    req.user = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch (err) {
    return res.status(403).json({ message: 'invalid or expired token' });
  }
};
