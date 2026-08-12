import { z } from 'zod';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('env');

/**
 * Core application environment and server settings.
 */
const serverConfig = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  IS_PRODUCTION: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
  CROSS_SITE_COOKIES: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
});

/**
 * Security, CORS, and proxy configurations.
 * Prevents unauthorized cross-origin requests.
 */
const securityConfig = z.object({
  CLIENT_URL: z.string().url(),
  CORS_ORIGINS: z.string(),
  TRUST_PROXY: z.string(),
  ALLOWED_ORIGINS: z.string(),
});

/**
 * Infrastructure and caching endpoints.
 */
const databaseConfig = z.object({
  MONGO_URI: z.string().url().or(z.string().startsWith('mongodb')),
  REDIS_URL: z.string().url().or(z.string().startsWith('redis')),
});

/**
 * Resend configuration for outbound transactional emails.
 */
const emailConfig = z.object({
  EMAIL_FROM_ADDRESS: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(value) ||
        /^[^<>]+ <[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(value),
      'EMAIL_FROM_ADDRESS must be an email address or "Display Name <email@example.com>"'
    ),
  RESEND_API_KEY: z.string().min(1),
});

/**
 * JWT authentication secrets and validation criteria.
 */
const authConfig = z.object({
  JWT_SECRET: z.string().min(1),
  JWT_AUDIENCE: z.string(),
  JWT_ISSUER: z.string(),
});

/**
 * Payment gateway configurations for processing transactions and webhooks.
 */
const paymentConfig = z.object({
  PAYMENT_PROVIDER: z.string().default('razorpay'),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_SUCCESS_URL: z.string().url(),
  PAYMENT_CANCEL_URL: z.string().url(),
  PAYMENT_DEFAULT_CURRENCY: z.string().default('inr'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
});

/**
 * S3-compatible object storage (AWS or MinIO).
 */
const storageConfig = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'Cloudflare Account ID is required'),
  R2_ACCESS_KEY_ID: z
    .string()
    .min(1, 'R2 Access Key ID is required')
    .optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2 Secret Key is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2 Bucket Name is required'),
  R2_ENDPOINT: z.string().url('R2 Endpoint must be a valid URL'),
  R2_PUBLIC_DOMAIN: z.string().url().optional(),
});

/**
 * System logging configuration.
 */
const loggingConfig = z.object({
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_PRETTY_PRINT: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
  LOG_REDACT_PATHS: z
    .string()
    .default(
      'authorization,cookie,set-cookie,password,refreshToken,accessToken,otp'
    ),
});

/**
 * AI Generation limits, model selection, and timeouts.
 * Safeguards against infinite loops and excessive API billing.
 */
const aiConfig = z.object({
  GOOGLE_GEMINI_MODEL: z.string(),
  GOOGLE_GEMINI_API_KEY: z.string(),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().default(45000),
  GEMINI_MAX_RETRIES: z.coerce.number().int().default(2),
  GEMINI_MAX_INPUT_CHARS: z.coerce.number().int().default(250000),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().default(32768),

  GOOGLE_CLIENT_ID: z.string().min(1),
});

/**
 * Credit system and pricing configuration.
 */
const billingConfig = z.object({
  GENERATION_CREDIT_COST: z.coerce.number().int().default(1),
  CREDIT_PACKAGES_JSON: z.string().default('{}'),
});

/**
 * The Master Environment Schema.
 * Combines all domain-specific schemas into a single source of truth.
 */
const envSchema = z.object({
  ...serverConfig.shape,
  ...securityConfig.shape,
  ...databaseConfig.shape,
  ...emailConfig.shape,
  ...authConfig.shape,
  ...paymentConfig.shape,
  ...storageConfig.shape,
  ...loggingConfig.shape,
  ...aiConfig.shape,
  ...billingConfig.shape,
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    'Invalid or missing environment variables:',
    log.error(parsedEnv.error.format())
  );
  process.exit(1);
}

/**
 * Validated and strongly-typed environment variables.
 * Import this throughout the application instead of using process.env directly.
 */
export const env = parsedEnv.data;
