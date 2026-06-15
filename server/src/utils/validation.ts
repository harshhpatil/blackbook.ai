import Joi, { ObjectSchema } from 'joi';

// Validation schema for user login
export const loginSchema: ObjectSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Validation schema for user registration
export const registerSchema: ObjectSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .pattern(/[!@#$%^&*]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number and special character',
    }),
});

// Validation schema for user password change
export const changePasswordSchema: ObjectSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .pattern(/[!@#$%^&*]/)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.pattern.base':
        'New password must contain uppercase, lowercase, number and special character',
    }),
});

// Validation schema for forgot password
export const forgotPasswordSchema: ObjectSchema = Joi.object({
  email: Joi.string().email().required(),
});

// Validation schema for reset password
export const resetPasswordSchema: ObjectSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .pattern(/[!@#$%^&*]/)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.pattern.base':
        'New password must contain uppercase, lowercase, number and special character',
    }),
});
