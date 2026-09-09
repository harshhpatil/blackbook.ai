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
    // Attempt parsing structured { body, query, params } first, fallback to req.body
    const isBodyWrapped =
      typeof req.body === 'object' && req.body !== null;
    const dataToValidate = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    let result = schema.safeParse(dataToValidate);

    if (result.success) {
      if (result.data && typeof result.data === 'object' && 'body' in result.data) {
        req.body = (result.data as { body: unknown }).body;
      } else {
        req.body = result.data;
      }
      return next();
    }

    // Fallback: try parsing req.body directly if the schema is not wrapped in { body }
    if (isBodyWrapped) {
      const fallbackResult = schema.safeParse(req.body);
      if (fallbackResult.success) {
        req.body = fallbackResult.data;
        return next();
      }
    }

    // Map Zod issues into a clean array of readable error messages
    const errors = result.error.issues.map((issue) => issue.message);

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
  };
};

export default validate;
