import { Request, Response, NextFunction } from 'express';

// defining a clean custom error class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// defining the global error handler middleware
export default function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  void req;
  void next;

  // if the error is an instance of AppError, send the custom error response
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // falling back for unexpected system crashes
  if (err instanceof Error) {
    console.error('unhandelled internal error:', err);
  } else {
    console.error('unknown error type received:', err);
  }

  // sending a generic error response for unhandled errors
  return res.status(500).json({
    message: 'internal server error',
  });
}
