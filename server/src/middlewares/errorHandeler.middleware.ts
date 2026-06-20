import { Request, Response, NextFunction } from 'express';

// gloabal error handeller function to handel unhandelled errors in the application
export default function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  void req;
  void next;

  const error = err instanceof Error ? err : new Error('unknown error');
  const maybeStatus =
    typeof (err as { statusCode?: unknown })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : undefined;
  const status = maybeStatus && maybeStatus >= 400 && maybeStatus < 600
    ? maybeStatus
    : 500;

  if (status >= 500) {
    console.error('unhandled error', { message: error.message });
  }

  return res
    .status(status)
    .json({ message: status === 500 ? 'internal server error' : error.message });
}
