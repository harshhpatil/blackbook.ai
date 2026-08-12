import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('validate-middleware');

/**
 * Middleware to validate and sanitize the request body against a Zod schema.
 *
 * If validation fails, returns a 400 Bad Request with formatted error messages.
 * If successful, replaces `req.body` with the strictly typed and sanitized data,
 * stripping out any unknown or malicious fields before they reach the controller.
 *
 * @param schema - The Zod schema to validate `req.body` against.
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Map Zod issues into a clean array of readable error messages
      const errors = result.error.issues.map((issue) => issue.message);

      // Log the failure for API monitoring (Note: We log the errors, but NOT the
      // raw req.body, to avoid accidentally logging plain-text passwords or PII)
      log.warn(
        {
          ip: req.ip,
          path: req.originalUrl,
          method: req.method,
          errors,
        },
        'Request body validation failed'
      );

      res.status(400).json({
        status: 'error',
        message: 'Request validation failed',
        errors,
      });
      return;
    }

    // Overwrite the request body with the parsed, sanitized data
    req.body = result.data;

    next();
  };
};

export default validate;
