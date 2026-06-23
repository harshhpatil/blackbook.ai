import { z } from 'zod';

// defining the schema for enviroment variables
const envSchema = z.object({
  // server configurations
  IS_PRODUCTION: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),
  CROSS_SITE_COOKIES: z
    .string()
    .transform((val) => val === 'true')
    .default(false),

  // database and caching configurations
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // security and CORS configurations
  CLIENT_URL: z.string().url().min(1, 'CLIENT_URL is required'),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),
  TRUST_PROXY: z.string().min(1, 'TRUST_PROXY is required'),
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required'),

  // email (SMTP) configurations
  EMAIL_USER: z.string().email().min(1, 'EMAIL_USER is required'),
  EMAIL_PASS: z.string().min(1, 'EMAIL_PASS is required'),
  EMAIL_FROM: z.string().email().min(1, 'EMAIL_FROM is required'),

  // authentication (JWT) configurations
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_AUDIENCE: z.string().min(1, 'JWT_AUDIENCE is required'),
  JWT_ISSUER: z.string().min(1, 'JWT_ISSUER is required'),

  // payment gateway configurations
  PAYMENT_PROVIDER: z.string().min(1, 'PAYMENT_PROVIDER is required'),
  PAYMENT_WEBHOOK_SECRET: z
    .string()
    .min(1, 'PAYMENT_WEBHOOK_SECRET is required'),
  PAYMENT_SUCCESS_URL: z
    .string()
    .url()
    .min(1, 'PAYMENT_SUCCESS_URL is required'),
  PAYMENT_CANCEL_URL: z.string().url().min(1, 'PAYMENT_CANCEL_URL is required'),

  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
});

// parsing the enviroment variables using the schema and validating it
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    'enviroment variables does not exist or not loaded properly',
    parsedEnv.error.format()
  );
  process.exit(1);
}

// exporting the parsed enviroment variables
export const env = parsedEnv.data;
