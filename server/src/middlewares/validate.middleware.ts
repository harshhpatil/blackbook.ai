import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

// middleware to validate incoming request bodies against a specified Joi schema, ensuring that the data adheres to the expected format and constraints
const validate = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    // Validate request body, abortEarly: false collects ALL errors instead of stopping at the first one
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

export default validate;
