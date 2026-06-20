import Joi, { ObjectSchema } from 'joi';

const passwordSchema = Joi.string()
  .min(8)
  .custom((value: string, helpers) => {
    if (Buffer.byteLength(value, 'utf8') > 72) {
      return helpers.error('string.max');
    }

    return value;
  })
  .pattern(/[A-Z]/)
  .pattern(/[a-z]/)
  .pattern(/[0-9]/)
  .pattern(/[!@#$%^&*]/);

// Validation schema for user login
export const loginSchema: ObjectSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().max(72).required(),
});

// Validation schema for user registration
export const registerSchema: ObjectSchema = Joi.object({
  email: Joi.string().email().required(),
  password: passwordSchema
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must be 72 bytes or fewer',
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number and special character',
    }),
});

// Validation schema for user password change
export const changePasswordSchema: ObjectSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: passwordSchema
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.max': 'New password must be 72 bytes or fewer',
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
  newPassword: passwordSchema
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.max': 'New password must be 72 bytes or fewer',
      'string.pattern.base':
        'New password must contain uppercase, lowercase, number and special character',
    }),
});
