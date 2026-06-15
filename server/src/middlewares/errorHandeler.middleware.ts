import { Request, Response, NextFunction } from 'express';

// gloabal error handeller function to handel unhandelled errors in the application
export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('unhandled error', { message: err.message, stack: err.stack });
  const status = err.status || 500;
  res
    .status(status)
    .json({ message: status === 500 ? 'internal server error' : err.message });
}
