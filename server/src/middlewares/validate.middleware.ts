import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

// middleware to validate request body against a Zod schema
const validate = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => issue.message);

      return res.status(400).json({
        message: 'validation failed',
        errors,
      });
    }

    // Parsed & sanitized data
    req.body = result.data;

    next();
  };
};

export default validate;
