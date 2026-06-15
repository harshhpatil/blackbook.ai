import { Request, Response, NextFunction } from 'express';

// middleware to guard routes based on user roles, ensuring that only users with the specified roles can access certain routes
const roleguard = (rolesAllowed: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    if (!rolesAllowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'forbidden' });
    }

    next();
  };
};

export default roleguard;
