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

  // object storage (AWS S3 or S3-compatible providers such as MinIO)
  AWS_ACCESS_KEY: z.string().min(1, 'AWS_ACCESS_KEY is required'),
  AWS_SECRET_KEY: z.string().min(1, 'AWS_SECRET_KEY is required'),
  AWS_S3_BUCKET_NAME: z.string().min(1, 'AWS_S3_BUCKET_NAME is required'),
  AWS_S3_REGION: z.string().min(1).default('ap-south-1'),
  AWS_S3_ENDPOINT: z.string().url().optional(),
  AWS_S3_FORCE_PATH_STYLE: z
    .string()
    .transform((val) => val === 'true')
    .default(false),

  // logging configurations
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_PRETTY_PRINT: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  LOG_REDACT_PATHS: z.string().optional(),

  // Google Gemini 
  GOOGLE_GEMINI_MODEL : z.string().min(1, 'GOOGLE_GEMINI_MODEL is required'),
  GOOGLE_GEMINI_API_KEY : z.string().min(1, 'GOOGLE_GEMINI_API_KEY is required'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(45_000),
  GEMINI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  GEMINI_MAX_INPUT_CHARS: z.coerce.number().int().min(10_000).max(1_000_000).default(250_000),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1_024).max(65_536).default(32_768),

  // Credits: map payment purposes to credit amounts, e.g. {"credits_10":10}
  CREDIT_PACKAGES_JSON: z.string().default('{}'),
  GENERATION_CREDIT_COST: z.coerce.number().int().min(0).max(100).default(1),
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
